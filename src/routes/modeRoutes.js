import express from 'express';
import { Mode } from '../types/Mode.js';
import { modeController } from '../controllers/modeController.js';

const router = express.Router();

router.post('/mode', (req, res) => {
  const { mode } = req.body;
  
  if (!Object.values(Mode).includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  modeController.setMode(mode);
  return res.json({ currentMode: mode });
});

router.get('/mode', (req, res) => {
  const currentMode = modeController.getCurrentMode();
  return res.json({ currentMode });
});

export default router; 