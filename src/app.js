import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import boardService from './services/boardService.js';
import { modeController } from './controllers/modeController.js';
import { getAuthUrl, getTokens, getCalendarEvents } from './services/calendarService.js';
import { getCurrentMode, getDebugMode } from './utils/redisClient.js';
import { requireAuth, handleLogin, handleAuthCheck } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth endpoints (before middleware)
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/check', handleAuthCheck);

// Protect all /api/* routes (login/check excluded above)
app.use('/api', requireAuth);

// OAuth callback must be accessible without API auth (Google redirects here)
// but the /auth/google initiation is protected below

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoints
app.get('/api/status', async (req, res) => {
  try {
    const mode = await getCurrentMode();
    modeController.currentMode = mode;

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

app.post('/api/mode', async (req, res) => {
  const { mode } = req.body;
  try {
    await modeController.setMode(mode);
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

app.post('/api/debug/toggle', async (req, res) => {
  try {
    const newDebugMode = await boardService.toggleDebugMode();
    res.json({ success: true, debugMode: newDebugMode });
  } catch (error) {
    console.error('Error toggling debug mode:', error);
    res.status(500).json({ error: 'Failed to toggle debug mode' });
  }
});

// Route to start OAuth flow (protected by API auth)
app.get('/api/auth/google/start', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// OAuth callback (not behind /api auth - Google redirects here directly)
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    await getTokens(code);
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.redirect('/?auth=error');
  }
});

// Get events
app.get('/api/calendar/events', async (req, res) => {
  try {
    const events = await getCalendarEvents();
    res.json(events);
  } catch (error) {
    console.error('Calendar API error:', error.message);

    if (error.message.includes('authenticate first')) {
      try {
        const authUrl = getAuthUrl();
        res.status(401).json({
          error: 'Authentication required',
          authUrl
        });
      } catch (authError) {
        res.status(401).json({ error: 'Authentication required' });
      }
    } else {
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  }
});

app.get('/api/board/content', async (req, res) => {
  try {
    const boardContent = await boardService.getCurrentBoardContent();
    res.json(boardContent);
  } catch (error) {
    console.error('Error getting board content:', error);
    res.status(500).json({ error: 'Failed to fetch board content' });
  }
});

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

app.post('/api/pattern/test', async (req, res) => {
  try {
    const { mode } = req.body;
    const result = await modeController.testPattern(mode);
    res.json(result);
  } catch (error) {
    console.error('Error testing pattern:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server after initialization
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await modeController.initialize();
    console.log('Mode controller initialized');
  } catch (error) {
    console.error('Failed to initialize mode controller:', error);
    // Continue starting — will default to MANUAL mode
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
