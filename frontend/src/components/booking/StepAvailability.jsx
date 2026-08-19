import { useState, useMemo, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { isDateInBlockedPerfiladoWeek, isPerfiladoTreatment } from '../../utils/browDesign'

const API_URL = import.meta.env.VITE_API_URL || ''

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const monthDatesCache = new Map()
const slotsCache = new Map()

function monthCacheKey(treatmentId, year, month, jointQuery) {
  return `${treatmentId}|${year}-${month}|${jointQuery}`
}

function slotsCacheKey(treatmentId, dateStr, jointQuery) {
  return `${treatmentId}|${dateStr}|${jointQuery}`
}

const dayVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
}

export default function StepAvailability({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  treatmentId,
  perfiladoBlockedWeeks = [],
  jointMode = false,
  companionClientId,
  primaryClientId,
  companionTreatmentName,
}) {
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate || new Date())
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingStartDate, setBookingStartDate] = useState(null)
  const [nextSlot, setNextSlot] = useState(null)
  const [loadingNextSlot, setLoadingNextSlot] = useState(() => !!treatmentId)
  const [anchorDay, setAnchorDay] = useState(null)
  const [openDates, setOpenDates] = useState(() => new Set())
  const [loadingMonthDates, setLoadingMonthDates] = useState(
    () => !!treatmentId && (!jointMode || !!companionClientId)
  )
  const pendingTimeRef = useRef(null)
  const initialisedRef = useRef(false)
  const onSelectTimeRef = useRef(onSelectTime)
  const onSelectDateRef = useRef(onSelectDate)
  const loadedDateKeyRef = useRef(null)

  onSelectTimeRef.current = onSelectTime
  onSelectDateRef.current = onSelectDate

  const today = startOfDay(new Date())
  const goLiveDay = bookingStartDate ? startOfDay(new Date(`${bookingStartDate}T12:00:00`)) : today
  const applyPerfiladoSpacing = isPerfiladoTreatment(treatmentId)
  const blockedWeeks = applyPerfiladoSpacing ? perfiladoBlockedWeeks : []
  const hasBlockedWeeks = blockedWeeks.length > 0

  const jointQuery =
    jointMode && companionClientId
      ? `&companionClientId=${companionClientId}${primaryClientId ? `&primaryClientId=${primaryClientId}` : ''}`
      : ''

  const isPerfiladoWeekBlocked = (day) =>
    applyPerfiladoSpacing && isDateInBlockedPerfiladoWeek(day, blockedWeeks)

  useEffect(() => {
    fetch(`${API_URL}/api/settings/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bookingStartDate) setBookingStartDate(data.bookingStartDate)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!treatmentId || jointMode) {
      if (jointMode) {
        setNextSlot(null)
        setLoadingNextSlot(false)
        initialisedRef.current = true
      }
      if (!treatmentId) {
        setNextSlot(null)
        setLoadingNextSlot(false)
        setAnchorDay(null)
        initialisedRef.current = false
      }
      return
    }

    initialisedRef.current = false
    setAnchorDay(null)
    setNextSlot(null)

    let cancelled = false
    setLoadingNextSlot(true)

    fetch(`${API_URL}/api/availability/next?treatmentId=${treatmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.date && data.time) {
          setNextSlot(data)
        } else if (!cancelled) {
          setNextSlot(null)
        }
      })
      .catch(() => {
        if (!cancelled) setNextSlot(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingNextSlot(false)
      })

    return () => { cancelled = true }
  }, [treatmentId, jointMode])

  useEffect(() => {
    if (jointMode) return
    if (loadingNextSlot || !nextSlot?.date || !nextSlot?.time || initialisedRef.current) return

    const [y, m, d] = nextSlot.date.split('-').map(Number)
    const day = startOfDay(new Date(y, m - 1, d))

    // Si el próximo hueco cae en una semana ya reservada de perfilado, no lo preseleccionamos.
    if (applyPerfiladoSpacing && isDateInBlockedPerfiladoWeek(day, blockedWeeks)) {
      initialisedRef.current = true
      setAnchorDay(null)
      return
    }

    initialisedRef.current = true
    setAnchorDay(day)
    pendingTimeRef.current = nextSlot.time
    setCurrentMonth(day)
    onSelectDateRef.current(day)
  }, [loadingNextSlot, nextSlot, blockedWeeks, applyPerfiladoSpacing])

  useEffect(() => {
    if (!selectedDate || !applyPerfiladoSpacing) return
    if (isDateInBlockedPerfiladoWeek(selectedDate, blockedWeeks)) {
      onSelectDateRef.current(null)
      onSelectTimeRef.current(null)
    }
  }, [selectedDate, blockedWeeks, applyPerfiladoSpacing])

  const nextSlotIsBlocked =
    applyPerfiladoSpacing &&
    nextSlot?.date &&
    isDateInBlockedPerfiladoWeek(
      (() => {
        const [y, m, d] = nextSlot.date.split('-').map(Number)
        return new Date(y, m - 1, d)
      })(),
      blockedWeeks
    )

  useEffect(() => {
    if (!selectedDate || !treatmentId || (jointMode && !companionClientId)) {
      setSlots([])
      loadedDateKeyRef.current = null
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const cacheKey = slotsCacheKey(treatmentId, dateStr, jointQuery)
    const dateChanged = loadedDateKeyRef.current !== cacheKey
    if (!dateChanged) return
    loadedDateKeyRef.current = cacheKey

    if (!pendingTimeRef.current) {
      onSelectTimeRef.current(null)
    }

    const cached = slotsCache.get(cacheKey)
    if (cached) {
      setSlots(cached)
      setLoadingSlots(false)
      const pendingTime = pendingTimeRef.current
      if (pendingTime) {
        pendingTimeRef.current = null
        const match = cached.find((s) => s.time === pendingTime && s.available)
        if (match) {
          onSelectTimeRef.current(
            pendingTime,
            jointMode ? { companionTime: match.companionTime } : undefined
          )
        }
      }
      return
    }

    let cancelled = false
    setLoadingSlots(true)

    const availabilityPath = jointMode
      ? `${API_URL}/api/availability/joint?date=${dateStr}&treatmentId=${treatmentId}${jointQuery}`
      : `${API_URL}/api/availability?date=${dateStr}&treatmentId=${treatmentId}`

    fetch(availabilityPath)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const loadedSlots = data.slots || []
        slotsCache.set(cacheKey, loadedSlots)
        setSlots(loadedSlots)
        setLoadingSlots(false)

        const pendingTime = pendingTimeRef.current
        if (pendingTime) {
          pendingTimeRef.current = null
          const match = loadedSlots.find((s) => s.time === pendingTime && s.available)
          if (match) {
            onSelectTimeRef.current(
              pendingTime,
              jointMode ? { companionTime: match.companionTime } : undefined
            )
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([])
          setLoadingSlots(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedDate, treatmentId, jointMode, companionClientId, primaryClientId, jointQuery])

  useEffect(() => {
    if (!treatmentId || (jointMode && !companionClientId)) {
      setOpenDates(new Set())
      setLoadingMonthDates(false)
      return
    }

    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const cacheKey = monthCacheKey(treatmentId, year, month, jointQuery)
    const cached = monthDatesCache.get(cacheKey)

    if (cached) {
      setOpenDates(cached)
      setLoadingMonthDates(false)
    } else {
      setLoadingMonthDates(true)
    }

    let cancelled = false

    const monthPath = jointMode
      ? `${API_URL}/api/availability/joint/month?year=${year}&month=${month}&treatmentId=${treatmentId}${jointQuery}`
      : `${API_URL}/api/availability/month?year=${year}&month=${month}&treatmentId=${treatmentId}`

    const loadMonth = (y, m, { storeOnly = false } = {}) => {
      const key = monthCacheKey(treatmentId, y, m, jointQuery)
      if (storeOnly && monthDatesCache.has(key)) return Promise.resolve()
      const path = jointMode
        ? `${API_URL}/api/availability/joint/month?year=${y}&month=${m}&treatmentId=${treatmentId}${jointQuery}`
        : `${API_URL}/api/availability/month?year=${y}&month=${m}&treatmentId=${treatmentId}`
      return fetch(path)
        .then((res) => res.json())
        .then((data) => {
          const dates = new Set(Array.isArray(data.dates) ? data.dates : [])
          monthDatesCache.set(key, dates)
          return dates
        })
        .catch(() => {
          const empty = new Set()
          monthDatesCache.set(key, empty)
          return empty
        })
    }

    fetch(monthPath)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const dates = new Set(Array.isArray(data.dates) ? data.dates : [])
        monthDatesCache.set(cacheKey, dates)
        setOpenDates(dates)
        const next = new Date(year, month, 1)
        loadMonth(next.getFullYear(), next.getMonth() + 1, { storeOnly: true }).catch(() => {})
      })
      .catch(() => {
        if (!cancelled) setOpenDates(new Set())
      })
      .finally(() => {
        if (!cancelled) setLoadingMonthDates(false)
      })

    return () => { cancelled = true }
  }, [treatmentId, currentMonth, jointMode, companionClientId, primaryClientId, jointQuery])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: es })

  const handleSelectDate = (day) => {
    if (loadingMonthDates) return
    onSelectDate(day)
  }

  const calendarLocked = loadingMonthDates

  const availableSlots = slots.filter((s) => s.available)

  const nextSlotLabel = nextSlot?.date
    ? format(new Date(`${nextSlot.date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })
    : null

  const anchorMonth = anchorDay ? startOfMonth(anchorDay) : null
  const canGoPrevMonth = !anchorMonth || isBefore(anchorMonth, startOfMonth(currentMonth))

  if (loadingNextSlot && !jointMode) {
    return (
      <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin mb-8" />
        <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold mb-3">
          Paso 2 de 3
        </span>
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface mb-3">
          Revisando disponibilidad
        </h2>
        <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
          Calculando la próxima fecha disponible para tu tratamiento…
        </p>
      </div>
    )
  }

  return (
    <div>
      {hasBlockedWeeks && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center"
        >
          <p className="text-sm text-on-surface">
            {jointMode
              ? 'Una de vosotras ya tiene perfilado esta semana. Elige una fecha a partir de la semana siguiente.'
              : 'Ya tienes un perfilado esta semana. Elige una fecha a partir de la semana siguiente.'}
          </p>
        </motion.div>
      )}

      {jointMode && companionTreatmentName && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-primary/8 border border-primary/15 text-center"
        >
          <p className="text-sm text-on-surface">
            Cita conjunta · Acompañante: <strong>{companionTreatmentName}</strong>
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            La cita conjunta dura 1 hora (30 min cada una).
          </p>
        </motion.div>
      )}

      {nextSlot?.date && !nextSlotIsBlocked && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 rounded-2xl bg-primary-container/40 border border-primary/20 text-center"
        >
          <p className="text-sm text-on-surface-variant">
            Próximo hueco disponible:{' '}
            <span className="font-semibold text-on-surface capitalize">
              {nextSlotLabel} a las {nextSlot.time}
            </span>
          </p>
          <p className="text-xs text-on-surface-variant/80 mt-2">
            Puedes elegir esta fecha u otra posterior.
          </p>
        </motion.div>
      )}

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
              type="button"
              onClick={() => canGoPrevMonth && !calendarLocked && setCurrentMonth((m) => subMonths(m, 1))}
              disabled={!canGoPrevMonth || calendarLocked}
              className={`p-2 rounded-full transition-colors ${
                canGoPrevMonth && !calendarLocked ? 'hover:bg-surface-container' : 'opacity-30 cursor-default'
              }`}
            >
              <Icon name="chevron_left" className="text-primary" />
            </button>
            <button
              type="button"
              onClick={() => !calendarLocked && setCurrentMonth((m) => addMonths(m, 1))}
              disabled={calendarLocked}
              className={`p-2 rounded-full transition-colors ${
                calendarLocked ? 'opacity-30 cursor-default' : 'hover:bg-surface-container'
              }`}
            >
              <Icon name="chevron_right" className="text-primary" />
            </button>
          </div>
        </div>

        <div className="relative min-h-[22rem]" aria-busy={calendarLocked}>
          <div
            className={`grid grid-cols-7 gap-y-4 text-center transition-opacity duration-200 ${
              calendarLocked ? 'pointer-events-none opacity-40' : 'opacity-100'
            }`}
          >
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
            const isBeforeAnchor = anchorDay && isBefore(startOfDay(day), anchorDay)
            const isWeekendDay = isWeekend(day)
            const dateStr = format(day, 'yyyy-MM-dd')
            const hasOpenSlots = openDates.has(dateStr)
            const blockedByPerfilado = isPerfiladoWeekBlocked(day)
            const blockedByBusy =
              inMonth &&
              !isPast &&
              !isBeforeGoLive &&
              !isBeforeAnchor &&
              !isWeekendDay &&
              !hasOpenSlots
            const isDisabled =
              calendarLocked ||
              !inMonth ||
              isPast ||
              isBeforeGoLive ||
              isBeforeAnchor ||
              isWeekendDay ||
              blockedByBusy ||
              blockedByPerfilado

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

          <AnimatePresence>
            {calendarLocked && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-background/80 backdrop-blur-[2px]"
              >
                <motion.div
                  className="w-11 h-11 rounded-full border-[3px] border-primary/20 border-t-primary mb-4"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                />
                <p className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold">
                  Cargando
                </p>
                <p className="mt-2 text-sm text-on-surface-variant text-center px-6">
                  Comprobando días libres de este mes…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
            <div className="relative min-h-[10rem] flex flex-col items-center justify-center py-10">
              <motion.div
                className="w-10 h-10 rounded-full border-[3px] border-primary/20 border-t-primary mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
              />
              <p className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold">
                Cargando
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Validando horarios de este día…
              </p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="event_busy" className="text-3xl text-outline-variant/40 mb-3" />
              <p className="text-sm text-on-surface-variant">
                No hay horarios disponibles para este día.
              </p>
              <p className="text-xs text-outline mt-1">
                Las reservas requieren al menos 12 horas de antelación. Prueba con otra fecha.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {slots.map((slot) => {
                const isActive = selectedTime === slot.time
                return (
                  <motion.button
                    key={slot.time}
                    whileTap={slot.available ? { scale: 0.95 } : {}}
                    onClick={() =>
                      slot.available &&
                      onSelectTime(
                        slot.time,
                        jointMode ? { companionTime: slot.companionTime } : undefined
                      )
                    }
                    disabled={!slot.available}
                    className={`py-4 px-6 rounded-xl transition-all ${
                      !slot.available
                        ? 'bg-surface-container-low/50 text-outline/30 cursor-not-allowed line-through'
                        : isActive
                          ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_10px_20px_rgba(183,139,125,0.22)]'
                          : 'border border-outline-variant/20 text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="block">{slot.time}</span>
                    {jointMode && slot.companionTime && slot.available && (
                      <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                        Ella · {slot.companionTime}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}
        </motion.section>
      )}
    </div>
  )
}
