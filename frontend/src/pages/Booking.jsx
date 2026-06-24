import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../components/ui/Icon'
import StepTreatments from '../components/booking/StepTreatments'
import StepAvailability from '../components/booking/StepAvailability'
import StepSummary from '../components/booking/StepSummary'
import BookingSuccess from '../components/booking/BookingSuccess'

const API_URL = import.meta.env.VITE_API_URL || ''

const CATEGORIES = [
  { id: 'cejas', label: 'Cejas', icon: 'visibility' },
  { id: 'pestanas', label: 'Pestañas', icon: 'remove_red_eye' },
  { id: 'rostro', label: 'Rostro', icon: 'spa' },
  { id: 'depilacion', label: 'Depilación', icon: 'content_cut' },
  { id: 'smile', label: 'Smile Gem', icon: 'diamond' },
]

const STEP_LABELS = ['Tratamiento', 'Fecha y hora', 'Resumen']

const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

export default function Booking() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [direction, setDirection] = useState(1)
  const [selectedTreatment, setSelectedTreatment] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)

  const [treatments, setTreatments] = useState([])
  const [loadingTreatments, setLoadingTreatments] = useState(true)
  const [treatmentsError, setTreatmentsError] = useState(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState(null)
  const [bookingError, setBookingError] = useState(null)

  const loadTreatments = useCallback(() => {
    setLoadingTreatments(true)
    setTreatmentsError(null)
    fetch(`${API_URL}/api/treatments`)
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('invalid data')
        setTreatments(data)
      })
      .catch(() => {
        setTreatments([])
        setTreatmentsError('No se pudieron cargar los tratamientos. Comprueba que el servidor esté en marcha.')
      })
      .finally(() => {
        setLoadingTreatments(false)
      })
  }, [])

  useEffect(() => {
    loadTreatments()
  }, [loadTreatments])

  const canAdvance =
    (step === 0 && selectedTreatment) ||
    (step === 1 && selectedDate && selectedTime) ||
    step === 2

  const goNext = useCallback(() => {
    if (!canAdvance || step >= 2) return
    setBookingError(null)
    setDirection(1)
    setStep((s) => s + 1)
  }, [canAdvance, step])

  const goPrev = useCallback(() => {
    if (step <= 0) return
    setBookingError(null)
    setDirection(-1)
    setStep((s) => s - 1)
  }, [step])

  const handleConfirm = useCallback(async ({ clientName, clientEmail, clientPhone }) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setBookingError(null)

    const [hours, minutes] = selectedTime.split(':').map(Number)
    const startTime = new Date(selectedDate)
    startTime.setHours(hours, minutes, 0, 0)

    try {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentId: selectedTreatment.id,
          startTime: startTime.toISOString(),
          clientName,
          clientEmail,
          clientPhone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setBookingError(data.message || 'Este horario ya no está disponible.')
          setDirection(-1)
          setStep(1)
          setSelectedTime(null)
        } else {
          setBookingError(data.details?.join(', ') || data.error || 'Error al crear la reserva.')
        }
        return
      }

      setBookingResult(data)
    } catch {
      setBookingError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, selectedDate, selectedTime, selectedTreatment])

  const handleClose = useCallback(() => {
    navigate('/')
  }, [navigate])

  if (bookingResult) {
    return (
      <div className="min-h-screen bg-background">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl"
        >
          <div className="flex justify-end items-center px-6 h-16 max-w-2xl mx-auto w-full">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
            >
              <Icon name="close" className="text-on-surface" />
            </motion.button>
          </div>
        </motion.header>

        <main className="pt-24 pb-12 px-5 max-w-2xl mx-auto min-h-screen">
          <BookingSuccess bookingData={bookingResult} onClose={handleClose} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl"
      >
        <div className="flex justify-between items-center px-6 h-16 max-w-2xl mx-auto w-full">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={step > 0 ? goPrev : handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <Icon name="arrow_back" className="text-on-surface" />
          </motion.button>

          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === step ? 'w-8 bg-primary' : i < step ? 'w-2 bg-primary/60' : 'w-2 bg-outline-variant/30'
                  }`}
                />
              </div>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <Icon name="close" className="text-on-surface" />
          </motion.button>
        </div>
      </motion.header>

      <main className="pt-24 pb-12 px-5 max-w-2xl mx-auto min-h-screen">
        {bookingError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
          >
            <Icon name="error" className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{bookingError}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {step === 0 && (
            <motion.div
              key="treatments"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {loadingTreatments ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
                </div>
              ) : treatmentsError ? (
                <div className="text-center py-16 px-4">
                  <Icon name="cloud_off" className="text-4xl text-on-surface-variant/50 mb-4" />
                  <p className="text-sm text-on-surface-variant mb-6">{treatmentsError}</p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={loadTreatments}
                    className="px-6 py-3 rounded-2xl bg-primary text-white text-sm font-label font-bold tracking-wide"
                  >
                    Reintentar
                  </motion.button>
                </div>
              ) : (
                <StepTreatments
                  treatments={treatments}
                  categories={CATEGORIES}
                  selectedTreatment={selectedTreatment}
                  onSelect={setSelectedTreatment}
                />
              )}
            </motion.div>
          )}
          {step === 1 && (
            <motion.div
              key="availability"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <StepAvailability
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onSelectDate={setSelectedDate}
                onSelectTime={setSelectedTime}
                treatmentId={selectedTreatment?.id}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div
              key="summary"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <StepSummary
                treatment={selectedTreatment}
                date={selectedDate}
                time={selectedTime}
                onConfirm={handleConfirm}
                isSubmitting={isSubmitting}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {step < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8"
          >
            {step === 0 && !selectedTreatment && treatments.length > 0 && (
              <p className="text-center text-xs text-on-surface-variant mb-3">
                Toca un tratamiento de la lista para continuar
              </p>
            )}
            <motion.button
              whileTap={canAdvance ? { scale: 0.97 } : {}}
              onClick={goNext}
              disabled={!canAdvance}
              className={`w-full flex items-center justify-center gap-2 coral-gradient text-white rounded-2xl py-4 font-label text-sm tracking-widest uppercase font-bold editorial-shadow transition-opacity duration-300 ${
                canAdvance ? 'opacity-100' : 'opacity-35 cursor-not-allowed'
              }`}
            >
              <span>Continuar</span>
              <Icon name="arrow_forward" className="text-lg" />
            </motion.button>
          </motion.div>
        )}
      </main>
    </div>
  )
}
