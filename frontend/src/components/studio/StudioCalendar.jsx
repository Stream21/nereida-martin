import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  getHours,
  getMinutes,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../ui/Icon'
import BookingDetailModal from './BookingDetailModal'
import {
  createOwnerBooking,
  fetchClients,
  fetchOwnerAvailability,
  fetchOwnerCalendar,
  fetchOwnerTreatments,
} from '../../utils/ownerApi'

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V']
const WEEKDAY_MED = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const HOUR_START = 10
const HOUR_END = 18
const PX_PER_HOUR = 56

/** Studio work windows in minutes from midnight (matches backend studioHours). */
function workWindowsForDay(day) {
  const afternoonEnd = day.getDay() === 5 ? 17 : 18 // viernes cierra a las 17:00
  return [
    { start: 10 * 60, end: 14 * 60 },
    { start: 15 * 60, end: afternoonEnd * 60 },
  ]
}

function minsToLabel(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function treatmentDurationMin(t) {
  return t.durationMax || t.durationMin || 60
}

function formatDurationLabel(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const r = minutes % 60
    return r > 0 ? `${h}h ${r} min` : `${h} h`
  }
  return `${minutes} min`
}

/** Free intervals within work windows minus booked events. */
function freeGapsForDay(day, dayEvents) {
  const busy = dayEvents
    .map((ev) => ({
      start: getHours(new Date(ev.startTime)) * 60 + getMinutes(new Date(ev.startTime)),
      end: getHours(new Date(ev.endTime)) * 60 + getMinutes(new Date(ev.endTime)),
    }))
    .sort((a, b) => a.start - b.start)

  const gaps = []
  for (const win of workWindowsForDay(day)) {
    let cursor = win.start
    const relevant = busy.filter((b) => b.end > win.start && b.start < win.end)
    for (const b of relevant) {
      const bStart = Math.max(b.start, win.start)
      const bEnd = Math.min(b.end, win.end)
      if (bStart > cursor) {
        gaps.push({ start: cursor, end: bStart })
      }
      cursor = Math.max(cursor, bEnd)
    }
    if (cursor < win.end) {
      gaps.push({ start: cursor, end: win.end })
    }
  }
  return gaps.filter((g) => g.end - g.start >= 15)
}

function isClosedHour(hour, day) {
  // 14:00–15:00 lunch; viernes 17:00–18:00 cerrado
  if (hour === 14) return true
  if (day?.getDay() === 5 && hour >= 17) return true
  return false
}

function weekdayIndex(day) {
  // Mon=0 … Fri=4; Sat/Sun → -1
  const d = day.getDay()
  if (d === 0 || d === 6) return -1
  return d - 1
}

function startOfWorkWeek(date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

function endOfWorkWeek(date) {
  return addDays(startOfWorkWeek(date), 4)
}

/** Mon–Fri only for the week containing `date`. */
function workWeekDays(date) {
  const start = startOfWorkWeek(date)
  return eachDayOfInterval({ start, end: addDays(start, 4) })
}

/** Calendar cells for month view: only Mon–Fri rows (no weekend columns). */
function workMonthDays(anchor) {
  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)
  const gridStart = startOfWorkWeek(monthStart)
  const gridEnd = endOfWorkWeek(monthEnd)
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).filter(
    (d) => weekdayIndex(d) >= 0
  )
}

/** If date falls on weekend, snap to previous Friday (or next Monday if preferred). */
function snapToWorkday(date) {
  const d = startOfDay(date)
  const idx = weekdayIndex(d)
  if (idx >= 0) return d
  if (d.getDay() === 6) return addDays(d, -1) // Sat → Fri
  return addDays(d, 1) // Sun → Mon
}

function toIsoRange(fromDate, toDate) {
  return {
    from: startOfDay(fromDate).toISOString(),
    to: addDays(startOfDay(toDate), 1).toISOString(),
  }
}

function isGoogleEvent(ev) {
  return ev?.source === 'google'
}

function formatRange(ev) {
  return `${format(new Date(ev.startTime), 'HH:mm')} – ${format(new Date(ev.endTime), 'HH:mm')}`
}

