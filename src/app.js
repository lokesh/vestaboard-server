import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import boardService from './services/boardService.js';
import { modeController } from './controllers/modeController.js';
import { getAuthUrl, getTokens, getCalendarEvents } from './services/calendarService.js';

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
app.get('/api/status', (req, res) => {
  const mode = modeController.getCurrentMode();
  const scheduleInfo = modeController.getScheduleInfo(mode);

  res.json({
    currentMode: mode,
    debugMode: boardService.debugMode,
    cronSchedule: scheduleInfo
  });
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
    await getTokens(code);
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.redirect('/?auth=error');
  }
});

// Get events
app.get('/calendar/events', async (req, res) => {
  console.log('📅 Calendar Events Request - Started');
  console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request Query Params:', JSON.stringify(req.query, null, 2));
  
  try {
    console.log('Attempting to fetch calendar events...');
    const events = await getCalendarEvents();
    console.log('Successfully fetched events:', JSON.stringify(events, null, 2));
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

// Add endpoint to clear calendar auth
app.post('/auth/google/clear', async (req, res) => {
  try {
    // Import the clearTokens function from tokenService
    const { clearTokens } = await import('./services/tokenService.js');
    await clearTokens();
    res.json({ success: true, message: 'Calendar authentication cleared' });
  } catch (error) {
    console.error('Failed to clear calendar auth:', error);
    res.status(500).json({ error: 'Failed to clear calendar authentication' });
  }
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