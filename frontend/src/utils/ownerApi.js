const API_URL = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'nere_owner_token'

export function getOwnerToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setOwnerToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearOwnerToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function ownerFetch(path, options = {}) {
  const token = getOwnerToken()
  const headers = {
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_URL}/api/owner${path}`, {
    ...options,
    headers,
  }).catch(() => {
    throw new Error('No se pudo conectar con el servidor')
  })

  if (res.status === 401) {
    clearOwnerToken()
    throw new Error('UNAUTHORIZED')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Error de servidor')
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }

  return res
}

export function ownerLogin(email, password) {
  return fetch(`${API_URL}/api/owner/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Credenciales incorrectas')
    }
    return data
  })
}

export function ownerMe() {
  return ownerFetch('/auth/me')
}

export function fetchOverview() {
  return ownerFetch('/metrics/overview')
}

export function fetchMonthly(months = 12) {
  return ownerFetch(`/metrics/monthly?months=${months}`)
}

export function fetchTopClients(limit = 5) {
  return ownerFetch(`/metrics/top-clients?limit=${limit}`)
}

export function fetchByTreatment() {
  return ownerFetch('/metrics/by-treatment')
}

export function fetchBySource() {
  return ownerFetch('/metrics/by-source')
}

export function fetchClients({
  search = '',
  page = 1,
  limit = 20,
  status = '',
  treatmentId = '',
  lastFrom = '',
  lastTo = '',
  minBookings = '',
  maxBookings = '',
} = {}) {
  const params = new URLSearchParams({ page, limit })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (treatmentId) params.set('treatmentId', treatmentId)
  if (lastFrom) params.set('lastFrom', lastFrom)
  if (lastTo) params.set('lastTo', lastTo)
  if (minBookings !== '' && minBookings != null) params.set('minBookings', minBookings)
  if (maxBookings !== '' && maxBookings != null) params.set('maxBookings', maxBookings)
  return ownerFetch(`/clients?${params}`)
}

export function fetchClient(clientId) {
  return ownerFetch(`/clients/${clientId}`)
}

export function updateClient(clientId, payload) {
  return ownerFetch(`/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function createClient({ name, phone, email }) {
  return ownerFetch('/clients', {
    method: 'POST',
    body: JSON.stringify({ name, phone, email }),
  })
}

export function fetchOwnerCalendar({ from, to }) {
  const params = new URLSearchParams({ from, to })
  return ownerFetch(`/calendar?${params}`)
}

export function fetchOwnerTreatments() {
  return ownerFetch('/treatments')
}

export function fetchOwnerBooking(bookingId) {
  return ownerFetch(`/bookings/${bookingId}`)
}

export function ownerUploadUrl(photoUrlOrPath) {
  if (!photoUrlOrPath) return ''
  if (/^https?:\/\//i.test(photoUrlOrPath)) return photoUrlOrPath
  const path = photoUrlOrPath.startsWith('/') ? photoUrlOrPath : `/uploads/${photoUrlOrPath}`
  return `${API_URL}${path}`
}

export function createOwnerBooking({ clientId, treatmentId, startTime, date, time }) {
  return ownerFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify({ clientId, treatmentId, startTime, date, time }),
  })
}

export function createOwnerJointBooking({
  primaryClientId,
  companionClientId,
  treatmentId,
  startTime,
  date,
  time,
}) {
  return ownerFetch('/bookings/joint', {
    method: 'POST',
    body: JSON.stringify({
      primaryClientId,
      companionClientId,
      treatmentId,
      startTime,
      date,
      time,
    }),
  })
}

export function fetchOwnerAvailability({ date, treatmentId }) {
  const params = new URLSearchParams({ date, treatmentId })
  return ownerFetch(`/availability?${params}`)
}

export function fetchOwnerJointAvailability({
  date,
  treatmentId,
  companionClientId,
  primaryClientId,
}) {
  const params = new URLSearchParams({
    date,
    treatmentId,
    companionClientId: String(companionClientId),
    primaryClientId: String(primaryClientId),
  })
  return ownerFetch(`/availability/joint?${params}`)
}

export function fetchOwnerJointAvailabilityMonth({
  year,
  month,
  treatmentId,
  companionClientId,
  primaryClientId,
}) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    treatmentId,
    companionClientId: String(companionClientId),
    primaryClientId: String(primaryClientId),
  })
  return ownerFetch(`/availability/joint/month?${params}`)
}

export function inviteClient(clientId) {
  return ownerFetch(`/clients/${clientId}/invite`, { method: 'POST' })
}

export function disableClient(clientId) {
  return ownerFetch(`/clients/${clientId}/disable`, { method: 'POST' })
}

export function enableClient(clientId) {
  return ownerFetch(`/clients/${clientId}/enable`, { method: 'POST' })
}

export async function importClientsFile(file, { dryRun = false } = {}) {
  const token = getOwnerToken()
  const form = new FormData()
  form.append('file', file)
  const qs = dryRun ? '?dryRun=true' : ''
  const res = await fetch(`${API_URL}/api/owner/clients/import${qs}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error al importar')
  return data
}

export function fetchServices({
  year,
  month,
  from,
  to,
  treatmentId,
  client,
  priceMin,
  priceMax,
  source,
  page = 1,
  limit = 50,
} = {}) {
  const params = new URLSearchParams({ page, limit })
  if (year) params.set('year', year)
  if (month) params.set('month', month)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (treatmentId) params.set('treatmentId', treatmentId)
  if (client) params.set('client', client)
  if (priceMin !== '' && priceMin != null) params.set('priceMin', priceMin)
  if (priceMax !== '' && priceMax != null) params.set('priceMax', priceMax)
  if (source) params.set('source', source)
  return ownerFetch(`/services?${params}`)
}

export async function exportServices({
  year,
  month,
  from,
  to,
  treatmentId,
  client,
  priceMin,
  priceMax,
  source,
} = {}) {
  const params = new URLSearchParams()
  if (year) params.set('year', year)
  if (month) params.set('month', month)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (treatmentId) params.set('treatmentId', treatmentId)
  if (client) params.set('client', client)
  if (priceMin !== '' && priceMin != null) params.set('priceMin', priceMin)
  if (priceMax !== '' && priceMax != null) params.set('priceMax', priceMax)
  if (source) params.set('source', source)

  const token = getOwnerToken()
  const res = await fetch(`${API_URL}/api/owner/export/services?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Error al exportar')
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || 'servicios-nere-studio.xlsx'

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
