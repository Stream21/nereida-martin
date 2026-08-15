import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'
import BookingDetailContent from './BookingDetailContent'
import AssessmentPhotos from './AssessmentPhotos'
import { fetchClient } from '../../utils/ownerApi'
import {
  bookingStatusLabel,
  formatEuro,
  formatStudioDateTime,
} from '../../utils/studioFormat'

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
}

const viewVariants = {
  list: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
  },
  detail: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 12 },
  },
}

function statusClass(status) {
  if (status === 'cancelled') return 'bg-error-container text-error'
  if (status === 'pending_review') return 'bg-tertiary-container/50 text-on-surface'
  return 'bg-primary/15 text-primary'
}

export default function ClientHistoryModal({ clientId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [client, setClient] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClient(clientId)
      .then((res) => {
        if (!cancelled) setClient(res.client)
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

  const history = client?.history || []
  const photos = client?.photos || []
  const unlinkedPhotos = photos.filter((p) => !p.bookingId)

  const detailView = selected?.openPhotos ? 'photos' : selected?.openIntake ? 'intake' : 'summary'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-surface/35 backdrop-blur-[2px] p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(67,61,60,0.14)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/20 bg-surface-container-lowest/95 backdrop-blur-sm">
          <div className="min-w-0 flex items-center gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="cursor-pointer p-2 min-h-11 min-w-11 rounded-full hover:bg-surface-container -ml-2"
                aria-label="Volver al historial"
              >
                <Icon name="arrow_back" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-headline text-lg text-on-surface truncate">
                {selected ? 'Detalle de la cita' : 'Historial de citas'}
              </h3>
              {client?.name && (
                <p className="text-xs text-on-surface-variant truncate">{client.name}</p>
              )}
            </div>
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

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Cargando historial…</p>
          ) : error ? (
            <p className="text-sm text-error">{error}</p>
          ) : (
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={`detail-${selected.id}`}
                  variants={viewVariants.detail}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <BookingDetailContent
                    bookingId={selected.id}
                    preview={selected}
                    initialView={detailView}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  variants={viewVariants.list}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  {history.length === 0 && unlinkedPhotos.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Sin citas registradas.</p>
                  ) : (
                    <div className="space-y-5">
                      {unlinkedPhotos.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                            Fotos enviadas
                          </p>
                          <AssessmentPhotos photos={unlinkedPhotos} />
                        </div>
                      )}
                      {history.length > 0 && (
                    <motion.ul
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-3"
                    >
                      {history.map((booking) => {
                        const priceLabel = formatEuro(booking.price)
                        return (
                          <motion.li
                            key={booking.id}
                            variants={cardVariants}
                            className="rounded-3xl border border-outline-variant/25 bg-surface-container-low p-4 shadow-[0_8px_24px_rgba(183,139,125,0.08)]"
                          >
                            <button
                              type="button"
                              onClick={() => setSelected({ ...booking, openIntake: false })}
                              className="cursor-pointer w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-headline text-lg text-on-surface leading-tight">
                                    {booking.treatmentName || 'Cita'}
                                  </p>
                                  {booking.treatmentTag && (
                                    <p className="text-xs text-on-surface-variant mt-0.5">
                                      {booking.treatmentTag}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium ${statusClass(
                                    booking.status
                                  )}`}
                                >
                                  {bookingStatusLabel(booking.status)}
                                </span>
                              </div>

                              <p className="text-sm text-on-surface-variant mt-3 tabular-nums">
                                {formatStudioDateTime(booking.startTime)}
                              </p>
                              {priceLabel && (
                                <p className="text-sm text-primary mt-1">{priceLabel}</p>
                              )}
                            </button>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {booking.hasIntake && (
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.96 }}
                                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                                  onClick={() => setSelected({ ...booking, openIntake: true })}
                                  className={`cursor-pointer inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium min-h-11 ${
                                    booking.intakeFlagged
                                      ? 'bg-error-container text-error'
                                      : 'bg-primary/15 text-primary'
                                  }`}
                                >
                                  <Icon name="assignment" className="text-sm" />
                                  {booking.intakeFlagged ? 'Revisar cuestionario' : 'Cuestionario'}
                                </motion.button>
                              )}
                              {booking.hasPhoto && (
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.96 }}
                                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                                  onClick={() => setSelected({ ...booking, openPhotos: true })}
                                  className="cursor-pointer inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium min-h-11 bg-primary/15 text-primary"
                                >
                                  <Icon name="photo_camera" className="text-sm" />
                                  Fotos
                                </motion.button>
                              )}
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.96 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                                onClick={() => setSelected({ ...booking, openIntake: false })}
                                className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary ml-auto min-h-11 px-2 rounded-xl hover:bg-primary/10"
                              >
                                Ver cita
                                <Icon name="chevron_right" className="text-base" />
                              </motion.button>
                            </div>
                          </motion.li>
                        )
                      })}
                    </motion.ul>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
