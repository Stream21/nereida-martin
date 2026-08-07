const API_URL = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'nere_client_token'

export function getClientToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setClientToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearClientToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function authFetch(path, options = {}) {
  const token = getClientToken()
  const headers = { ...(options.headers || {}) }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
  }).catch(() => {
    throw new Error('No se pudo conectar con el servidor')
  })

  if (res.status === 401) {
    clearClientToken()
    throw new Error('UNAUTHORIZED')
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : null

  if (!res.ok) {
    throw new Error(data?.error || 'Error de servidor')
  }

  return data
}

export function clientLogin(identifier, password) {
  return fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas')
    return data
  })
}

export function fetchInvite(token) {
  return fetch(`${API_URL}/api/auth/invite/${token}`).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Invitación no válida')
    return data
  })
}

export function registerWithInvite(token, payload) {
  return fetch(`${API_URL}/api/auth/register/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo completar el registro')
    return data
  })
}

export function clientMe() {
  return authFetch('/auth/me')
}

export function updateClientProfile(payload) {
  return authFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function clientAuthFetch(path, options = {}) {
  return authFetch(path, options)
}

export function clientApiUrl(path) {
  return `${API_URL}/api${path}`
}
