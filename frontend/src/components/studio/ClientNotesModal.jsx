import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'
import StudioNoteEntry, { noteListVariants } from './StudioNoteEntry'
import { createClientNote, fetchClientNotes } from '../../utils/ownerApi'
import {
  bookingStatusLabel,
  formatStudioDateTime,
} from '../../utils/studioFormat'

const sheetVariants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
}

function bookingLabel(booking) {
  const name = booking.treatmentName || 'Cita'
  const when = formatStudioDateTime(booking.startTime)
  const status = bookingStatusLabel(booking.status)
  return `${name} · ${when}${status ? ` · ${status}` : ''}`
}

export default function ClientNotesModal({ clientId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clientName, setClientName] = useState('')
  const [notes, setNotes] = useState([])
  const [bookings, setBookings] = useState([])
  const [scope, setScope] = useState('client')
  const [bookingId, setBookingId] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClientNotes(clientId)
      .then((res) => {
        if (cancelled) return
        setClientName(res.client?.name || '')
        setNotes(res.notes || [])
        setBookings(res.bookings || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const clientNotes = useMemo(() => notes.filter((n) => !n.bookingId), [notes])
  const serviceGroups = useMemo(() => {
    const map = new Map()
    for (const note of notes) {
      if (!note.bookingId) continue
      if (!map.has(note.bookingId)) {
        map.set(note.bookingId, {
          bookingId: note.bookingId,
          treatmentName: note.treatmentName || 'Servicio',
          treatmentTag: note.treatmentTag || '',
          bookingStartTime: note.bookingStartTime,
          notes: [],
        })
      }
      map.get(note.bookingId).notes.push(note)
    }
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.bookingStartTime ? new Date(a.bookingStartTime).getTime() : 0
      const tb = b.bookingStartTime ? new Date(b.bookingStartTime).getTime() : 0
      return tb - ta
    })
  }, [notes])

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
      setFormError('Escribe una nota')
      return
    }
    if (scope === 'service' && !bookingId) {
      setFormError('Elige el servicio')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await createClientNote(clientId, {
        body: text,
        bookingId: scope === 'service' ? Number(bookingId) : null,
      })
      setNotes((prev) => [res.note, ...prev])
      setBody('')
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-surface/35 backdrop-blur-[2px] p-0 sm:p-4">
      <motion.div
        variants={sheetVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(67,61,60,0.14)]"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/20">
          <div className="min-w-0">
            <h3 className="font-headline text-lg text-on-surface">Notas</h3>
            {clientName && (
              <p className="text-xs text-on-surface-variant truncate">{clientName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-2 min-h-11 min-w-11 rounded-full hover:bg-surface-container shrink-0"
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Cargando…</p>
          ) : error ? (
            <p className="text-sm text-error">{error}</p>
          ) : (
            <>
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Icon name="person" className="text-base" />
                  </span>
                  <div>
                    <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                      Sobre la clienta
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Preferencias, alergias y observaciones generales
                    </p>
                  </div>
                </div>
                {clientNotes.length === 0 ? (
                  <p className="text-sm text-on-surface-variant rounded-2xl bg-surface-container-low px-3.5 py-3">
                    Aún no hay notas de la clienta.
                  </p>
                ) : (
                  <motion.ul
                    variants={noteListVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-2.5"
                  >
                    {clientNotes.map((note) => (
                      <StudioNoteEntry
                        key={note.id}
                        note={note}
                        onUpdated={replaceNote}
                        onDeleted={removeNote}
                      />
                    ))}
                  </motion.ul>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-container/70 text-on-surface">
                    <Icon name="spa" className="text-base" />
                  </span>
                  <div>
                    <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                      Sobre servicios
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Notas tomadas en una cita concreta
                    </p>
                  </div>
                </div>
                {serviceGroups.length === 0 ? (
                  <p className="text-sm text-on-surface-variant rounded-2xl bg-surface-container-low px-3.5 py-3">
                    No hay notas ligadas a un servicio.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {serviceGroups.map((group) => (
                      <div key={group.bookingId} className="space-y-2">
                        <div className="rounded-2xl bg-primary/8 border border-primary/12 px-3.5 py-2">
                          <p className="text-sm font-medium text-on-surface">
                            {group.treatmentName}
                            {group.treatmentTag ? ` · ${group.treatmentTag}` : ''}
                          </p>
                          <p className="text-xs text-on-surface-variant tabular-nums mt-0.5">
                            {formatStudioDateTime(group.bookingStartTime)}
                          </p>
                        </div>
                        <motion.ul
                          variants={noteListVariants}
                          initial="hidden"
                          animate="show"
                          className="space-y-2.5"
                        >
                          {group.notes.map((note) => (
                            <StudioNoteEntry
                              key={note.id}
                              note={note}
                              onUpdated={replaceNote}
                              onDeleted={removeNote}
                            />
                          ))}
                        </motion.ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-outline-variant/20 bg-surface-container-lowest px-5 py-4 space-y-3 rounded-b-3xl"
        >
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-surface-container-low">
            <button
              type="button"
              onClick={() => setScope('client')}
              className={`cursor-pointer min-h-10 rounded-xl text-xs font-medium transition-colors ${
                scope === 'client'
                  ? 'bg-primary text-on-primary shadow-[0_4px_12px_rgba(255,138,138,0.28)]'
                  : 'text-on-surface-variant'
              }`}
            >
              Sobre la clienta
            </button>
            <button
              type="button"
              onClick={() => setScope('service')}
              className={`cursor-pointer min-h-10 rounded-xl text-xs font-medium transition-colors ${
                scope === 'service'
                  ? 'bg-primary text-on-primary shadow-[0_4px_12px_rgba(255,138,138,0.28)]'
                  : 'text-on-surface-variant'
              }`}
            >
              Sobre un servicio
            </button>
          </div>

          <AnimatePresence>
            {scope === 'service' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              >
                {bookings.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">
                    Esta clienta aún no tiene citas para anotar un servicio.
                  </p>
                ) : (
                  <select
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm outline-none focus:border-primary min-h-11"
                  >
                    <option value="">Elige la cita…</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {bookingLabel(b)}
                      </option>
                    ))}
                  </select>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              scope === 'service'
                ? 'Observación de este servicio…'
                : 'Alergias, preferencias, observaciones…'
            }
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm outline-none focus:border-primary resize-none"
          />

          {formError && <p className="text-sm text-error">{formError}</p>}

          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            disabled={saving || loading}
            className="cursor-pointer w-full rounded-2xl bg-primary text-on-primary py-3 text-sm font-medium disabled:opacity-60 min-h-12"
          >
            {saving ? 'Guardando…' : 'Añadir nota'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
