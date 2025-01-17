import { google } from 'googleapis';
import dotenv from 'dotenv';
import { saveTokensToRedis, getTokensFromRedis } from '../utils/redisClient.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.warn('Missing required environment variables:', missingEnvVars);
  // Continue execution despite missing variables
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

// Create OAuth2 client with credentials
const createOAuth2Client = async () => {
  const client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  // Get credentials from Redis
  const tokens = await getTokensFromRedis();
  if (tokens.access_token && tokens.refresh_token && tokens.expiry_date) {
    client.setCredentials(tokens);
  } else {
    throw new Error('No tokens found. Please authenticate first.');
  }

  return client;
};

/**
 * Get the Google Calendar authorization URL
 * @returns {string} The authorization URL
 */
export const getAuthUrl = () => {
  try {
    // For auth URL generation, create a new OAuth2 client directly
    // We don't need tokens for this operation
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_OAUTH_CONFIG.clientId,
      GOOGLE_OAUTH_CONFIG.clientSecret,
      GOOGLE_OAUTH_CONFIG.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    console.log('Generated auth URL:', authUrl);
    return authUrl;
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw new Error(`Failed to generate auth URL: ${error.message}`);
  }
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - The authorization code from Google
 * @returns {Promise<Object>} The tokens object
 */
export const getTokens = async (code) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_OAUTH_CONFIG.clientId,
      GOOGLE_OAUTH_CONFIG.clientSecret,
      GOOGLE_OAUTH_CONFIG.redirectUri
    );
    console.log('Attempting to exchange code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to Redis
    await saveTokensToRedis(tokens);
    console.log('Tokens saved to Redis successfully');
    
    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error.response?.data || error);
    throw new Error(`Failed to get tokens: ${error.message}`);
  }
};

/**
 * Get calendar events for the current day
 * @returns {Promise<Array>} Array of calendar events
 */
export const getCalendarEvents = async () => {
  try {
    // Create and authorize OAuth2 client
    const oauth2Client = await createOAuth2Client();

    // Set up token refresh callback to save new tokens to Redis
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await saveTokensToRedis(tokens);
        console.log('Refreshed tokens saved to Redis successfully');
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

              // Filter out events that have already finished
              if (endTime < now) return false;

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
    throw new Error('Failed to fetch calendar events');
  }
}; 