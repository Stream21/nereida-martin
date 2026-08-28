const STUDIO_TZ = 'Atlantic/Canary'

export function studioTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year').value)
  const m = Number(parts.find((p) => p.type === 'month').value)
  const d = Number(parts.find((p) => p.type === 'day').value)
  return new Date(y, m - 1, d)
}

/** Minutes since midnight in studio timezone (Atlantic/Canary). */
export function studioNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STUDIO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const hour = Number(parts.find((p) => p.type === 'hour').value)
  const minute = Number(parts.find((p) => p.type === 'minute').value)
  return hour * 60 + minute
}

export function formatEuro(value) {
  if (value == null) return null
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatStudioDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: STUDIO_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatStudioDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: STUDIO_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatStudioWeekday(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: STUDIO_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatStudioTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: STUDIO_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function isGoogleBookingSource(source) {
  return typeof source === 'string' && source.startsWith('google')
}

export function bookingStatusLabel(status) {
  if (status === 'confirmed') return 'Confirmada'
  if (status === 'pending_review') return 'En revisión'
  if (status === 'pending_companion') return 'Pendiente acompañante'
  if (status === 'google_overlap') return 'Google (solape)'
  if (status === 'google_block') return 'Bloqueo'
  if (status === 'cancelled') return 'Cancelada'
  return status || '—'
}

export function bookingSourceLabel(source) {
  if (isGoogleBookingSource(source)) return 'Google Calendar'
  if (source === 'owner') return 'Agenda estudio'
  return 'Reserva web'
}

export function photoStatusLabel(status) {
  if (status === 'approved') return 'Aprobada'
  if (status === 'rejected') return 'Rechazada'
  return 'Pendiente'
}

export function photoSourceLabel(source) {
  if (source === 'micro_request') return 'Solicitud micropigmentación'
  return 'Valoración de cita'
}
