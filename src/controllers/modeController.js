import { Mode } from '../types/Mode.js';
import boardService from '../services/boardService.js';
import { getWeatherData } from '../services/weatherService.js';
import { getCalendarEvents } from '../services/calendarService.js';
import cron from 'node-cron';
import { formatWeatherDescription } from '../utils/weatherFormatter.js';
import { formatCalendarEvents } from '../utils/calendarFormatter.js';

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
      hour12: true,
      timeZone: 'America/Los_Angeles'
    }).replace(/\s/, ' ');
    await boardService.updateBoard(time);
  }

  async updateWeather() {
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
      // Convert temperature to integer and pad with space to ensure 2 characters
      // e.g. "75" -> "75", "8" -> " 8"
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

      // Format: |XXX 00° [emoji] description| (all on one line)
      return `${dayAbbrev} ${tempStr} ${finalEmoji}${formattedDescription}`;
    }).join('\n');

    await boardService.updateBoard(formattedWeather);
  }

  async updateCalendar() {
    const events = await getCalendarEvents(5);
    const formattedEvents = formatCalendarEvents(events);
    await boardService.updateBoard(formattedEvents);
  }

  setupClockMode() {
    // Update every minute, using PST timezone
    const job = cron.schedule('* * * * *', () => this.updateClock(), {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set('clock', job);
  }

  setupWeatherMode() {
    // Update at 6am, noon, and 6pm PST every day
    const job = cron.schedule('0 6,12,18 * * *', () => this.updateWeather(), {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set('weather', job);
  }

  setupCalendarMode() {
    // Update every hour PST
    const job = cron.schedule('0 * * * *', () => this.updateCalendar(), {
      timezone: 'America/Los_Angeles'
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