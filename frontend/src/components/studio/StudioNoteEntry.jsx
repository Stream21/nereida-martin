import { useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { deleteClientNote, updateClientNote } from '../../utils/ownerApi'
import { formatStudioDateTime } from '../../utils/studioFormat'

export const noteListVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

export const noteItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
}

export default function StudioNoteEntry({ note, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const handleSave = async () => {
    const body = draft.trim()
    if (!body) {
      setError('Escribe una nota')
      return
    }
    setBusy('save')
    setError('')
    try {
      const res = await updateClientNote(note.id, { body })
      onUpdated?.(res.note)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'No se pudo guardar')
    } finally {
      setBusy('')
    }
  }

  const handleDelete = async () => {
    setBusy('delete')
    setError('')
    try {
      await deleteClientNote(note.id)
      onDeleted?.(note.id)
    } catch (err) {
      setError(err.message || 'No se pudo borrar')
      setBusy('')
      setConfirmDelete(false)
    }
  }

  return (
    <motion.li
      layout
      variants={noteItemVariants}
      className="rounded-2xl bg-surface-container-low border border-outline-variant/20 px-3.5 py-3"
    >
      <p className="text-[11px] text-on-surface-variant tabular-nums">
        {formatStudioDateTime(note.createdAt)}
        {note.updatedAt ? ' · editada' : ''}
      </p>

      {editing ? (
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary resize-none"
        />
      ) : (
        <p className="mt-1.5 text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{note.body}</p>
      )}

      {error && <p className="mt-2 text-xs text-error">{error}</p>}

      {confirmDelete ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => setConfirmDelete(false)}
            className="cursor-pointer min-h-9 rounded-xl px-3 text-xs text-on-surface-variant hover:bg-surface-container"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={handleDelete}
            className="cursor-pointer min-h-9 rounded-xl bg-error-container text-error px-3 text-xs font-medium disabled:opacity-60"
          >
            {busy === 'delete' ? 'Borrando…' : 'Borrar nota'}
          </button>
        </div>
      ) : editing ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setEditing(false)
              setDraft(note.body)
              setError('')
            }}
            className="cursor-pointer min-h-9 rounded-xl px-3 text-xs text-on-surface-variant hover:bg-surface-container"
          >
            Cancelar
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            disabled={Boolean(busy)}
            onClick={handleSave}
            className="cursor-pointer min-h-9 rounded-xl bg-primary text-on-primary px-3 text-xs font-medium disabled:opacity-60"
          >
            {busy === 'save' ? 'Guardando…' : 'Guardar'}
          </motion.button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => {
              setDraft(note.body)
              setEditing(true)
              setError('')
            }}
            title="Editar nota"
            aria-label="Editar nota"
            className="cursor-pointer p-2 rounded-xl text-primary hover:bg-primary/10"
          >
            <Icon name="edit" className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Borrar nota"
            aria-label="Borrar nota"
            className="cursor-pointer p-2 rounded-xl text-on-surface-variant hover:bg-error-container hover:text-error"
          >
            <Icon name="delete" className="text-base" />
          </button>
        </div>
      )}
    </motion.li>
  )
}
