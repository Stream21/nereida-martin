import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../ui/Icon'

const checkVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut', delay: 0.3 },
  },
}

const circleVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 200, damping: 15, delay: 0.1 },
  },
}

export default function BookingSuccess({ bookingData, onClose }) {
  if (!bookingData) return null

  const { booking, icsUrl, googleCalendarUrl, client } = bookingData
  const startDate = new Date(booking.startTime)
  const endDate = new Date(booking.endTime)
  const dateLabel = format(startDate, "EEEE, d 'de' MMMM", { locale: es })
  const timeLabel = `${format(startDate, 'HH:mm')} – ${format(endDate, 'HH:mm')}`

  const apiUrl = import.meta.env.VITE_API_URL || ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      {/* Animated check */}
      <motion.div
        variants={circleVariants}
        initial="hidden"
        animate="visible"
        className="w-20 h-20 mx-auto mb-6 rounded-full bg-linear-to-br from-primary to-primary/70 flex items-center justify-center shadow-[0_8px_24px_rgba(255,138,138,0.35)]"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10">
          <motion.path
            d="M5 13l4 4L19 7"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={checkVariants}
            initial="hidden"
            animate="visible"
          />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface mb-2">
          ¡Reserva Confirmada!
        </h2>
        <p className="text-sm text-on-surface-variant">
          Te hemos enviado un email de confirmación a <strong>{client.email}</strong>
        </p>
      </motion.div>

      {/* Booking details */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.4 }}
        className="mt-8 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 text-left"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary mb-1">
              Tratamiento
            </p>
            <p className="font-headline text-lg text-on-surface">{booking.treatmentName}</p>
            <p className="text-sm text-on-surface-variant">{booking.treatmentTag}</p>
          </div>
          <div className="h-px bg-outline-variant/10" />
          <div>
            <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary mb-1">
              Fecha y hora
            </p>
            <p className="font-headline text-lg text-on-surface capitalize">{dateLabel}</p>
            <p className="text-sm text-on-surface-variant">{timeLabel}</p>
          </div>
        </div>
      </motion.div>

      {/* Add to calendar */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="mt-6 space-y-3"
      >
        <p className="text-xs font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-4">
          Agregar a tu calendario
        </p>

        <a
          href={googleCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest border border-outline-variant/15 rounded-2xl py-4 px-6 text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4" opacity="0.1"/>
            <path d="M17.5 7.5H15V6h-1.5v1.5h-3V6H9v1.5H6.5v10h11v-10zM16 16H8v-5h8v5z" fill="#4285F4"/>
          </svg>
          <span className="text-sm font-medium">Google Calendar</span>
          <Icon name="open_in_new" className="text-sm text-outline-variant" />
        </a>

        <a
          href={`${apiUrl}${icsUrl.startsWith('/') ? '' : '/'}${icsUrl.replace(/^https?:\/\/[^/]+/, '')}`}
          download
          className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest border border-outline-variant/15 rounded-2xl py-4 px-6 text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <Icon name="download" className="text-lg text-primary" />
          <span className="text-sm font-medium">Descargar .ics (iPhone / Outlook)</span>
        </a>
      </motion.div>

      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95, duration: 0.4 }}
        className="mt-8"
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="w-full coral-gradient text-white py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold editorial-shadow"
        >
          Volver al inicio
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
