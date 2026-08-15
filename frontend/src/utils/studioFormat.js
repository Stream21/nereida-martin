const STUDIO_TZ = 'Atlantic/Canary'

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

export function bookingStatusLabel(status) {
  if (status === 'confirmed') return 'Confirmada'
  if (status === 'pending_review') return 'En revisión'
  if (status === 'cancelled') return 'Cancelada'
  return status || '—'
}

export function bookingSourceLabel(source) {
  if (source === 'google') return 'Google Calendar'
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
