import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { fetchOwnerSettings, updateOwnerSettings } from '../../utils/ownerApi'

export default function StudioSettingsPanel() {
  const [bookingStartDate, setBookingStartDate] = useState('')
  const [bookingEndDate, setBookingEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchOwnerSettings()
      .then((data) => {
        if (cancelled) return
        setBookingStartDate(data.bookingStartDate || '')
        setBookingEndDate(data.bookingEndDate || '')
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
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const data = await updateOwnerSettings({ bookingStartDate, bookingEndDate })
      setBookingStartDate(data.bookingStartDate)
      setBookingEndDate(data.bookingEndDate)
      setSuccess('Configuración guardada')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto"
    >
      <div className="mb-6">
        <h2 className="font-headline text-xl text-on-surface">Configuración</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Controla el calendario de reservas online para las clientas.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 sm:p-6 space-y-5 shadow-[0_4px_24px_rgba(67,61,60,0.06)]"
      >
        <label className="block">
          <span className="text-sm text-on-surface-variant mb-1.5 flex items-center gap-1.5">
            <Icon name="event_available" className="text-base" />
            Reservas desde
          </span>
          <input
            type="date"
            value={bookingStartDate}
            onChange={(e) => setBookingStartDate(e.target.value)}
            required
            className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm text-on-surface-variant mb-1.5 flex items-center gap-1.5">
            <Icon name="event_busy" className="text-base" />
            Reservas hasta
          </span>
          <input
            type="date"
            value={bookingEndDate}
            onChange={(e) => setBookingEndDate(e.target.value)}
            required
            className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
          />
          <p className="text-xs text-on-surface-variant mt-2">
            Las clientas no podrán reservar después de esta fecha.
          </p>
        </label>

        {error && (
          <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-primary bg-primary-container/40 rounded-xl px-3 py-2">{success}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full cursor-pointer rounded-2xl bg-primary text-on-primary py-3 font-medium min-h-12 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </motion.div>
  )
}
