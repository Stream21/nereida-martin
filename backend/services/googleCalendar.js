const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const {
  getWebEventColorId,
  getWebEventExtendedProperties,
} = require('../utils/webCalendarEvent');
const { TIMEZONE } = require('../utils/studioTimezone');
const studioSettings = require('./studioSettings');
const { describeGoogleAuthError } = require('../utils/googleAuthError');

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

let authClient = null;
let calendarApi = null;
let authInitPromise = null;

function parseServiceAccountCredentials() {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;

  try {
    if (raw.startsWith('{')) return JSON.parse(raw);
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64 JSON');
  }
}

function wrapGoogleAuthError(err) {
  const described = describeGoogleAuthError(err);
  const wrapped = new Error(described.message);
  wrapped.code = described.code;
  wrapped.cause = err;
  return wrapped;
}

function resetAuth() {
  authClient = null;
  calendarApi = null;
  authInitPromise = null;
}

function createServiceAccountClient(creds) {
  return new google.auth.JWT({
    email: creds.client_email,
    key: String(creds.private_key || '').replace(/\\n/g, '\n'),
    scopes: [CALENDAR_SCOPE],
  });
}

function createOAuthClient(refreshToken) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  client.on('tokens', (tokens) => {
    if (!tokens.refresh_token) return;
    studioSettings.updateGoogleRefreshToken(tokens.refresh_token).catch((err) => {
      console.error('Failed to persist rotated Google refresh token:', err.message);
    });
  });
  return client;
}

async function resolveRefreshToken() {
  try {
    const stored = await studioSettings.getGoogleRefreshToken();
    if (stored) return stored;
  } catch (err) {
    console.warn('Could not read Google refresh token from database:', err.message);
  }
  return process.env.GOOGLE_REFRESH_TOKEN || null;
}

async function getAuthClient() {
  if (authClient) return authClient;
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    const serviceAccount = parseServiceAccountCredentials();
    if (serviceAccount) {
      authClient = createServiceAccountClient(serviceAccount);
    } else {
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
      const refreshToken = await resolveRefreshToken();
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refreshToken) {
        throw new Error('Google Calendar credentials not configured');
      }
      authClient = createOAuthClient(refreshToken);
    }

    try {
      await authClient.getAccessToken();
    } catch (err) {
      resetAuth();
      throw wrapGoogleAuthError(err);
    }

    if (!serviceAccount) {
      const stored = await studioSettings.getGoogleRefreshToken().catch(() => null);
      const current = authClient.credentials?.refresh_token;
      if (!stored && current) {
        await studioSettings.updateGoogleRefreshToken(current).catch((err) => {
          console.warn('Could not seed Google refresh token into database:', err.message);
        });
      }
    }

    return authClient;
  })();

  try {
    return await authInitPromise;
  } catch (err) {
    authInitPromise = null;
    throw err;
  }
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

async function getCalendar() {
  const auth = await getAuthClient();
  if (!calendarApi) {
    calendarApi = google.calendar({ version: 'v3', auth });
  }
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
  const calendar = await getCalendar();
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
  const calendar = await getCalendar();
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
  const calendar = await getCalendar();
  const calendarId = getCalendarId();

  const result = await calendar.events.get({ calendarId, eventId });
  return result.data;
}

async function listEvents({ timeMin, timeMax, syncToken, showDeleted = true }) {
  const calendar = await getCalendar();
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
  const calendar = await getCalendar();
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
  const calendar = await getCalendar();
  const calendarId = getCalendarId();

  await calendar.events.delete({ calendarId, eventId, sendUpdates: 'none' });
}

async function watchCalendar(webhookUrl) {
  const calendar = await getCalendar();
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
  const calendar = await getCalendar();
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
