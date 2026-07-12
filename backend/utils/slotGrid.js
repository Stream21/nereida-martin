const SLOT_MINUTES = 15;

function snapStartToGrid(date) {
  const d = new Date(date);
  const totalMins = d.getHours() * 60 + d.getMinutes();
  const snapped = Math.floor(totalMins / SLOT_MINUTES) * SLOT_MINUTES;
  d.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
  return d;
}

function snapEndToGrid(startTime, endTime) {
  const d = new Date(endTime);
  const totalMins = d.getHours() * 60 + d.getMinutes();
  const hasSeconds = d.getSeconds() > 0 || d.getMilliseconds() > 0;
  let snapped = Math.ceil((totalMins + (hasSeconds ? 1 : 0)) / SLOT_MINUTES) * SLOT_MINUTES;

  if (snapped >= 24 * 60) {
    snapped = 24 * 60 - SLOT_MINUTES;
  }

  d.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);

  const minEnd = new Date(startTime.getTime() + SLOT_MINUTES * 60 * 1000);
  if (d <= startTime) {
    return minEnd;
  }

  return d;
}

function alignEventTimesToGrid(startTime, endTime) {
  const start = snapStartToGrid(startTime);
  const end = snapEndToGrid(start, endTime);
  return { startTime: start, endTime: end };
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function hasOverlapWithRanges(startTime, endTime, occupiedRanges) {
  const start = startTime.getTime();
  const end = endTime.getTime();
  return occupiedRanges.some((range) => rangesOverlap(start, end, range.start, range.end));
}

function blockDurationMinutes(treatmentMinutes) {
  return Math.ceil(treatmentMinutes / SLOT_MINUTES) * SLOT_MINUTES;
}

function slotsForMinutes(minutes) {
  return Math.ceil(minutes / SLOT_MINUTES);
}

function isOnGrid(date) {
  const d = new Date(date);
  return d.getMinutes() % SLOT_MINUTES === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

module.exports = {
  SLOT_MINUTES,
  snapStartToGrid,
  snapEndToGrid,
  alignEventTimesToGrid,
  rangesOverlap,
  hasOverlapWithRanges,
  blockDurationMinutes,
  slotsForMinutes,
  isOnGrid,
};
