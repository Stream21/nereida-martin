const WEB_SUMMARY_PREFIX = '[Web]';

function buildWebBookingSummary(treatmentName, clientName) {
  return `${WEB_SUMMARY_PREFIX} ${treatmentName} – ${clientName}`;
}

function buildWebBookingDescription({
  treatmentName,
  treatmentTag,
  clientName,
  clientEmail,
  clientPhone,
  bookingId,
}) {
  return [
    '🌐 Reserva online · Studio Anuelblingding',
    '────────────────────────────',
    `Tratamiento: ${treatmentName}`,
    treatmentTag ? `Detalle: ${treatmentTag}` : null,
    `Cliente: ${clientName}`,
    `Email: ${clientEmail}`,
    `Tel: ${clientPhone || 'N/A'}`,
    '',
    `Ref. reserva web: #${bookingId}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function getWebEventColorId() {
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
  return Boolean(event.summary?.startsWith(WEB_SUMMARY_PREFIX));
}

module.exports = {
  WEB_SUMMARY_PREFIX,
  buildWebBookingSummary,
  buildWebBookingDescription,
  getWebEventColorId,
  getWebEventExtendedProperties,
  isWebBookingEvent,
};
