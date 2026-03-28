import { google } from 'googleapis';
import dotenv from 'dotenv';
import { saveTokensToRedis, getTokensFromRedis } from '../utils/redisClient.js';
import { nowInTz, toTz } from '../utils/timezone.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.warn('Missing Google Calendar environment variables:', missingEnvVars.join(', '));
}

const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
};

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
];

function createBaseClient() {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
}

const createOAuth2Client = async () => {
  const client = createBaseClient();

  const tokens = await getTokensFromRedis();
  if (tokens.access_token && tokens.refresh_token && tokens.expiry_date) {
    client.setCredentials(tokens);
  } else {
    throw new Error('No tokens found. Please authenticate first.');
  }

  // Save refreshed tokens back to Redis
  client.on('tokens', async (newTokens) => {
    try {
      if (newTokens.access_token) {
        await saveTokensToRedis(newTokens);
        console.log('Refreshed tokens saved to Redis');
      }
    } catch (error) {
      console.error('Failed to save refreshed tokens:', error.message);
    }
  });

  return client;
};

export const getAuthUrl = () => {
  const oauth2Client = createBaseClient();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
};

export const getTokens = async (code) => {
  try {
    const oauth2Client = createBaseClient();
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokensToRedis(tokens);
    console.log('OAuth tokens saved to Redis');
    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error.message);
    throw new Error(`Failed to get tokens: ${error.message}`);
  }
};

export const getCalendarEvents = async () => {
  try {
    const oauth2Client = await createOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const calendarList = await calendar.calendarList.list();

    const now = new Date();
    const pstNow = nowInTz();
    const startOfDay = new Date(new Date(pstNow).setHours(0, 0, 0, 0)).toISOString();
    const endDate = new Date(pstNow);
    endDate.setDate(endDate.getDate() + 7);
    const endOfWeek = endDate.toISOString();

    const allEvents = await Promise.all(
      calendarList.data.items.map(async (cal) => {
        try {
          const response = await calendar.events.list({
            calendarId: cal.id,
            timeMin: startOfDay,
            timeMax: endOfWeek,
            singleEvents: true,
            orderBy: 'startTime',
          });

          return response.data.items
            .filter(event => {
              const isAllDay = !event.start?.dateTime || !event.end?.dateTime;
              if (isAllDay) return false;

              const startTime = new Date(event.start.dateTime);
              const endTime = new Date(event.end.dateTime);
              const isMultiDay = startTime.getDate() !== endTime.getDate();
              if (isMultiDay) return false;

              if (endTime < now) return false;

              const attendees = event.attendees || [];
              const selfAttendee = attendees.find(a => a.self === true);
              if (selfAttendee && selfAttendee.responseStatus === 'declined') return false;

              return true;
            })
            .map(event => ({
              ...event,
              calendarId: cal.id,
              calendarName: cal.summary,
              backgroundColor: cal.backgroundColor,
            }));
        } catch (error) {
          console.warn(`Failed to fetch events for calendar ${cal.summary}:`, error.message);
          return [];
        }
      })
    );

    return allEvents
      .flat()
      .filter(event => event)
      .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

  } catch (error) {
    console.error('Error fetching calendar events:', error.message);
    if (error.message.includes('authenticate first')) {
      throw error;
    }
    throw new Error('Failed to fetch calendar events');
  }
};

export const getAllDayEvents = async (date = new Date()) => {
  try {
    const oauth2Client = await createOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const calendarList = await calendar.calendarList.list();

    const pstDate = toTz(date);
    const startOfDay = new Date(new Date(pstDate).setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(new Date(pstDate).setHours(23, 59, 59, 999)).toISOString();

    const allEvents = await Promise.all(
      calendarList.data.items.map(async (cal) => {
        try {
          const response = await calendar.events.list({
            calendarId: cal.id,
            timeMin: startOfDay,
            timeMax: endOfDay,
            singleEvents: true,
            orderBy: 'startTime',
          });

          return response.data.items
            .filter(event => event.start?.date && !event.start?.dateTime)
            .map(event => ({
              ...event,
              calendarId: cal.id,
              calendarName: cal.summary,
              backgroundColor: cal.backgroundColor,
            }));
        } catch (error) {
          console.warn(`Failed to fetch all-day events for calendar ${cal.summary}:`, error.message);
          return [];
        }
      })
    );

    return allEvents.flat().filter(event => event);

  } catch (error) {
    console.error('Error fetching all-day events:', error.message);
    throw new Error('Failed to fetch all-day events');
  }
};
