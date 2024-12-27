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
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

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
        // Store the new tokens
        await tokenService.updateTokens(tokens);
      }
    });

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Calculate start and end of current day in ISO format
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

    // Fetch events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    if (error.message === 'No tokens found. Please authenticate first.') {
      throw error;
    }
    throw new Error('Failed to fetch calendar events');
  }
}; 