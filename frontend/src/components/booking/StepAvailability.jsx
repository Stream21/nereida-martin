import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
  isWeekend,
} from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../ui/Icon'

const API_URL = import.meta.env.VITE_API_URL || ''

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const dayVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
}

const slotSkeletonVariants = {
  initial: { opacity: 0.4 },
  animate: { opacity: 1, transition: { repeat: Infinity, repeatType: 'reverse', duration: 0.8 } },
}

export default function StepAvailability({ selectedDate, selectedTime, onSelectDate, onSelectTime, treatmentId }) {
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate || new Date())
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingStartDate, setBookingStartDate] = useState(null)

  const today = startOfDay(new Date())
  const goLiveDay = bookingStartDate ? startOfDay(new Date(`${bookingStartDate}T12:00:00`)) : today

  useEffect(() => {
    fetch(`${API_URL}/api/settings/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bookingStartDate) setBookingStartDate(data.bookingStartDate)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedDate || !treatmentId) {
      setSlots([])
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    let cancelled = false

    setLoadingSlots(true)
    onSelectTime(null)

    fetch(`${API_URL}/api/availability?date=${dateStr}&treatmentId=${treatmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots || [])
          setLoadingSlots(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([])
          setLoadingSlots(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedDate, treatmentId])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: es })

  const handleSelectDate = (day) => {
    onSelectDate(day)
  }

  const availableSlots = slots.filter((s) => s.available)
  const unavailableSlots = slots.filter((s) => !s.available)

  return (
    <div>
      <section className="mb-12 text-center">
        <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold block mb-2">
          Paso 2 de 3
        </span>
        <h2 className="font-headline text-3xl md:text-4xl text-on-surface">Disponibilidad</h2>
        <div className="mt-6 flex justify-center gap-2">
          <div className="h-[2px] w-8 bg-primary" />
          <div className="h-[2px] w-12 bg-primary" />
          <div className="h-[2px] w-8 bg-outline-variant/30" />
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-headline text-xl text-on-surface capitalize">{monthLabel}</h3>
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
            >
              <Icon name="chevron_left" className="text-primary" />
            </button>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
            >
              <Icon name="chevron_right" className="text-primary" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-4 text-center">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-[10px] font-bold uppercase tracking-widest text-outline pb-2">
              {day}
            </div>
          ))}

          {calendarDays.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const isPast = isBefore(day, today)
            const isBeforeGoLive = isBefore(day, goLiveDay)
            const isWeekendDay = isWeekend(day)
            const isDisabled = !inMonth || isPast || isBeforeGoLive || isWeekendDay

            return (
              <motion.button
                key={day.toISOString()}
                variants={dayVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: i * 0.008, duration: 0.3 }}
                disabled={isDisabled}
                onClick={() => !isDisabled && handleSelectDate(day)}
                className={`py-3 relative flex items-center justify-center transition-colors ${
                  isDisabled
                    ? 'text-outline/30 cursor-default'
                    : 'hover:text-primary cursor-pointer'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="calendar-highlight"
                    className="absolute inset-0 m-auto w-10 h-10 bg-primary-container rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    isSelected ? 'text-on-primary-container font-bold' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </motion.button>
            )
          })}
        </div>
      </section>

      {selectedDate && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-16"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-outline-variant/20" />
            <h3 className="font-headline text-lg italic text-on-surface">Horarios Disponibles</h3>
            <div className="h-px flex-1 bg-outline-variant/20" />
          </div>

          {loadingSlots ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  variants={slotSkeletonVariants}
                  initial="initial"
                  animate="animate"
                  className="py-4 px-6 rounded-xl bg-surface-container-low"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="event_busy" className="text-3xl text-outline-variant/40 mb-3" />
              <p className="text-sm text-on-surface-variant">
                No hay horarios disponibles para este día.
              </p>
              <p className="text-xs text-outline mt-1">Prueba con otra fecha.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {slots.map((slot) => {
                const isActive = selectedTime === slot.time
                return (
                  <motion.button
                    key={slot.time}
                    whileTap={slot.available ? { scale: 0.95 } : {}}
                    onClick={() => slot.available && onSelectTime(slot.time)}
                    disabled={!slot.available}
                    className={`py-4 px-6 rounded-xl transition-all ${
                      !slot.available
                        ? 'bg-surface-container-low/50 text-outline/30 cursor-not-allowed line-through'
                        : isActive
                          ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_10px_20px_rgba(183,139,125,0.22)]'
                          : 'border border-outline-variant/20 text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {slot.time}
                  </motion.button>
                )
              })}
            </div>
          )}
        </motion.section>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="mt-20 aspect-video overflow-hidden rounded-2xl shadow-sm"
      >
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA528J5f74nF24GwbMtzysmHLLiJ95dxSp4gnTRo6w5ARq9XqcjoSqJStItg1yt-cxJXFVUk53oiq6-EgB5fbvWf8iG0Sw8gCsCuN-cEZlNCJV3KU8LQXAqKl6lFkyj02Ru4Z_IrST_NODWZQe2imMBTiLdAVgTjOLGPL6dYobH3B7DdRCJvJxNsaTcqsiD2tpd2lOfkK0w-WKzuqUfe-u1uXT-DrXTUXfg2Ux2PzeF28H97Nr7_yUdcMoYXzVQVDEeIcfgr8lqfNs"
          alt="Smooth river stones and dried lavender on linen"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </motion.div>
    </div>
  )
}
