/**
 * Tratamientos que requieren valoración por foto + revisión de la artista.
 * brow-restored: solo la primera vez (sin citas confirmadas previas de ese id).
 */

export const PHOTO_ALWAYS = new Set([
  'brow-lami',
  'brow-lami-define',
  'brow-henna',
  'micropigmentacion-soft-pixel',
  'lash-lift-korean',
])

export const PHOTO_FIRST_TIME_ONLY = new Set(['brow-restored'])

export function requiresPhotoAssessment(treatmentId, { treatmentIds = [] } = {}) {
  if (!treatmentId) return false
  if (PHOTO_ALWAYS.has(treatmentId)) return true
  if (PHOTO_FIRST_TIME_ONLY.has(treatmentId)) {
    return !treatmentIds.includes(treatmentId)
  }
  return false
}
