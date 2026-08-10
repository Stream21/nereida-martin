import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const API_URL = import.meta.env.VITE_API_URL || ''
const WHATSAPP_URL = 'https://wa.me/34641613614'
const STUDIO_BRAND = 'Nereida Martín Studio'

function CheckCircleIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  )
}

function ErrorOutlineIcon({ className = 'w-10 h-10' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    </svg>
  )
}

export default function CancelBooking() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/bookings/cancel/${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'No se pudo cargar la reserva')
          setErrorCode(json.code)
          if (json.booking) setData(json)
          return
        }
        setData(json)
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [token])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const res = await fetch(`${API_URL}/api/bookings/cancel/${token}`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || json.message || 'No se pudo cancelar')
        setErrorCode(json.code)
        if (json.cancellation) {
          setData((prev) => ({ ...prev, cancellation: json.cancellation }))
        }
        return
      }

      setCancelled(true)
    } catch {
      setError('Error de conexión al cancelar')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const booking = data?.booking
  const cancellation = data?.cancellation
  const startDate = booking ? new Date(booking.startTime) : null
  const endDate = booking ? new Date(booking.endTime) : null
  const deadlinePassed =
    errorCode === 'DEADLINE_PASSED' || (cancellation && cancellation.canCancel === false)

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="font-headline text-xl text-on-surface">
            {STUDIO_BRAND}
          </Link>
        </div>

        {cancelled ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircleIcon className="w-9 h-9" />
            </div>
            <h1 className="font-headline text-2xl text-on-surface mb-2">Cita cancelada</h1>
            <p className="text-sm text-on-surface-variant mb-6">
              Hemos cancelado tu reserva y te hemos enviado un email de confirmación.
            </p>
            <Link
              to="/reservar"
              className="inline-block coral-gradient text-white py-3 px-8 rounded-2xl font-label text-sm tracking-widest uppercase font-bold"
            >
              Reservar de nuevo
            </Link>
          </motion.div>
        ) : errorCode === 'INVALID_TOKEN' || (!booking && error) ? (
          <div className="text-center bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10">
            <div className="flex justify-center text-outline-variant mb-4">
              <ErrorOutlineIcon className="w-10 h-10" />
            </div>
            <h1 className="font-headline text-xl text-on-surface mb-2">Enlace no válido</h1>
            <p className="text-sm text-on-surface-variant">{error}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10"
          >
            <h1 className="font-headline text-2xl text-on-surface text-center mb-6">
              {errorCode === 'ALREADY_CANCELLED'
                ? 'Cita ya cancelada'
                : deadlinePassed
                  ? 'No se puede cancelar online'
                  : 'Cancelar cita'}
            </h1>

            {booking && startDate && (
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary mb-1">
                    Tratamiento
                  </p>
                  <p className="font-headline text-lg text-on-surface">{booking.treatmentName}</p>
                  {booking.treatmentTag && (
                    <p className="text-sm text-on-surface-variant">{booking.treatmentTag}</p>
                  )}
                </div>
                <div className="h-px bg-outline-variant/10" />
                <div>
                  <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary mb-1">
                    Fecha y hora
                  </p>
                  <p className="font-headline text-lg text-on-surface capitalize">
                    {format(startDate, "EEEE, d 'de' MMMM", { locale: es })}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
                  </p>
                </div>
              </div>
            )}

            {cancellation && (
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 mb-6">
                <p className="text-xs text-on-surface-variant leading-relaxed mb-2">
                  {cancellation.policy}
                </p>
                <p className="text-xs text-on-surface">
                  Plazo límite: <strong>{cancellation.deadline}</strong>
                </p>
              </div>
            )}

            {deadlinePassed && (
              <div className="bg-amber-50 text-amber-950 rounded-xl p-4 text-sm mb-4 border border-amber-200/60">
                <p className="font-medium mb-2">El plazo de cancelación online ha terminado.</p>
                <p className="text-xs leading-relaxed mb-3">
                  {error ||
                    'Solo puedes cancelar hasta el día anterior a tu cita, a la misma hora. Si necesitas ayuda ahora, escríbenos por WhatsApp.'}
                </p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full py-3 rounded-2xl bg-[#25D366] text-white font-label text-xs tracking-widest uppercase font-bold"
                >
                  Contactar por WhatsApp
                </a>
              </div>
            )}

            {error && !deadlinePassed && (
              <div className="bg-red-50 text-red-800 rounded-xl p-4 text-sm mb-4">
                {error}
              </div>
            )}

            {errorCode !== 'ALREADY_CANCELLED' && cancellation?.canCancel && (
              <motion.button
                whileTap={cancelling ? {} : { scale: 0.98 }}
                onClick={handleCancel}
                disabled={cancelling}
                className={`w-full py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold border-2 border-red-300 text-red-700 hover:bg-red-50 transition-colors ${
                  cancelling ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {cancelling ? 'Cancelando...' : 'Confirmar cancelación'}
              </motion.button>
            )}

            <Link
              to="/"
              className="block text-center mt-4 text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Volver al inicio
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  )
}
