import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export function getCalendarClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export type TimeSlot = {
  start: string;
  end: string;
};

export type AppointmentParams = {
  summary: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  attendeeEmail?: string;
  location?: string;
};

/**
 * Get free/busy information for a time range
 */
export async function getAvailability(
  accessToken: string,
  refreshToken: string | undefined,
  timeMin: string,
  timeMax: string
): Promise<TimeSlot[]> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    },
  });

  const busy = response.data.calendars?.primary?.busy || [];
  return busy.map((slot) => ({
    start: slot.start || '',
    end: slot.end || '',
  }));
}

/**
 * Create a calendar event
 */
export async function createAppointment(
  accessToken: string,
  refreshToken: string | undefined,
  params: AppointmentParams
): Promise<{ eventId: string; htmlLink: string }> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const event: Parameters<typeof calendar.events.insert>[0]['requestBody'] = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: {
      dateTime: params.startTime,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: params.endTime,
      timeZone: 'America/New_York',
    },
    attendees: params.attendeeEmail ? [{ email: params.attendeeEmail }] : undefined,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: params.attendeeEmail ? 'all' : 'none',
  });

  return {
    eventId: response.data.id || '',
    htmlLink: response.data.htmlLink || '',
  };
}

/**
 * List upcoming events
 */
export async function listEvents(
  accessToken: string,
  refreshToken: string | undefined,
  maxResults = 10
): Promise<Array<{
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
}>> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items || [];
  return events.map((event) => ({
    id: event.id || '',
    summary: event.summary || 'No title',
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    htmlLink: event.htmlLink || '',
  }));
}

/**
 * Delete a calendar event
 */
export async function deleteAppointment(
  accessToken: string,
  refreshToken: string | undefined,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken, refreshToken);
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}
