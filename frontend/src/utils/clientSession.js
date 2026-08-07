const STORAGE_KEY = 'nere_client_profile'

export function loadClientProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveClientProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...profile,
      savedAt: new Date().toISOString(),
    }))
  } catch {
    // ignore quota errors
  }
}

export function clearClientProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
