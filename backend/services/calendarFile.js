const ics = require('ics');
const { STUDIO_BRAND } = require('../utils/studioBrand');
const { TIMEZONE } = require('../utils/studioTimezone');

/** Wall-clock components in studio TZ for floating ICS times. */
function toICSDateArray(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return [get('year'), get('month'), get('day'), get('hour'), get('minute')];
}

function generateICS({ title, startTime, endTime, description, location }) {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  const { error, value } = ics.createEvent({
    title,
    description,
    location,
    start: toICSDateArray(startTime),
    duration: { hours, minutes },
    alarms: [
      {
        action: 'display',
        description: `Tu cita es en 6 horas: ${title}`,
        trigger: { hours: 6, before: true },
      },
    ],
    status: 'CONFIRMED',
    organizer: { name: STUDIO_BRAND },
  });

  if (error) {
    throw new Error(`ICS generation failed: ${error}`);
  }

  return value;
}

function generateGoogleCalendarUrl({ title, startTime, endTime, description, location }) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startTime)}/${fmt(endTime)}`,
    details: description,
    location: location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

module.exports = { generateICS, generateGoogleCalendarUrl };
