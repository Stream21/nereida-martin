/** Minimum time between now and appointment start for online (and owner) bookings. */
const MIN_BOOKING_LEAD_MS = 12 * 60 * 60 * 1000;

const MIN_BOOKING_LEAD_HOURS = 12;

function minBookableAt(now = Date.now()) {
  return now + MIN_BOOKING_LEAD_MS;
}

function isBeforeMinLead(startMs, now = Date.now()) {
  return startMs < minBookableAt(now);
}

module.exports = {
  MIN_BOOKING_LEAD_MS,
  MIN_BOOKING_LEAD_HOURS,
  minBookableAt,
  isBeforeMinLead,
};
