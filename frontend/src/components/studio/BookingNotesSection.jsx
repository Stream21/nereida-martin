import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import StudioNoteEntry, { noteListVariants } from './StudioNoteEntry'
import { createClientNote } from '../../utils/ownerApi'

export default function BookingNotesSection({ clientId, bookingId, notes: initialNotes }) {
  const incoming = initialNotes || []
  const notesKey = incoming.map((n) => n.id).join(',')
  const [notes, setNotes] = useState(incoming)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setNotes(initialNotes || [])
  }, [bookingId, notesKey, initialNotes])

  const replaceNote = (updated) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
  }

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) {
      setError('Escribe una nota')
      return
    }
    if (!clientId || !bookingId) return
    setSaving(true)
    setError('')
    try {
      const res = await createClientNote(clientId, { body: text, bookingId })
      setNotes((prev) => [res.note, ...prev])
      setBody('')
    } catch (err) {
      setError(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!clientId || !bookingId) return null

  return (
    <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/80 px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="sticky_note_2" className="text-primary text-lg" />
        <div>
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Notas de este servicio
          </p>
          <p className="text-xs text-on-surface-variant">Quedan ligadas a esta cita</p>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Aún no hay notas en esta cita.</p>
      ) : (
        <motion.ul
          variants={noteListVariants}
          initial="hidden"
          animate="show"
          className="space-y-2.5"
        >
          {notes.map((note) => (
            <StudioNoteEntry
              key={note.id}
              note={note}
              onUpdated={replaceNote}
              onDeleted={removeNote}
            />
          ))}
        </motion.ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Observación de este servicio…"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary resize-none"
        />
        {error && <p className="text-xs text-error">{error}</p>}
        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          disabled={saving}
          className="cursor-pointer w-full rounded-2xl bg-primary text-on-primary py-2.5 text-sm font-medium disabled:opacity-60 min-h-11"
        >
          {saving ? 'Guardando…' : 'Añadir nota'}
        </motion.button>
      </form>
    </section>
  )
}
