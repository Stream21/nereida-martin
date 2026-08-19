import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'
import IntakeAnswers from './IntakeAnswers'
import AssessmentPhotos from './AssessmentPhotos'
import { fetchOwnerBooking, confirmOwnerBookingReview, rejectOwnerBookingReview } from '../../utils/ownerApi'
import {
  bookingSourceLabel,
  bookingStatusLabel,
  formatEuro,
  formatStudioTime,
  formatStudioWeekday,
  isGoogleBookingSource,
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
  if (status === 'pending_companion') return 'bg-amber-100 text-amber-900'
  if (status === 'google_overlap') return 'bg-amber-100 text-amber-900'
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
  onUpdated,
}) {
  const [fetched, setFetched] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState(initialView)
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [confirmReject, setConfirmReject] = useState(false)

  useEffect(() => {
    let cancelled = false
    const liveGoogle = preview?.liveGoogle || String(bookingId || '').startsWith('gcal:')
    if (liveGoogle) {
      setLoading(false)
      setError('')
      return undefined
    }
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
  }, [bookingId, preview?.liveGoogle])

  const booking = useMemo(() => mergeBooking(preview, fetched), [preview, fetched])
  const start = booking?.startTime ? new Date(booking.startTime) : null
  const end = booking?.endTime ? new Date(booking.endTime) : null
  const hasIntake = Boolean(booking?.hasIntake || booking?.intake)
  const hasPhoto = Boolean(booking?.hasPhoto || (booking?.photos && booking.photos.length > 0))
  const google = isGoogleBookingSource(booking?.source)
  const priceLabel = formatEuro(booking?.price)
  const pendingReview = booking?.status === 'pending_review'
  const numericId = Number(booking?.id || bookingId)

  const handleConfirmReview = async () => {
    if (!Number.isFinite(numericId) || actionLoading) return
    setActionError('')
    setActionLoading('confirm')
    try {
      const res = await confirmOwnerBookingReview(numericId)
      if (res.booking) setFetched(res.booking)
      onUpdated?.(res.booking || { ...booking, status: 'confirmed' })
    } catch (err) {
      setActionError(err.message || 'No se pudo confirmar la cita')
    } finally {
      setActionLoading('')
    }
  }

  const handleRejectReview = async () => {
    if (!Number.isFinite(numericId) || actionLoading) return
    setActionError('')
    setActionLoading('reject')
    try {
      await rejectOwnerBookingReview(numericId)
      onUpdated?.({ ...booking, status: 'cancelled' })
    } catch (err) {
      setActionError(err.message || 'No se pudo cancelar la cita')
      setActionLoading('')
    }
  }

  const reviewActions = pendingReview && !google && (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 space-y-3">
      <p className="text-sm text-on-surface leading-relaxed">
        Solicitud pendiente. Revisa el cuestionario y las fotos, y confirma o descarta la cita aquí.
        El correo solo avisa de que hay un caso que revisar.
      </p>
      {actionError && <p className="text-sm text-error">{actionError}</p>}
      {confirmReject ? (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            Se cancelará la cita y avisaremos a la clienta de que no es apta.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmReject(false)}
              className="cursor-pointer min-h-12 rounded-2xl px-3 text-sm font-medium bg-surface-container-lowest border border-outline-variant/30 text-on-surface"
            >
              Volver
            </button>
            <button
              type="button"
              disabled={Boolean(actionLoading)}
              onClick={handleRejectReview}
              className="cursor-pointer min-h-12 rounded-2xl px-3 text-sm font-medium bg-error-container text-error disabled:opacity-60"
            >
              {actionLoading === 'reject' ? 'Cancelando…' : 'Sí, cancelar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={Boolean(actionLoading)}
            onClick={handleConfirmReview}
            className="cursor-pointer w-full min-h-12 rounded-2xl px-4 text-sm font-medium coral-gradient text-white disabled:opacity-60"
          >
            {actionLoading === 'confirm' ? 'Confirmando…' : 'Confirmar cita'}
          </motion.button>
          <button
            type="button"
            disabled={Boolean(actionLoading)}
            onClick={() => setConfirmReject(true)}
            className="cursor-pointer w-full min-h-12 rounded-2xl px-4 text-sm font-medium bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant disabled:opacity-60"
          >
            No apta · cancelar
          </button>
        </div>
      )}
    </div>
  )

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
            {reviewActions}
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
            {reviewActions}
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

            {booking?.isJoint && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary ml-2">
                <Icon name="group" className="text-sm" />
                Conjunta
              </span>
            )}

            {booking?.jointPartner && (
              <div className="rounded-2xl bg-primary/8 border border-primary/15 px-4 py-3 text-sm text-on-surface">
                <p className="font-medium">
                  {booking.jointRole === 'primary' ? 'Acompañante' : 'Clienta principal'}:{' '}
                  {booking.jointPartner.name}
                </p>
                {booking.jointPartner.treatmentName && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    {booking.jointPartner.treatmentName}
                  </p>
                )}
              </div>
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

            {reviewActions}

            {!loading && !hasIntake && !hasPhoto && !google && !pendingReview && (
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
