const { query } = require('../db/pool');
const { blockedWeeksFromBookings } = require('../utils/perfiladoSpacing');

const IMPORTED_EMAIL = 'imported@studio.local';

async function lookupClientByEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return null;
  }

  const clientResult = await query(
    `SELECT id, name, email, phone, declared_profile, first_booking_at, last_booking_at, created_at
     FROM clients WHERE email = $1`,
    [normalized]
  );

  const bookingsResult = await query(
    `SELECT b.treatment_id, t.category, t.name AS treatment_name, b.status, b.start_time
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE c.email = $1
       AND c.email != $2
       AND b.status IN ('confirmed', 'pending_review')
     ORDER BY b.start_time DESC`,
    [normalized, IMPORTED_EMAIL]
  );

  const bookings = bookingsResult.rows;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const treatmentIds = [...new Set(bookings.map((b) => b.treatment_id).filter(Boolean))];

  const client = clientResult.rows[0] || null;

  let acceptedConsents = [];
  if (client) {
    const consentsResult = await query(
      `SELECT consent_type FROM client_consents WHERE client_id = $1`,
      [client.id]
    );
    acceptedConsents = consentsResult.rows.map((r) => r.consent_type);
  }

  const hasAllBaseConsents = ['privacy', 'booking_terms'].every((c) =>
    acceptedConsents.includes(c)
  );

  let suggestedProfile = 'first_time_studio';
  if (client && confirmedCount > 0) {
    suggestedProfile = 'returning_known';
  } else if (client) {
    suggestedProfile = 'returning_declared';
  }

  return {
    isKnownClient: confirmedCount > 0,
    visitCount: confirmedCount,
    treatmentIds,
    treatmentsDone: bookings
      .filter((b) => b.status === 'confirmed')
      .map((b) => ({
        treatmentId: b.treatment_id,
        category: b.category,
        treatmentName: b.treatment_name,
        startTime: b.start_time,
      })),
    suggestedProfile,
    acceptedConsents,
    hasAllBaseConsents,
    client: client
      ? {
          name: client.name,
          email: client.email,
          phone: client.phone,
          declaredProfile: client.declared_profile,
        }
      : null,
    perfiladoBlockedWeeks: blockedWeeksFromBookings(bookings),
  };
}

async function hasTreatmentBefore(clientId, treatmentId) {
  const result = await query(
    `SELECT 1 FROM bookings
     WHERE client_id = $1 AND treatment_id = $2 AND status = 'confirmed'
     LIMIT 1`,
    [clientId, treatmentId]
  );
  return result.rows.length > 0;
}

async function isFirstStudioVisit(clientId) {
  const result = await query(
    `SELECT 1 FROM bookings
     WHERE client_id = $1 AND status = 'confirmed'
     LIMIT 1`,
    [clientId]
  );
  return result.rows.length === 0;
}

function resolveVisitContext({ isFirstStudio, isFirstTreatment }) {
  if (isFirstStudio) return 'first_studio_visit';
  if (isFirstTreatment) return 'first_treatment';
  return 'returning';
}

module.exports = {
  lookupClientByEmail,
  hasTreatmentBefore,
  isFirstStudioVisit,
  resolveVisitContext,
};
