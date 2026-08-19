import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../components/ui/Icon'

const API_URL = import.meta.env.VITE_API_URL || ''
const STUDIO_BRAND = 'Nereida Martín Studio'

export default function ConfirmCompanionBooking() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/bookings/confirm-companion/${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'No se pudo cargar la reserva')
          setErrorCode(json.code)
          return
        }
        setData(json)
        if (json.status === 'confirmed') {
          setConfirmed(true)
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [token])

  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/bookings/confirm-companion/${token}`, {
        method: 'POST',
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'No se pudo confirmar')
        setErrorCode(json.code)
        return
      }

      setConfirmed(true)
      setData((prev) => ({ ...prev, status: 'confirmed' }))
    } catch {
      setError('Error de conexión al confirmar')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const formatSlot = (startTime, endTime) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const dateLabel = format(start, "EEEE, d 'de' MMMM", { locale: es })
    const timeLabel = `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
    return { dateLabel, timeLabel }
  }

  const primarySlot = data?.primary ? formatSlot(data.primary.startTime, data.primary.endTime) : null
  const companionSlot = data?.companion
    ? formatSlot(data.companion.startTime, data.companion.endTime)
    : null

  const expired = errorCode === 'EXPIRED' || errorCode === 'INVALID_TOKEN'

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="font-headline text-xl text-on-surface">
            {STUDIO_BRAND}
          </Link>
        </div>

        {confirmed ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-linear-to-br from-primary to-primary/70 flex items-center justify-center shadow-[0_8px_24px_rgba(183,139,125,0.35)]">
              <Icon name="check" className="text-white text-4xl" />
            </div>
            <h1 className="font-headline text-2xl text-on-surface mb-2">¡Cita confirmada!</h1>
            <p className="text-sm text-on-surface-variant">
              Hemos confirmado tu perfilado y el de {data?.primary?.name}. Te hemos enviado un email
              de confirmación.
            </p>
            {companionSlot && (
              <div className="mt-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-6 text-left">
                <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary mb-2">
                  Tu cita
                </p>
                <p className="font-headline text-lg capitalize">{companionSlot.dateLabel}</p>
                <p className="text-sm text-on-surface-variant">{companionSlot.timeLabel}</p>
              </div>
            )}
          </motion.div>
        ) : expired || error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-error-container/30 flex items-center justify-center">
              <Icon name="event_busy" className="text-error text-3xl" />
            </div>
            <h1 className="font-headline text-2xl text-on-surface mb-2">
              {expired ? 'Enlace expirado' : 'No disponible'}
            </h1>
            <p className="text-sm text-on-surface-variant">{error}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-8">
              <h1 className="font-headline text-2xl text-on-surface mb-2">
                Confirma tu cita conjunta
              </h1>
              <p className="text-sm text-on-surface-variant">
                Hola {data?.companion?.name}, {data?.primary?.name} te ha invitado a reservar perfilado
                juntas. Confirma antes de 24 horas.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {primarySlot && (
                <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                  <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary mb-2">
                    Cita de {data.primary.name}
                  </p>
                  <p className="text-sm font-medium text-on-surface">{data.primary.treatmentName}</p>
                  <p className="font-headline capitalize mt-2">{primarySlot.dateLabel}</p>
                  <p className="text-sm text-on-surface-variant">{primarySlot.timeLabel}</p>
                </div>
              )}
              {companionSlot && (
                <div className="rounded-2xl bg-primary/8 border border-primary/20 p-5">
                  <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary mb-2">
                    Tu cita
                  </p>
                  <p className="text-sm font-medium text-on-surface">{data.companion.treatmentName}</p>
                  <p className="font-headline capitalize mt-2">{companionSlot.dateLabel}</p>
                  <p className="text-sm text-on-surface-variant">{companionSlot.timeLabel}</p>
                </div>
              )}
            </div>

            {data?.expiresAt && (
              <p className="text-xs text-center text-on-surface-variant mb-6">
                Plazo límite:{' '}
                {format(new Date(data.expiresAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full coral-gradient text-white py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold editorial-shadow disabled:opacity-50"
            >
              {confirming ? 'Confirmando…' : 'Confirmar mi cita'}
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
