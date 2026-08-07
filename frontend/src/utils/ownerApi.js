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

export function fetchClients({ search = '', page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit })
  if (search) params.set('search', search)
  return ownerFetch(`/clients?${params}`)
}

export function createClient({ name, phone, email }) {
  return ownerFetch('/clients', {
    method: 'POST',
    body: JSON.stringify({ name, phone, email }),
  })
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

export function fetchServices({ year, month, from, to, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit })
  if (year) params.set('year', year)
  if (month) params.set('month', month)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return ownerFetch(`/services?${params}`)
}

export function fetchGoals({ year, month } = {}) {
  const params = new URLSearchParams()
  if (year) params.set('year', year)
  if (month) params.set('month', month)
  const qs = params.toString()
  return ownerFetch(`/goals${qs ? `?${qs}` : ''}`)
}

export function saveGoal(goal) {
  return ownerFetch('/goals', {
    method: 'POST',
    body: JSON.stringify(goal),
  })
}

export async function exportServices({ year, month, from, to } = {}) {
  const params = new URLSearchParams()
  if (year) params.set('year', year)
  if (month) params.set('month', month)
  if (from) params.set('from', from)
  if (to) params.set('to', to)

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
