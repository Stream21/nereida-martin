import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../components/ui/Icon'

const API_URL = import.meta.env.VITE_API_URL || ''

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

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="font-headline text-xl text-on-surface">
            Studio Anuelblingding
          </Link>
        </div>

        {cancelled ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="check_circle" className="text-3xl text-primary" />
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
            <Icon name="error_outline" className="text-4xl text-outline-variant mb-4" />
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
              {errorCode === 'ALREADY_CANCELLED' ? 'Cita ya cancelada' : 'Cancelar cita'}
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

            {error && (
              <div className="bg-red-50 text-red-800 rounded-xl p-4 text-sm mb-4">
                {error}
                {errorCode === 'DEADLINE_PASSED' && (
                  <p className="mt-2 text-xs">
                    Si necesitas ayuda, contáctanos por WhatsApp desde nuestra web.
                  </p>
                )}
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
