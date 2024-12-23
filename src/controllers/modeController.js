import { Mode } from '../types/Mode.js';
import boardService from '../services/boardService.js';
import { getWeatherData } from '../services/weatherService.js';
import { getCalendarEvents } from '../services/calendarService.js';
import cron from 'node-cron';

class ModeController {
  constructor() {
    this.currentMode = Mode.MANUAL;
    this.cronJobs = new Map();
  }

  getCurrentMode() {
    return this.currentMode;
  }

  setMode(mode) {
    if (!Object.values(Mode).includes(mode)) {
      throw new Error('Invalid mode');
    }

    // Clear any existing cron jobs
    this.stopAllCronJobs();
    
    this.currentMode = mode;
    
    // Set up new scheduling based on mode
    switch (mode) {
      case Mode.CLOCK:
        this.setupClockMode();
        break;
      case Mode.WEATHER:
        this.setupWeatherMode();
        break;
      case Mode.CALENDAR:
        this.setupCalendarMode();
        break;
      case Mode.MANUAL:
        // Manual mode doesn't need any scheduling
        break;
    }
  }

  setupClockMode() {
    // Update every minute
    const job = cron.schedule('* * * * *', async () => {
      const time = new Date().toLocaleTimeString();
      await boardService.updateBoard(time);
    });
    this.cronJobs.set('clock', job);
  }

  setupWeatherMode() {
    // Update at midnight every day
    const job = cron.schedule('0 0 * * *', async () => {
      const weather = await getWeatherData();
      await boardService.updateBoard(weather);
    });
    this.cronJobs.set('weather', job);
  }

  setupCalendarMode() {
    // Update every hour
    const job = cron.schedule('0 * * * *', async () => {
      const events = await getCalendarEvents(3);
      await boardService.updateBoard(events);
    });
    this.cronJobs.set('calendar', job);
  }

  stopAllCronJobs() {
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
  }
}

export const modeController = new ModeController(); 