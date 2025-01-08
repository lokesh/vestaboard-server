import { google } from 'googleapis';
import dotenv from 'dotenv';
import tokenService from './tokenService.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Configuration object for Google OAuth2
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
};

// Validate OAuth configuration
Object.entries(GOOGLE_OAUTH_CONFIG).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Invalid OAuth configuration: ${key} is not set`);
  }
});

// Scopes required for Google Calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
];

// Create OAuth2 client
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
};

/**
 * Get the Google Calendar authorization URL
 * @returns {string} The authorization URL
 */
export const getAuthUrl = () => {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'  // Force prompt to ensure we get a refresh token
  });
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - The authorization code from Google
 * @returns {Promise<Object>} The tokens object
 */
export const getTokens = async (code) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  await tokenService.saveTokens(tokens);
  return tokens;
};

/**
 * Get calendar events for the current day
 * @returns {Promise<Array>} Array of calendar events
 */
export const getCalendarEvents = async () => {
  try {
    // Get stored tokens
    const tokens = await tokenService.getTokens();
    if (!tokens) {
      throw new Error('No tokens found. Please authenticate first.');
    }

    // Create and authorize OAuth2 client
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Set up token refresh callback
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await tokenService.updateTokens(tokens);
      }
    });

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // First, get list of all calendars
    const calendarList = await calendar.calendarList.list();
    
    // Calculate start of current day and end of 7 days from now in ISO format
    const now = new Date();
    const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const startOfDay = new Date(pstNow.setHours(0, 0, 0, 0)).toISOString();
    const endOfWeek = new Date(pstNow.setDate(pstNow.getDate() + 7)).toISOString();

    // Fetch events from all calendars
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
          
          // Add calendar info to each event and filter out all-day and declined events
          return response.data.items
            .filter(event => {
              // Filter out all-day events (events that only have 'date' and not 'dateTime')
              const isAllDay = !event.start.dateTime || !event.end.dateTime;
              if (isAllDay) return false;

              // Filter out events that span multiple days
              const startTime = new Date(event.start.dateTime);
              const endTime = new Date(event.end.dateTime);
              const isMultiDay = startTime.getDate() !== endTime.getDate();
              if (isMultiDay) return false;

              // Filter out declined events
              const attendees = event.attendees || [];
              const selfAttendee = attendees.find(
                attendee => attendee.self === true
              );
              if (selfAttendee && selfAttendee.responseStatus === 'declined') {
                return false;
              }

              return true;
            })
            .map(event => ({
              ...event,
              calendarId: cal.id,
              calendarName: cal.summary,
              backgroundColor: cal.backgroundColor,
            }));
        } catch (error) {
          console.warn(`Failed to fetch events for calendar ${cal.summary}:`, error);
          return [];
        }
      })
    );

    // Flatten the array of arrays and sort by start time
    return allEvents
      .flat()
      .filter(event => event)
      .sort((a, b) => {
        const timeA = new Date(a.start.dateTime);
        const timeB = new Date(b.start.dateTime);
        return timeA - timeB;
      });

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    if (error.message === 'No tokens found. Please authenticate first.') {
      throw error;
    }
    throw new Error('Failed to fetch calendar events');
  }
}; 