const { alignEventTimesToGrid } = require('./slotGrid');

/**
 * Snap imported Google event times to the 15-minute booking grid.
 * Uses Google's duration (not a fixed 45 min block).
 */
function normalizeImportedEventTimes(startTime, endTime) {
  return alignEventTimesToGrid(startTime, endTime);
}

module.exports = {
  normalizeImportedEventTimes,
};
