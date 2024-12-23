import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import boardService from './services/boardService.js';
import { modeController } from './controllers/modeController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    currentMode: modeController.getCurrentMode(),
    debugMode: boardService.debugMode
  });
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  try {
    modeController.setMode(mode);
    res.json({ success: true, currentMode: mode });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/debug/toggle', (req, res) => {
  boardService.debugMode = !boardService.debugMode;
  res.json({ success: true, debugMode: boardService.debugMode });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 