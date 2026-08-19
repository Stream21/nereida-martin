const GHOST_SUMMARY_PREFIX = process.env.GOOGLE_GHOST_EVENT_PREFIX || '[Bloqueo]';

/**
 * Manual blocks Nereida adds in Google Calendar.
 *
 * Case 1 — Días / horas sin trabajo (vacaciones, cerrado, comida larga):
 *   Title: "[Bloqueo] Vacaciones" (all-day or timed)
 *   → Blocks web availability, NOT imported to bookings DB.
 *
 * Case 2 — Citas solapadas (favores entre medias):
 *   Normal title without [Bloqueo]; they still block web availability via
 *   Google busy ranges, and are stored as google_overlap if the slot is taken.
 *
 * Only the prefix at the start of the title matters; the label after is for her.
 */
function isGhostBlockEvent(event) {
  if (!event?.summary) return false;
  const summary = event.summary.trim();
  const prefix = GHOST_SUMMARY_PREFIX.trim();
  return summary.toLowerCase().startsWith(prefix.toLowerCase());
}

function buildGhostBlockSummary(label) {
  const text = (label || 'Reservado').trim();
  return `${GHOST_SUMMARY_PREFIX} ${text}`;
}

module.exports = {
  GHOST_SUMMARY_PREFIX,
  isGhostBlockEvent,
  buildGhostBlockSummary,
};
