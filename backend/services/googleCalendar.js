const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const {
  getWebEventColorId,
  getWebEventExtendedProperties,
} = require('../utils/webCalendarEvent');
const { TIMEZONE } = require('../utils/studioTimezone');

let authClient = null;
let calendarApi = null;

function getAuthClient() {
  if (authClient) return authClient;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google Calendar credentials not configured');
  }

  authClient = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  authClient.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return authClient;
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

function getCalendar() {
  if (calendarApi) return calendarApi;
  calendarApi = google.calendar({ version: 'v3', auth: getAuthClient() });
  return calendarApi;
}

async function createEvent({
  summary,
  description,
  startTime,
  endTime,
  clientEmail,
  isWebBooking = false,
  bookingId,
  colorId,
}) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();

  const event = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: TIMEZONE },
    end: { dateTime: endTime, timeZone: TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 360 },
        { method: 'email', minutes: 360 },
      ],
    },
  };

  if (isWebBooking && bookingId) {
    event.colorId = colorId || getWebEventColorId();
    event.extendedProperties = getWebEventExtendedProperties(bookingId);
  }

  if (clientEmail) {
    event.attendees = [{ email: clientEmail }];
  }

  const result = await calendar.events.insert({
    calendarId,
    resource: event,
    sendUpdates: 'none',
  });

  return result.data;
}

async function updateEvent(eventId, {
  summary,
  description,
  startTime,
  endTime,
  clientEmail,
  isWebBooking = false,
  bookingId,
  colorId,
}) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();

  const event = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: TIMEZONE },
    end: { dateTime: endTime, timeZone: TIMEZONE },
  };

  if (isWebBooking && bookingId) {
    event.colorId = colorId || getWebEventColorId();
    event.extendedProperties = getWebEventExtendedProperties(bookingId);
  }

  if (clientEmail) {
    event.attendees = [{ email: clientEmail }];
  }

  const result = await calendar.events.patch({
    calendarId,
    eventId,
    resource: event,
    sendUpdates: 'none',
  });

  return result.data;
}

async function getEvent(eventId) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();

  const result = await calendar.events.get({ calendarId, eventId });
  return result.data;
}

async function listEvents({ timeMin, timeMax, syncToken, showDeleted = true }) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();

  const params = {
    calendarId,
    singleEvents: true,
    showDeleted,
    maxResults: 2500,
  };

  if (syncToken) {
    params.syncToken = syncToken;
  } else {
    params.timeMin = timeMin;
    if (timeMax) params.timeMax = timeMax;
  }

  const events = [];
  let pageToken;
  let nextSyncToken;

  do {
    if (pageToken) params.pageToken = pageToken;

    const result = await calendar.events.list(params);
    events.push(...(result.data.items || []));
    pageToken = result.data.nextPageToken;
    nextSyncToken = result.data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}

function toIso(value) {
  if (!value) return value;
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

async function getFreeBusyRange({ timeMin, timeMax }) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();

  const result = await calendar.freebusy.query({
    resource: {
      timeMin: toIso(timeMin),
      timeMax: toIso(timeMax),
      timeZone: TIMEZONE,
      items: [{ id: calendarId }],
    },
  });

  const busy = result.data.calendars?.[calendarId]?.busy || [];
  return busy.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
}

async function getFreeBusy(dateStr) {
  const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();
  return getFreeBusyRange({ timeMin, timeMax });
}

async function deleteEvent(eventId) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();

  await calendar.events.delete({ calendarId, eventId, sendUpdates: 'none' });
}

async function watchCalendar(webhookUrl) {
  const calendar = getCalendar();
  const calendarId = getCalendarId();
  const channelId = uuidv4();

  const result = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      token: process.env.GOOGLE_WEBHOOK_SECRET || '',
    },
  });

  return {
    channelId: result.data.id,
    resourceId: result.data.resourceId,
    expiration: result.data.expiration,
  };
}

async function stopWatch(channelId, resourceId) {
  const calendar = getCalendar();
  await calendar.channels.stop({
    requestBody: { id: channelId, resourceId },
  });
}

module.exports = {
  createEvent,
  updateEvent,
  getEvent,
  listEvents,
  getFreeBusy,
  getFreeBusyRange,
  deleteEvent,
  watchCalendar,
  stopWatch,
  getAuthClient,
  getCalendarId,
};
