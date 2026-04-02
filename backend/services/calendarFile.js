const ics = require('ics');

function toICSDateArray(date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
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
    organizer: { name: 'Studio Anuelblingding' },
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
