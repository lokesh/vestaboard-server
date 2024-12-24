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

  async setMode(mode) {
    if (!Object.values(Mode).includes(mode)) {
      throw new Error('Invalid mode');
    }

    // Clear any existing cron jobs
    this.stopAllCronJobs();
    
    this.currentMode = mode;
    
    // Set up new scheduling based on mode
    switch (mode) {
      case Mode.CLOCK:
        await this.updateClock(); // Immediate update
        this.setupClockMode();
        break;
      case Mode.WEATHER:
        await this.updateWeather(); // Immediate update
        this.setupWeatherMode();
        break;
      case Mode.CALENDAR:
        await this.updateCalendar(); // Immediate update
        this.setupCalendarMode();
        break;
      case Mode.MANUAL:
        // Manual mode doesn't need any scheduling
        break;
    }
  }

  async updateClock() {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(/\s/, ' ');
    await boardService.updateBoard(time);
  }

  async updateWeather() {
    const weather = await getWeatherData();
    await boardService.updateBoard(weather);
  }

  async updateCalendar() {
    const events = await getCalendarEvents(3);
    await boardService.updateBoard(events);
  }

  setupClockMode() {
    // Update every minute
    const job = cron.schedule('* * * * *', () => this.updateClock());
    this.cronJobs.set('clock', job);
  }

  setupWeatherMode() {
    // Update at midnight every day
    const job = cron.schedule('0 0 * * *', () => this.updateWeather());
    this.cronJobs.set('weather', job);
  }

  setupCalendarMode() {
    // Update every hour
    const job = cron.schedule('0 * * * *', () => this.updateCalendar());
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