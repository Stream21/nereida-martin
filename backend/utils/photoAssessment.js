/**
 * Tratamientos que requieren valoración por foto + revisión de la artista.
 * brow-restored: solo la primera vez (sin citas confirmadas previas de ese id).
 */

const PHOTO_ALWAYS = new Set([
  'brow-lami',
  'brow-lami-define',
  'brow-henna',
  'micropigmentacion-soft-pixel',
  'lash-lift-korean',
]);

const PHOTO_FIRST_TIME_ONLY = new Set(['brow-restored']);

const REVIEW_TYPE_PHOTO = 'photo';
/** Legacy review_type still treated as photo assessment */
const REVIEW_TYPE_HENNA = 'henna_photo';

function requiresPhotoAssessment(treatmentId, { treatmentIds = [] } = {}) {
  if (!treatmentId) return false;
  if (PHOTO_ALWAYS.has(treatmentId)) return true;
  if (PHOTO_FIRST_TIME_ONLY.has(treatmentId)) {
    return !treatmentIds.includes(treatmentId);
  }
  return false;
}

function isPhotoReviewType(reviewType) {
  return reviewType === REVIEW_TYPE_PHOTO || reviewType === REVIEW_TYPE_HENNA;
}

module.exports = {
  PHOTO_ALWAYS,
  PHOTO_FIRST_TIME_ONLY,
  REVIEW_TYPE_PHOTO,
  REVIEW_TYPE_HENNA,
  requiresPhotoAssessment,
  isPhotoReviewType,
};
