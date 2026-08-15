import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'
import IntakeAnswers from './IntakeAnswers'
import AssessmentPhotos from './AssessmentPhotos'
import { fetchOwnerBooking } from '../../utils/ownerApi'
import {
  bookingSourceLabel,
  bookingStatusLabel,
  formatEuro,
  formatStudioTime,
  formatStudioWeekday,
} from '../../utils/studioFormat'

const slideVariants = {
  summary: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -16 },
  },
  intake: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 16 },
  },
  photos: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 16 },
  },
}

function mergeBooking(preview, fetched) {
  if (!preview) return fetched
  if (!fetched) return preview
  return { ...preview, ...fetched }
}

function statusClass(status) {
  if (status === 'cancelled') return 'bg-error-container text-error'
  if (status === 'pending_review') return 'bg-tertiary-container/50 text-on-surface'
  return 'bg-primary/15 text-primary'
}

function InfoRow({ icon, label, children }) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr] gap-x-3 items-start">
      <Icon
        name={icon}
        className="text-primary text-xl leading-none w-5 h-5 flex items-center justify-center mt-0.5"
      />
      <div className="min-w-0">
        {label && (
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary leading-none">
            {label}
          </p>
        )}
        <div className={label ? 'mt-1' : ''}>{children}</div>
      </div>
    </div>
  )
}

export default function BookingDetailContent({
  bookingId,
  preview,
  initialView = 'summary',
}) {
  const [fetched, setFetched] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState(initialView)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchOwnerBooking(bookingId)
      .then((res) => {
        if (!cancelled) setFetched(res.booking)
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
  }, [bookingId])

  const booking = useMemo(() => mergeBooking(preview, fetched), [preview, fetched])
  const start = booking?.startTime ? new Date(booking.startTime) : null
  const end = booking?.endTime ? new Date(booking.endTime) : null
  const hasIntake = Boolean(booking?.hasIntake || booking?.intake)
  const hasPhoto = Boolean(booking?.hasPhoto || (booking?.photos && booking.photos.length > 0))
  const google = booking?.source === 'google'
  const priceLabel = formatEuro(booking?.price)

  const backButton = (
    <button
      type="button"
      onClick={() => setView('summary')}
      className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-primary min-h-11 -ml-1 px-1 rounded-xl hover:bg-primary/10"
    >
      <Icon name="arrow_back" className="text-lg" />
      Volver a la cita
    </button>
  )

  return (
    <div className="relative min-h-48">
      <AnimatePresence mode="wait">
        {view === 'intake' ? (
          <motion.div
            key="intake"
            variants={slideVariants.intake}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="space-y-4"
          >
            {backButton}
            <div>
              <h3 className="font-headline text-xl text-on-surface">Cuestionario de aptitud</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {booking?.treatmentName}
                {booking?.clientName ? ` · ${booking.clientName}` : ''}
              </p>
            </div>
            {loading && !booking?.intake ? (
              <p className="text-sm text-on-surface-variant">Cargando cuestionario…</p>
            ) : (
              <IntakeAnswers intake={booking?.intake} />
            )}
          </motion.div>
        ) : view === 'photos' ? (
          <motion.div
            key="photos"
            variants={slideVariants.photos}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="space-y-4"
          >
            {backButton}
            <div>
              <h3 className="font-headline text-xl text-on-surface">Fotos de valoración</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {booking?.treatmentName}
                {booking?.clientName ? ` · ${booking.clientName}` : ''}
              </p>
            </div>
            {loading && !hasPhoto ? (
              <p className="text-sm text-on-surface-variant">Cargando fotos…</p>
            ) : (
              <AssessmentPhotos photos={booking?.photos} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            variants={slideVariants.summary}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="space-y-4"
          >
            <div>
              <h3 className="font-headline text-xl text-on-surface">
                {booking?.clientName || 'Cita'}
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {booking?.treatmentName || 'Tratamiento'}
                {booking?.treatmentTag ? ` · ${booking.treatmentTag}` : ''}
              </p>
            </div>

            {booking?.status && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                  booking.status
                )}`}
              >
                {bookingStatusLabel(booking.status)}
              </span>
            )}

            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-4 py-3.5 space-y-3">
              {start && (
                <InfoRow icon="schedule" label="Horario">
                  <p className="text-base font-medium text-on-surface tabular-nums">
                    {formatStudioTime(start)}
                    {end ? ` – ${formatStudioTime(end)}` : ''}
                  </p>
                  {end && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      Duración · {Math.max(0, Math.round((end - start) / 60000))} min
                    </p>
                  )}
                </InfoRow>
              )}
              {start && (
                <InfoRow icon="calendar_today">
                  <p className="text-xs text-on-surface-variant capitalize">
                    {formatStudioWeekday(start)}
                  </p>
                </InfoRow>
              )}
              {booking?.clientPhone && (
                <InfoRow icon="call">
                  <p className="text-sm text-on-surface">{booking.clientPhone}</p>
                </InfoRow>
              )}
              {booking?.clientEmail && (
                <InfoRow icon="mail">
                  <p className="text-sm text-on-surface break-all">{booking.clientEmail}</p>
                </InfoRow>
              )}
              {priceLabel && (
                <InfoRow icon="payments">
                  <p className="text-sm text-on-surface">{priceLabel}</p>
                </InfoRow>
              )}
              {booking?.source && (
                <InfoRow icon="event">
                  <p className="text-xs text-on-surface-variant">
                    {bookingSourceLabel(booking.source)}
                  </p>
                </InfoRow>
              )}
            </div>

            {google && (
              <div className="flex items-start gap-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 px-4 py-3">
                <Icon name="lock" className="text-on-surface-variant text-lg shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-on-surface">Cita de Google Calendar</p>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Solo lectura aquí. Edítala en Google Calendar.
                  </p>
                </div>
              </div>
            )}

            {hasIntake && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onClick={() => setView('intake')}
                className={`cursor-pointer w-full rounded-2xl px-4 py-3.5 min-h-12 text-sm font-medium flex items-center justify-between gap-3 ${
                  booking?.intakeFlagged
                    ? 'bg-error-container text-error'
                    : 'bg-primary text-on-primary'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon name="assignment" className="text-lg" />
                  {booking?.intakeFlagged ? 'Revisar cuestionario' : 'Ver cuestionario'}
                </span>
                <Icon name="chevron_right" className="text-lg" />
              </motion.button>
            )}

            {hasPhoto && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onClick={() => setView('photos')}
                className="cursor-pointer w-full rounded-2xl px-4 py-3.5 min-h-12 text-sm font-medium flex items-center justify-between gap-3 bg-primary/15 text-primary"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon name="photo_camera" className="text-lg" />
                  Ver fotos
                </span>
                <Icon name="chevron_right" className="text-lg" />
              </motion.button>
            )}

            {!loading && !hasIntake && !hasPhoto && !google && (
              <p className="text-xs text-on-surface-variant">
                Esta cita no incluye cuestionario ni fotos de valoración.
              </p>
            )}

            {error && !fetched && (
              <p className="text-sm text-error">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
