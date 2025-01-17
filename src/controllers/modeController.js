import { Mode } from '../types/Mode.js';
import boardService from '../services/boardService.js';
import { getWeatherData } from '../services/weatherService.js';
import { getCalendarEvents } from '../services/calendarService.js';
import cron from 'node-cron';
import { formatWeatherDescription } from '../utils/weatherFormatter.js';
import { formatCalendarEvents } from '../utils/calendarFormatter.js';
import { CronSchedules } from '../utils/cronSchedules.js';
import { PatternMatcherFactory } from '../patterns/PatternMatcherFactory.js';
import { getCurrentMode, saveCurrentMode } from '../utils/redisClient.js';

class ModeController {
  constructor() {
    this.currentMode = Mode.MANUAL;
    this.cronJobs = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      // Get saved mode from Redis
      this.currentMode = await getCurrentMode();
      console.log('Initialized current mode from Redis:', this.currentMode);
      
      // Set up scheduling based on saved mode
      if (this.currentMode !== Mode.MANUAL) {
        await this.setMode(this.currentMode);
      }
    } catch (error) {
      console.error('Error initializing mode controller:', error);
      // Default to MANUAL mode on error
      this.currentMode = Mode.MANUAL;
    }
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
    
    // Save mode to Redis
    await saveCurrentMode(mode);
    
    // Set up new scheduling based on mode
    switch (mode) {
      case Mode.CLOCK:
        await this.updateClock(true); // Immediate update
        this.setupClockMode();
        break;
      case Mode.WEATHER:
        await this.updateWeather(true); // Immediate update
        this.setupWeatherMode();
        break;
      case Mode.CALENDAR:
        await this.updateCalendar(true); // Immediate update
        this.setupCalendarMode();
        break;
      case Mode.MANUAL:
        // Manual mode doesn't need any scheduling
        break;
    }
  }

  async updateClock(initialUpdate = false) {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles'
    }).replace(/(\d+):/, (match, hour) => {
      return hour.padStart(2, ' ') + ':';
    });
    
    // Fetch current board content
    const currentContent = await boardService.getCurrentBoardContent();
    
    // Get the appropriate pattern matcher
    const matcher = PatternMatcherFactory.createMatcher(Mode.CLOCK);
    const isMatch = matcher ? matcher.matches(currentContent) : false;
    
    // If not initial update and the current content does not match the expected clock format,
    // don't update it. Stop all cron jobs and set mode to manual.
    if (initialUpdate || isMatch) {
      await boardService.updateBoard(time);
    } else {
      this.stopAllCronJobs();
      this.currentMode = Mode.MANUAL;
      return;
    }
  }

  async updateWeather(initialUpdate = false) {
    const weatherData = await getWeatherData();
    
    // Format the weather data into lines
    const formattedWeather = weatherData.slice(0, 6).map(row => {
      // Convert date to PST
      const date = new Date(row.date);
      const pstDate = new Date(date.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
      
      // Use PST date for day abbreviation
      const dayAbbrev = pstDate.toLocaleDateString('en-US', { weekday: 'short' })
        .toUpperCase()
        .slice(0, 3);
      
      // Format temperature to ensure consistent width
      const tempStr = `${Math.round(row.temperature)}`.padStart(2, ' ');
      
      // Determine emoji based on temperature and conditions
      let emoji = '🟪';
      if (row.temperature >= 40) emoji = '🟩';
      if (row.temperature >= 55) emoji = '🟨';
      if (row.temperature >= 70) emoji = '🟧';
      if (row.temperature >= 80) emoji = '🟥';

      // Check for special conditions using PST time
      const now = new Date();
      const pstNow = new Date(now.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
      const isTonight = pstNow.toDateString() === pstDate.toDateString() && 
                       pstDate.getHours() === 23;
      
      // Determine final emoji based on conditions
      const conditionTable = [
        ['🟥', ['Hot']],
        [isTonight ? '⬛' : '🟧', ['Dust', 'Sand']],
        [isTonight ? '⬛' : emoji, ['Sunny', 'Clear', 'Fair', 'Haze']],
        [isTonight ? '⬛' : '🟩', ['Windy', 'Breezy', 'Blustery']],
        ['🟪', ['Frost', 'Cold']],
        ['⬛', ['Cloud', 'Overcast', 'Fog', 'Smoke', 'Ash', 'Storm']],
        ['🟦', ['Sleet', 'Spray', 'Rain', 'Shower', 'Spouts', 'Drizzle']],
        ['⬜', ['Snow', 'Ice', 'Blizzard']]
      ];

      const finalEmoji = conditionTable.find(([_, conditions]) => 
        conditions.some(condition => row.shortForecast.includes(condition)))?.[0] || emoji;

      // Format the description
      const formattedDescription = formatWeatherDescription(row.shortForecast);

      return `${dayAbbrev} ${tempStr} ${finalEmoji}${formattedDescription}`;
    }).join('\n');

    // Fetch current board content
    const currentContent = await boardService.getCurrentBoardContent();
    
    // Get the appropriate pattern matcher
    const matcher = PatternMatcherFactory.createMatcher(Mode.WEATHER);
    const isMatch = matcher ? matcher.matches(currentContent) : false;

    // If not initial update and the current content does not match the expected weather format,
    // don't update it. Stop all cron jobs and set mode to manual.
    if (initialUpdate || isMatch) {
      await boardService.updateBoard(formattedWeather);
    } else {
      this.stopAllCronJobs();
      this.currentMode = Mode.MANUAL;
      return;
    }
  }

  async updateCalendar(initialUpdate = false) {
    const events = await getCalendarEvents(5);
    const formattedEvents = formatCalendarEvents(events);

    // Fetch current board content
    const currentContent = await boardService.getCurrentBoardContent();
    
    // Get the appropriate pattern matcher
    const matcher = PatternMatcherFactory.createMatcher(Mode.CALENDAR);
    const isMatch = matcher ? matcher.matches(currentContent) : false;

    // If not initial update and the current content doesn't match calendar patterns,
    // don't update it. Stop all cron jobs and set mode to manual.
    if (initialUpdate || isMatch) {
      await boardService.updateBoard(formattedEvents);
    } else {
      this.stopAllCronJobs();
      this.currentMode = Mode.MANUAL;
      return;
    }
  }

  setupClockMode() {
    // Update every minute, using PST timezone
    const job = cron.schedule(CronSchedules.CLOCK.schedule, () => this.updateClock(), {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set('clock', job);
  }

  setupWeatherMode() {
    // Update at 6am, noon, and 6pm PST every day
    const job = cron.schedule(CronSchedules.WEATHER.schedule, () => this.updateWeather(), {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set('weather', job);
  }

  setupCalendarMode() {
    // Update every hour PST
    const job = cron.schedule(CronSchedules.CALENDAR.schedule, () => this.updateCalendar(), {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set('calendar', job);
  }

  getScheduleInfo(mode) {
    return CronSchedules[mode] || CronSchedules.MANUAL;
  }

  stopAllCronJobs() {
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
  }
}

export const modeController = new ModeController(); 