function hoursList() {
  const h = []
  for (let i = HOUR_START; i < HOUR_END; i++) h.push(i)
  return h
}

function eventLayout(ev) {
  const start = new Date(ev.startTime)
  const end = new Date(ev.endTime)
  const startMin = getHours(start) * 60 + getMinutes(start)
  const endMin = getHours(end) * 60 + getMinutes(end)
  const gridStart = HOUR_START * 60
  const gridEnd = HOUR_END * 60
  const clampedStart = Math.max(startMin, gridStart)
  const clampedEnd = Math.min(endMin, gridEnd)
  if (clampedEnd <= clampedStart) return null
  const top = ((clampedStart - gridStart) / 60) * PX_PER_HOUR
  const height = Math.max(22, ((clampedEnd - clampedStart) / 60) * PX_PER_HOUR - 2)
  return { top, height }
}

/** Assign side-by-side columns for overlapping events (Google/Apple style). */
function layoutOverlaps(dayEvents) {
  const items = dayEvents
    .map((ev) => {
      const layout = eventLayout(ev)
      if (!layout) return null
      return { ev, ...layout, start: new Date(ev.startTime).getTime(), end: new Date(ev.endTime).getTime() }
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const columnEnds = []
  for (const item of items) {
    let col = columnEnds.findIndex((end) => end <= item.start)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(item.end)
    } else {
      columnEnds[col] = item.end
    }
    item.col = col
  }
  const colCount = Math.max(1, columnEnds.length)
  return items.map((item) => ({
    ...item,
    colCount,
    leftPct: (item.col / colCount) * 100,
    widthPct: 100 / colCount,
  }))
}

function CreateBookingModal({ initialDate, initialTime, gapStart, gapEnd, onClose, onCreated }) {
  const [treatments, setTreatments] = useState([])
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(null)
  const [treatmentId, setTreatmentId] = useState('')
  const [date, setDate] = useState(initialDate ? format(initialDate, 'yyyy-MM-dd') : '')
  const [slots, setSlots] = useState([])
  const [time, setTime] = useState(initialTime || (gapStart != null ? minsToLabel(gapStart) : ''))
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const gapMinutes = gapStart != null && gapEnd != null ? gapEnd - gapStart : null
  const hasGap = gapMinutes != null && gapMinutes > 0
  const lockedTime = hasGap ? initialTime || minsToLabel(gapStart) : null

  const treatmentsWithFit = useMemo(() => {
    return treatments
      .map((t) => {
        const duration = treatmentDurationMin(t)
        const fits = !hasGap || duration <= gapMinutes
        return { ...t, duration, fits }
      })
      .sort((a, b) => {
        if (a.fits !== b.fits) return a.fits ? -1 : 1
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      })
  }, [treatments, hasGap, gapMinutes])

  useEffect(() => {
    fetchOwnerTreatments()
      .then((res) => {
        const list = res.treatments || []
        setTreatments(list)
        const sorted = [...list]
          .map((t) => ({
            ...t,
            fits: !hasGap || treatmentDurationMin(t) <= gapMinutes,
          }))
          .sort((a, b) => {
            if (a.fits !== b.fits) return a.fits ? -1 : 1
            return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
          })
        const preferred = sorted.find((t) => t.fits)
        if (preferred) setTreatmentId(preferred.id)
      })
      .catch((err) => setError(err.message))
  }, [hasGap, gapMinutes])

  useEffect(() => {
    const t = setTimeout(() => {
      fetchClients({ search: clientSearch, page: 1, limit: 15, status: 'active' })
        .then((res) => setClients(res.clients || []))
        .catch(() => setClients([]))
    }, 250)
    return () => clearTimeout(t)
  }, [clientSearch])

  useEffect(() => {
    if (hasGap && lockedTime) {
      setTime(lockedTime)
      setSlots([])
      setLoadingSlots(false)
      return
    }
    if (!date || !treatmentId) {
      setSlots([])
      return
    }
    let cancelled = false
    setLoadingSlots(true)
    fetchOwnerAvailability({ date, treatmentId })
      .then((res) => {
        if (cancelled) return
        const available = (res.slots || []).filter((s) => s.available)
        setSlots(available)
        if (initialTime && available.some((s) => s.time === initialTime)) {
          setTime(initialTime)
        } else if (available.length === 1) {
          setTime(available[0].time)
        } else if (time && !available.some((s) => s.time === time)) {
          setTime(available[0]?.time || '')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when date/treatment/gap change
  }, [date, treatmentId, initialTime, hasGap, lockedTime])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const bookingTime = hasGap ? lockedTime : time
    if (!clientId || !treatmentId || !date || !bookingTime) {
      setError('Selecciona cliente, tratamiento, fecha y hora')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createOwnerBooking({ clientId, treatmentId, date, time: bookingTime })
      onCreated?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedFits =
    !hasGap ||
    treatmentsWithFit.find((t) => t.id === treatmentId)?.fits !== false
  const canSubmit = selectedFits && (hasGap ? !!lockedTime : !!time)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-surface/35 backdrop-blur-[2px] p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(67,61,60,0.14)] p-5 sm:p-6 space-y-4 safe-pb"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-xl text-on-surface">Nueva cita</h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-2.5 min-h-11 min-w-11 rounded-full hover:bg-surface-container"
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
        </div>

        {hasGap && (
          <div className="rounded-2xl bg-primary/8 border border-primary/15 px-4 py-3">
            <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Hueco libre
            </p>
            <p className="text-sm font-medium text-on-surface mt-0.5">
              {minsToLabel(gapStart)} – {minsToLabel(gapEnd)}
              <span className="text-on-surface-variant font-normal">
                {' '}
                · {formatDurationLabel(gapMinutes)}
              </span>
            </p>
          </div>
        )}

        <label className="block">
          <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Cliente
          </span>
          <input
            type="search"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Buscar clienta activa…"
            className="mt-1.5 w-full rounded-2xl border border-outline-variant/40 bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
            {clients.length === 0 ? (
              <p className="text-xs text-on-surface-variant px-1 py-2">
                Solo aparecen clientas con cuenta activa. Invítala o actívala en Clientes.
              </p>
            ) : (
              clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setClientId(c.id)
                  setClientSearch(c.name)
                }}
                className={`cursor-pointer w-full text-left rounded-xl px-3 py-2.5 text-sm min-h-11 ${
                  clientId === c.id ? 'bg-primary/12 text-primary font-medium' : 'hover:bg-surface-container-low'
                }`}
              >
                {c.name}
                {c.phone ? <span className="text-on-surface-variant"> · {c.phone}</span> : null}
              </button>
              ))
            )}
          </div>
        </label>

        {/* Fecha + hora juntos */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Fecha
            </span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-outline-variant/40 bg-background px-3 py-3 text-sm outline-none focus:border-primary min-h-11"
            />
          </label>
          <div className="min-w-0">
            <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Hora
            </span>
            {hasGap ? (
              <p className="mt-1.5 flex items-center min-h-11 rounded-2xl border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-sm font-medium tabular-nums text-on-surface">
                {lockedTime}
              </p>
            ) : loadingSlots ? (
              <p className="mt-1.5 text-sm text-on-surface-variant min-h-11 flex items-center">
                Cargando…
              </p>
            ) : slots.length === 0 ? (
              <p className="mt-1.5 text-sm text-on-surface-variant min-h-11 flex items-center">
                Sin huecos
              </p>
            ) : (
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-outline-variant/40 bg-background px-3 py-3 text-sm outline-none focus:border-primary min-h-11"
              >
                <option value="">Elige…</option>
                {slots.map((s) => (
                  <option key={s.time} value={s.time}>
                    {s.time}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Tratamiento
          </span>
          <div className="mt-2 space-y-1.5 max-h-52 overflow-y-auto">
            {treatmentsWithFit.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!t.fits}
                onClick={() => t.fits && setTreatmentId(t.id)}
                className={`w-full text-left rounded-2xl px-3.5 py-3 min-h-11 border transition-colors ${
                  !t.fits
                    ? 'opacity-50 cursor-not-allowed border-outline-variant/25 bg-surface-container-low'
                    : treatmentId === t.id
                      ? 'cursor-pointer border-primary/40 bg-primary/10 text-on-surface'
                      : 'cursor-pointer border-outline-variant/30 hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${!t.fits ? 'text-on-surface-variant' : ''}`}>
                      {t.name}
                      {!t.active ? (
                        <span className="text-on-surface-variant font-normal"> · manual</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {formatDurationLabel(t.duration)}
                      {!t.fits && hasGap
                        ? ` · no cabe en ${formatDurationLabel(gapMinutes)}`
                        : null}
                    </p>
                  </div>
                  {treatmentId === t.id && t.fits && (
                    <Icon name="check" className="text-primary text-lg shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="cursor-pointer w-full rounded-2xl bg-primary text-on-primary py-3.5 min-h-12 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? 'Creando…' : 'Confirmar cita'}
        </button>
      </form>
    </div>
  )
}


/**
 * Timed grid shared by Day (1 col) and Week (5 cols) — Apple/Google Calendar layout.
 */
function TimedGrid({ days, events, onSlotClick, onEventClick, compact }) {
  const hours = hoursList()
  const gridHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR
  const gridStartMins = HOUR_START * 60

  return (
    <div className="flex flex-col bg-surface-container-lowest border border-outline-variant/20 rounded-none sm:rounded-2xl overflow-hidden">
      {/* Day headers — sticky */}
      <div className="flex border-b border-outline-variant/20 bg-surface-container-lowest sticky top-0 z-20">
        <div className="w-12 sm:w-14 shrink-0 border-r border-outline-variant/15" aria-hidden />
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const today = isToday(day)
            const wIdx = weekdayIndex(day)
            return (
              <div
                key={day.toISOString()}
                className="flex flex-col items-center justify-center py-2 sm:py-2.5 border-r border-outline-variant/10 last:border-r-0"
              >
                <span
                  className={`text-[10px] sm:text-[11px] font-label uppercase tracking-wide ${
                    today ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  {compact ? WEEKDAY_SHORT[wIdx] : WEEKDAY_MED[wIdx]}
                </span>
                <span
                  className={`mt-0.5 flex items-center justify-center text-sm sm:text-base font-medium tabular-nums w-7 h-7 sm:w-8 sm:h-8 rounded-full ${
                    today ? 'bg-primary text-on-primary' : 'text-on-surface'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable time body */}
      <div className="overflow-y-auto overscroll-contain max-h-[min(68dvh,640px)] sm:max-h-[min(72dvh,720px)]">
        <div className="flex relative" style={{ height: gridHeight }}>
          {/* Hour labels — top of each hour row (not centered on the line) */}
          <div className="w-12 sm:w-14 shrink-0 relative border-r border-outline-variant/15 bg-surface-container-lowest z-10">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1 sm:right-2 text-[10px] sm:text-[11px] tabular-nums leading-none text-on-surface-variant pointer-events-none"
                style={{ top: (h - HOUR_START) * PX_PER_HOUR + 4 }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div
            className="flex-1 grid relative"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {/* Horizontal hour lines */}
            {hours.map((h) => (
              <div
                key={`line-${h}`}
                className="absolute left-0 right-0 border-t border-outline-variant/15 pointer-events-none"
                style={{ top: (h - HOUR_START) * PX_PER_HOUR }}
              />
            ))}
            {/* Half-hour guides (subtle) */}
            {hours.map((h) => (
              <div
                key={`half-${h}`}
                className="absolute left-0 right-0 border-t border-outline-variant/8 pointer-events-none"
                style={{ top: (h - HOUR_START) * PX_PER_HOUR + PX_PER_HOUR / 2 }}
              />
            ))}

            {days.map((day) => {
              const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), day))
              const laidOut = layoutOverlaps(dayEvents)
              const gaps = freeGapsForDay(day, dayEvents)

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-outline-variant/10 last:border-r-0 ${
                    isToday(day) ? 'bg-primary/[0.03]' : ''
                  }`}
                >
                  {/* Closed hours (comida / viernes desde 17:00) — not clickable */}
                  {hours.filter((h) => isClosedHour(h, day)).map((h) => (
                    <div
                      key={`closed-${h}`}
                      aria-hidden
                      className="absolute left-0 right-0 pointer-events-none z-0"
                      style={{
                        top: (h - HOUR_START) * PX_PER_HOUR,
                        height: PX_PER_HOUR,
                        background:
                          'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(67,61,60,0.04) 4px, rgba(67,61,60,0.04) 8px)',
                      }}
                    />
                  ))}

                  {/* Free gaps — only clickable create zones */}
                  {gaps.map((gap) => {
                    const top = ((gap.start - gridStartMins) / 60) * PX_PER_HOUR
                    const height = Math.max(18, ((gap.end - gap.start) / 60) * PX_PER_HOUR - 2)
                    const label = `${minsToLabel(gap.start)} – ${minsToLabel(gap.end)}`
                    const showLabel = height >= 28
                    return (
                      <button
                        key={`gap-${gap.start}-${gap.end}`}
                        type="button"
                        aria-label={`Hueco libre ${label}`}
                        onClick={() =>
                          onSlotClick(day, minsToLabel(gap.start), {
                            gapStart: gap.start,
                            gapEnd: gap.end,
                          })
                        }
                        className="cursor-pointer absolute left-0.5 right-0.5 z-0 rounded-md border border-dashed border-primary/25 bg-primary/[0.04] hover:bg-primary/[0.09] active:bg-primary/12 transition-colors text-left px-1 overflow-hidden"
                        style={{ top, height }}
                      >
                        {showLabel && (
                          <span
                            className={`block text-primary/80 font-medium leading-tight truncate ${
                              days.length > 1 ? 'text-[8px] sm:text-[9px]' : 'text-[10px] sm:text-[11px]'
                            }`}
                          >
                            {label}
                            {height >= 40 && days.length === 1 ? (
                              <span className="font-normal opacity-80"> Disponible</span>
                            ) : null}
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {laidOut.map(({ ev, top, height, leftPct, widthPct }) => {
                    const google = isGoogleEvent(ev)
                    const narrow = days.length > 1 && widthPct < 50
                    const showEnd = height > 40 && !narrow
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(ev)
                        }}
                        title={`${formatRange(ev)} · ${ev.clientName} · ${ev.treatmentName}${
                          ev.hasIntake
                            ? ev.intakeFlagged
                              ? ' · Revisar cuestionario'
                              : ' · Cuestionario'
                            : ''
                        }${ev.hasPhoto ? ' · Fotos' : ''}`}
                        className={`cursor-pointer absolute z-[2] rounded-md sm:rounded-lg px-1 sm:px-1.5 py-0.5 text-left overflow-hidden border transition-shadow hover:z-[3] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                          google
                            ? 'bg-surface-container border-outline-variant/40 text-on-surface-variant'
                            : 'bg-primary/90 border-primary/30 text-on-primary'
                        }`}
                        style={{
                          top,
                          height,
                          left: `calc(${leftPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                        }}
                      >
                        <div className="flex items-start gap-0.5 min-w-0">
                          {google && (
                            <Icon name="lock" className="text-[10px] sm:text-xs shrink-0 mt-0.5 opacity-80" />
                          )}
                          {!google && ev.hasIntake && (
                            <Icon
                              name={ev.intakeFlagged ? 'warning' : 'assignment'}
                              className="text-[10px] sm:text-xs shrink-0 mt-0.5 opacity-90"
                            />
                          )}
                          {!google && ev.hasPhoto && !ev.hasIntake && (
                            <Icon
                              name="photo_camera"
                              className="text-[10px] sm:text-xs shrink-0 mt-0.5 opacity-90"
                            />
                          )}
                          <div className="min-w-0 flex-1 leading-tight">
                            <p
                              className={`font-semibold truncate ${
                                narrow ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'
                              }`}
                            >
                              {showEnd
                                ? formatRange(ev)
                                : format(new Date(ev.startTime), 'HH:mm')}
                              {!narrow && (
                                <span className="font-normal opacity-90">
                                  {' '}
                                  {ev.clientName}
                                </span>
                              )}
                            </p>
                            {!narrow && height > 36 && (
                              <p className="text-[9px] sm:text-[10px] opacity-90 truncate mt-0.5">
                                {ev.treatmentName}
                              </p>
                            )}
                            {narrow && height > 28 && (
                              <p className="text-[8px] sm:text-[9px] opacity-90 truncate">
                                {ev.clientName}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthGrid({ monthDays, anchor, countsByDay, onOpenDay }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-none sm:rounded-2xl overflow-hidden">
      <div className="grid grid-cols-5 border-b border-outline-variant/15">
        {WEEKDAY_SHORT.map((d, i) => (
          <div
            key={d}
            className="py-2 text-center text-[10px] sm:text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant"
          >
            <span className="sm:hidden">{d}</span>
            <span className="hidden sm:inline">{WEEKDAY_MED[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 auto-rows-fr">
        {monthDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const count = countsByDay.get(key) || 0
          const inMonth = isSameMonth(day, anchor)
          const today = isToday(day)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpenDay(day)}
              className={`cursor-pointer min-h-[3.25rem] sm:min-h-[4.75rem] p-1 sm:p-1.5 flex flex-col items-center border-r border-b border-outline-variant/10 transition-colors ${
                inMonth ? 'hover:bg-primary/[0.06] active:bg-primary/10' : 'opacity-35'
              } ${today ? 'bg-primary/[0.06]' : ''}`}
            >
              <span
                className={`inline-flex items-center justify-center text-xs sm:text-sm tabular-nums w-6 h-6 sm:w-7 sm:h-7 rounded-full ${
                  today ? 'bg-primary text-on-primary font-semibold' : 'text-on-surface'
                }`}
              >
                {format(day, 'd')}
              </span>
              {count > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-0.5 px-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary" />
                  ))}
                  {count > 3 && (
                    <span className="text-[8px] text-on-surface-variant leading-none">+{count - 3}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StudioCalendar() {
  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(() => snapToWorkday(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createModal, setCreateModal] = useState(null)
  const [detailEvent, setDetailEvent] = useState(null)

  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor }
    if (view === 'week') {
      return {
        from: startOfWorkWeek(anchor),
        to: endOfWorkWeek(anchor),
      }
    }
    const monthStart = startOfMonth(anchor)
    const monthEnd = endOfMonth(anchor)
    return {
      from: startOfWorkWeek(monthStart),
      to: endOfWorkWeek(monthEnd),
    }
  }, [view, anchor])

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const { from, to } = toIsoRange(range.from, range.to)
    fetchOwnerCalendar({ from, to })
      .then((res) => setEvents(res.events || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  const title = useMemo(() => {
    if (view === 'day') return format(anchor, 'EEE d MMM', { locale: es })
    if (view === 'week') {
      return `${format(range.from, 'd')} – ${format(range.to, "d MMM yyyy", { locale: es })}`
    }
    return format(anchor, 'MMMM yyyy', { locale: es })
  }, [view, anchor, range])

  const goPrev = () => {
    if (view === 'day') {
      setAnchor((d) => {
        const prev = addDays(d, -1)
        return weekdayIndex(prev) >= 0 ? prev : addDays(d, -3) // Mon → prev Fri
      })
    } else if (view === 'week') setAnchor((d) => snapToWorkday(subWeeks(d, 1)))
    else setAnchor((d) => snapToWorkday(subMonths(d, 1)))
  }

  const goNext = () => {
    if (view === 'day') {
      setAnchor((d) => {
        const next = addDays(d, 1)
        return weekdayIndex(next) >= 0 ? next : addDays(d, 3) // Fri → next Mon
      })
    } else if (view === 'week') setAnchor((d) => snapToWorkday(addWeeks(d, 1)))
    else setAnchor((d) => snapToWorkday(addMonths(d, 1)))
  }

  const weekDays = useMemo(() => workWeekDays(anchor), [anchor])

  const monthDays = useMemo(() => workMonthDays(anchor), [anchor])

  const countsByDay = useMemo(() => {
    const map = new Map()
    for (const ev of events) {
      const key = format(new Date(ev.startTime), 'yyyy-MM-dd')
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [events])

  const openDay = (day) => {
    setAnchor(snapToWorkday(day))
    setView('day')
  }

  const onSlotClick = (day, time, gapMeta = null) => {
    setDetailEvent(null)
    setCreateModal({
      date: day,
      time,
      gapStart: gapMeta?.gapStart ?? null,
      gapEnd: gapMeta?.gapEnd ?? null,
    })
  }

  const onEventClick = (ev) => {
    setCreateModal(null)
    setDetailEvent(ev)
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Toolbar — compact on iPhone */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-0">
        <div className="flex items-center min-w-0 flex-1 gap-0.5">
          <button
            type="button"
            onClick={goPrev}
            className="cursor-pointer p-2 min-h-11 min-w-11 rounded-full hover:bg-surface-container shrink-0"
            aria-label="Anterior"
          >
            <Icon name="chevron_left" />
          </button>
          <h2 className="font-headline text-base sm:text-xl text-on-surface capitalize truncate text-center flex-1">
            {title}
          </h2>
          <button
            type="button"
            onClick={goNext}
            className="cursor-pointer p-2 min-h-11 min-w-11 rounded-full hover:bg-surface-container shrink-0"
            aria-label="Siguiente"
          >
            <Icon name="chevron_right" />
          </button>
        </div>

          <button
            type="button"
            onClick={() => setAnchor(snapToWorkday(new Date()))}
            className="cursor-pointer text-xs font-semibold text-primary px-2.5 py-2 min-h-11 rounded-xl hover:bg-primary/10 shrink-0"
          >
            Hoy
          </button>
        <button
          type="button"
          onClick={() => setCreateModal({ date: anchor, time: null, gapStart: null, gapEnd: null })}
          className="cursor-pointer inline-flex items-center justify-center gap-0.5 rounded-xl bg-primary text-on-primary p-2.5 sm:px-3.5 sm:py-2 min-h-11 min-w-11 sm:min-w-0 text-xs font-medium shrink-0"
          aria-label="Nueva cita"
        >
          <Icon name="add" className="text-lg" />
          <span className="hidden sm:inline">Cita</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 sm:px-0">
        <div className="inline-flex rounded-xl bg-surface-container-low p-0.5 w-full sm:w-auto">
          {[
            { id: 'day', label: 'Día' },
            { id: 'week', label: 'Semana' },
            { id: 'month', label: 'Mes' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`cursor-pointer flex-1 sm:flex-none px-3 py-2 min-h-10 rounded-[10px] text-xs font-medium transition-colors ${
                view === v.id
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <p className="hidden sm:flex text-xs text-on-surface-variant items-center gap-1.5">
        <Icon name="lock" className="text-sm" />
        Google: solo lectura. Toca un hueco libre (línea discontinua) para crear. 14–15 cerrado.
      </p>

      {error && (
        <p className="text-sm text-error bg-error-container/40 rounded-xl px-3 py-2 mx-3 sm:mx-0">
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm text-on-surface-variant text-center py-8">Cargando agenda…</p>
      )}

      {/* Full-bleed grid on mobile (edge-to-edge like Apple Calendar) */}
      {!loading && (view === 'day' || view === 'week') && (
        <TimedGrid
          days={view === 'day' ? [anchor] : weekDays}
          events={events}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
          compact={view === 'week'}
        />
      )}

      {!loading && view === 'month' && (
        <MonthGrid
          monthDays={monthDays}
          anchor={anchor}
          countsByDay={countsByDay}
          onOpenDay={openDay}
        />
      )}

      {createModal && (
        <CreateBookingModal
          initialDate={createModal.date}
          initialTime={createModal.time}
          gapStart={createModal.gapStart}
          gapEnd={createModal.gapEnd}
          onClose={() => setCreateModal(null)}
          onCreated={load}
        />
      )}

      {detailEvent && (
        <BookingDetailModal
          key={detailEvent.id}
          bookingId={detailEvent.id}
          preview={detailEvent}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </div>
  )
}
