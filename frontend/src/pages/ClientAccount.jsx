import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../components/ui/Icon'
import Navbar from '../components/layout/Navbar'
import ClientServicesChart from '../components/client/ClientServicesChart'
import { fetchMyBookings, fetchMyBookingStats } from '../utils/clientAuth'

function formatBookingDate(iso) {
  return format(new Date(iso), "EEEE d 'de' MMMM · HH:mm", { locale: es })
}

export default function ClientAccount() {
  const [stats, setStats] = useState(null)
  const [nextBooking, setNextBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchMyBookingStats(),
      fetchMyBookings({ tab: 'upcoming', limit: 1 }),
    ])
      .then(([statsRes, bookingsRes]) => {
        if (cancelled) return
        setStats(statsRes)
        setNextBooking(bookingsRes.bookings?.[0] || null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-headline text-2xl text-on-surface mb-1">Mi cuenta</h1>
          <p className="text-sm text-on-surface-variant mb-6">Gestiona tus citas en el estudio</p>

          {nextBooking && (
            <div className="rounded-3xl bg-primary/10 border border-primary/20 p-5 mb-5">
              <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary mb-1">
                Tu próxima cita
              </p>
              <p className="font-medium text-on-surface">{nextBooking.treatmentName}</p>
              {nextBooking.treatmentTag && (
                <p className="text-sm text-on-surface-variant">{nextBooking.treatmentTag}</p>
              )}
              <p className="text-sm text-on-surface mt-2 capitalize">
                {formatBookingDate(nextBooking.startTime)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Link
              to="/reservar"
              className="rounded-3xl bg-surface-container-lowest border border-outline-variant/25 p-5 shadow-[0_4px_20px_rgba(67,61,60,0.05)] hover:border-primary/30 transition-colors"
            >
              <Icon name="calendar_add_on" className="text-primary text-2xl mb-2" />
              <p className="font-medium text-on-surface">Reservar cita</p>
              <p className="text-xs text-on-surface-variant mt-1">Elige tratamiento y horario</p>
            </Link>
            <Link
              to="/mis-citas"
              className="rounded-3xl bg-surface-container-lowest border border-outline-variant/25 p-5 shadow-[0_4px_20px_rgba(67,61,60,0.05)] hover:border-primary/30 transition-colors"
            >
              <Icon name="event_note" className="text-primary text-2xl mb-2" />
              <p className="font-medium text-on-surface">Mis citas</p>
              <p className="text-xs text-on-surface-variant mt-1">Historial y citas activas</p>
            </Link>
          </div>

          {!loading && stats && (
            <Link to="/mis-citas" className="block">
              <ClientServicesChart
                compact
                completedVisits={stats.completedVisits}
                byTreatment={stats.byTreatment}
              />
              <p className="text-xs text-primary text-center mt-2">Ver detalle →</p>
            </Link>
          )}
        </motion.div>
      </main>
    </div>
  )
}
