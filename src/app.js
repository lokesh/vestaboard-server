import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import boardService from './services/boardService.js';
import { modeController } from './controllers/modeController.js';
import { getAuthUrl, getTokens, getCalendarEvents } from './services/calendarService.js';
import { getCurrentMode, getDebugMode } from './utils/redisClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoints
app.get('/api/status', async (req, res) => {
  try {
    // Get current mode from Redis and update local memory
    const mode = await getCurrentMode();
    modeController.currentMode = mode;

    // Get debug mode from Redis and update local memory
    const debugMode = await getDebugMode();
    boardService.debugMode = debugMode;

    const scheduleInfo = modeController.getScheduleInfo(mode);

    res.json({
      currentMode: mode,
      debugMode: debugMode,
      cronSchedule: scheduleInfo
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  try {
    modeController.setMode(mode);
    const scheduleInfo = modeController.getScheduleInfo(mode);
    res.json({ 
      success: true, 
      currentMode: mode,
      cronSchedule: scheduleInfo
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/debug/toggle', (req, res) => {
  boardService.debugMode = !boardService.debugMode;
  res.json({ success: true, debugMode: boardService.debugMode });
});

// Route to start OAuth flow
app.get('/auth/google', (req, res) => {
  const authUrl = getAuthUrl();
  console.log('Auth URL:', authUrl);
  res.redirect(authUrl);
});

// Callback route
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokens = await getTokens(code);
    // Tokens will be logged to console for manual update of .env
    res.redirect('/?auth=success&message=Please check server console for tokens to add to .env');
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.redirect('/?auth=error');
  }
});

// Get events
app.get('/calendar/events', async (req, res) => {
  console.log('📅 Calendar Events Request - Started');
  // console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
  // console.log('Request Query Params:', JSON.stringify(req.query, null, 2));
  
  try {
    console.log('Attempting to fetch calendar events...');
    const events = await getCalendarEvents();
    // console.log('Successfully fetched events:', JSON.stringify(events, null, 2));
    res.json(events);
  } catch (error) {
    console.error('❌ Calendar API error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (error.message === 'No tokens found. Please authenticate first.') {
      console.log('Authentication required - generating auth URL');
      const authUrl = getAuthUrl();
      console.log('Generated Auth URL:', authUrl);
      res.status(401).json({ 
        error: 'Authentication required',
        authUrl: authUrl
      });
    } else {
      console.error('Unexpected error occurred:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch calendar events',
        details: error.message 
      });
    }
  }
  console.log('📅 Calendar Events Request - Completed');
});

// Add this new route with your other routes
app.get('/api/board/content', async (req, res) => {
    try {
        const boardContent = await boardService.getCurrentBoardContent();
        res.json(boardContent);
    } catch (error) {
        console.error('Error getting board content:', error);
        res.status(500).json({ error: 'Failed to fetch board content' });
    }
});

// Add this route with your other routes
app.post('/api/board/message', async (req, res) => {
    try {
        const { text } = req.body;
        const result = await boardService.sendMessage(text);
        res.json(result);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 