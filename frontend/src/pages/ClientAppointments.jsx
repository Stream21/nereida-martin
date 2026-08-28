import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../components/ui/Icon'
import Navbar from '../components/layout/Navbar'
import ClientServicesChart from '../components/client/ClientServicesChart'
import { fetchMyBookings, fetchMyBookingStats } from '../utils/clientAuth'

const TABS = [
  { id: 'upcoming', label: 'Vigentes' },
  { id: 'past', label: 'Finalizadas' },
  { id: 'cancelled', label: 'Canceladas' },
]

function formatBookingDate(iso) {
  return format(new Date(iso), "EEE d MMM yyyy · HH:mm", { locale: es })
}

function BookingCard({ booking, tab, onRebook }) {
  const cancelled = tab === 'cancelled'
  const canManage = tab === 'upcoming' && booking.canCancel && booking.cancelToken

  return (
    <div
      className={`rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4 ${
        cancelled ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-medium text-on-surface ${cancelled ? 'line-through' : ''}`}>
            {booking.treatmentName}
          </p>
          {booking.treatmentTag && (
            <p className="text-sm text-on-surface-variant">{booking.treatmentTag}</p>
          )}
          <p className="text-sm text-on-surface-variant mt-2 capitalize">
            {formatBookingDate(booking.startTime)}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-label font-bold tracking-wide uppercase px-2 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
          {booking.statusLabel}
        </span>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Link
            to={`/cancelar/${booking.cancelToken}?rebook=${encodeURIComponent(booking.treatmentId || '')}`}
            className="cursor-pointer inline-flex items-center justify-center min-h-10 px-4 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
          >
            Modificar
          </Link>
          <Link
            to={`/cancelar/${booking.cancelToken}`}
            className="cursor-pointer inline-flex items-center justify-center min-h-10 px-4 rounded-xl border border-outline-variant/40 text-on-surface-variant text-sm font-medium hover:bg-surface-container-low transition-colors"
          >
            Cancelar
          </Link>
        </div>
      )}

      {tab === 'past' && booking.treatmentId && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onRebook(booking.treatmentId)}
            className="cursor-pointer text-sm text-primary font-medium"
          >
            Reservar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}

export default function ClientAppointments() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('upcoming')
  const [stats, setStats] = useState(null)
  const [bookings, setBookings] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStats = useCallback(() => {
    fetchMyBookingStats()
      .then(setStats)
      .catch(() => {})
  }, [])

  const loadBookings = useCallback(() => {
    setLoading(true)
    setError('')
    fetchMyBookings({ tab, limit: 30 })
      .then((res) => {
        setBookings(res.bookings || [])
        setSummary(res.summary || null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const tabCount = (id) => {
    if (!summary) return null
    if (id === 'upcoming') return summary.upcomingCount
    return null
  }

  const handleRebook = (treatmentId) => {
    navigate(`/reservar?treatment=${encodeURIComponent(treatmentId)}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h1 className="font-headline text-2xl text-on-surface">Mis citas</h1>
            <Link to="/cuenta" className="text-sm text-primary hover:underline shrink-0">
              Mi cuenta
            </Link>
          </div>

          {stats && stats.completedVisits > 0 && (
            <div className="mb-5">
              <ClientServicesChart
                completedVisits={stats.completedVisits}
                byTreatment={stats.byTreatment}
              />
            </div>
          )}

          <div className="sticky top-[4.5rem] z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm mb-3 flex gap-2 overflow-x-auto">
            {TABS.map((t) => {
              const count = tabCount(t.id)
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`cursor-pointer shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {t.label}
                  {count != null && count > 0 ? ` (${count})` : ''}
                </button>
              )
            })}
          </div>

          {error && (
            <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2 mb-4">{error}</p>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 rounded-3xl bg-surface-container-low/50">
              <Icon name="event_busy" className="text-4xl text-outline mb-3" />
              <p className="text-on-surface-variant text-sm mb-4">
                {tab === 'upcoming'
                  ? 'No tienes citas vigentes'
                  : tab === 'past'
                    ? 'Aún no tienes historial'
                    : 'No tienes citas canceladas'}
              </p>
              <Link to="/reservar" className="text-sm text-primary font-medium hover:underline">
                Reservar ahora
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <BookingCard key={b.id} booking={b} tab={tab} onRebook={handleRebook} />
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
