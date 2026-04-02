const { google } = require('googleapis');

function getAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google Calendar credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuthClient() });
}

async function createEvent({ summary, description, startTime, endTime, clientEmail }) {
  const calendar = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const event = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: 'Europe/Madrid' },
    end: { dateTime: endTime, timeZone: 'Europe/Madrid' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 360 },
        { method: 'email', minutes: 360 },
      ],
    },
  };

  const result = await calendar.events.insert({
    calendarId,
    resource: event,
  });

  return result.data.id;
}

async function getFreeBusy(dateStr) {
  const calendar = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const timeMin = new Date(`${dateStr}T00:00:00`);
  const timeMax = new Date(`${dateStr}T23:59:59`);

  const result = await calendar.freebusy.query({
    resource: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: 'Europe/Madrid',
      items: [{ id: calendarId }],
    },
  });

  const busy = result.data.calendars?.[calendarId]?.busy || [];

  return busy.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
}

async function deleteEvent(eventId) {
  const calendar = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  await calendar.events.delete({ calendarId, eventId });
}

module.exports = { createEvent, getFreeBusy, deleteEvent, getAuthClient };
