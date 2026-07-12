const WEB_SUMMARY_PREFIX = '[Web]';

const PREFIX = {
  web: '[Web]',
  first_visit: '[Primera visita]',
  first_treatment: '[Nuevo tratamiento]',
  pending_henna: '[Pendiente Henna]',
};

function getEventPrefix({ visitContext, reviewType, pendingReview }) {
  if (pendingReview || reviewType === 'henna_photo') return PREFIX.pending_henna;
  if (visitContext === 'first_studio_visit') return PREFIX.first_visit;
  if (visitContext === 'first_treatment') return PREFIX.first_treatment;
  return PREFIX.web;
}

function buildWebBookingSummary(treatmentName, clientName) {
  return `${WEB_SUMMARY_PREFIX} ${treatmentName} – ${clientName}`;
}

function buildBookingSummary({ treatmentName, clientName, visitContext, reviewType, pendingReview }) {
  const prefix = getEventPrefix({ visitContext, reviewType, pendingReview });
  return `${prefix} ${treatmentName} – ${clientName}`;
}

function buildWebBookingDescription({
  treatmentName,
  treatmentTag,
  clientName,
  clientEmail,
  clientPhone,
  bookingId,
}) {
  return buildBookingDescription({
    treatmentName,
    treatmentTag,
    clientName,
    clientEmail,
    clientPhone,
    bookingId,
  });
}

function buildBookingDescription({
  treatmentName,
  treatmentTag,
  clientName,
  clientEmail,
  clientPhone,
  bookingId,
  visitContext,
  reviewType,
  pendingReview,
  intakeSummary,
  signatureSignerName,
  flagged,
  flagReason,
  hennaPhotoUrl,
}) {
  const lines = [
    '🌐 Reserva online · Studio Anuelblingding',
    '────────────────────────────',
    `Tratamiento: ${treatmentName}`,
    treatmentTag ? `Detalle: ${treatmentTag}` : null,
    `Cliente: ${clientName}`,
    `Email: ${clientEmail}`,
    `Tel: ${clientPhone || 'N/A'}`,
  ];

  if (visitContext === 'first_studio_visit') {
    lines.push('', '⭐ PRIMERA VISITA AL ESTUDIO');
  }
  if (visitContext === 'first_treatment') {
    lines.push('', '🆕 Primera vez en este tratamiento');
  }
  if (pendingReview || reviewType === 'henna_photo') {
    lines.push('', '⏳ PENDIENTE DE VALORACIÓN HENNA — Revisar foto antes de confirmar');
    if (hennaPhotoUrl) lines.push(`Foto valoración: ${hennaPhotoUrl}`);
  }
  if (flagged) {
    lines.push('', `⚠️ CUESTIONARIO MARCADO: ${flagReason || 'Revisar respuestas'}`);
  }
  if (intakeSummary) {
    lines.push('', '── Cuestionario ──', intakeSummary);
  }
  if (signatureSignerName) {
    lines.push('', `✍️ Firmado digitalmente por: ${signatureSignerName}`);
  }

  lines.push('', `Ref. reserva web: #${bookingId}`);

  return lines.filter((line) => line !== null).join('\n');
}

function getWebEventColorId() {
  return process.env.GOOGLE_WEB_EVENT_COLOR_ID || '7';
}

function getEventColorId({ visitContext, reviewType, pendingReview, flagged }) {
  if (pendingReview || reviewType === 'henna_photo') {
    return process.env.GOOGLE_PENDING_COLOR_ID || '11';
  }
  if (flagged) return process.env.GOOGLE_FLAGGED_COLOR_ID || '4';
  if (visitContext === 'first_studio_visit') {
    return process.env.GOOGLE_FIRST_VISIT_COLOR_ID || '6';
  }
  if (visitContext === 'first_treatment') {
    return process.env.GOOGLE_FIRST_TREATMENT_COLOR_ID || '5';
  }
  return process.env.GOOGLE_WEB_EVENT_COLOR_ID || '7';
}

function getWebEventExtendedProperties(bookingId) {
  return {
    private: {
      source: 'web',
      bookingId: String(bookingId),
    },
  };
}

function isWebBookingEvent(event) {
  if (!event) return false;
  if (event.extendedProperties?.private?.source === 'web') return true;
  const s = event.summary || '';
  return Object.values(PREFIX).some((p) => s.startsWith(p)) || s.startsWith(WEB_SUMMARY_PREFIX);
}

const { formatIntakeSummary } = require('../config/intakeQuestions');

module.exports = {
  WEB_SUMMARY_PREFIX,
  PREFIX,
  getEventPrefix,
  buildWebBookingSummary,
  buildBookingSummary,
  buildWebBookingDescription,
  buildBookingDescription,
  getWebEventColorId,
  getEventColorId,
  getWebEventExtendedProperties,
  isWebBookingEvent,
  formatIntakeSummary,
};
