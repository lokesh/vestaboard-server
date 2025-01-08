import { Mode } from '../types/Mode.js';
import boardService from '../services/boardService.js';
import { getWeatherData } from '../services/weatherService.js';
import { getCalendarEvents } from '../services/calendarService.js';
import cron from 'node-cron';
import { formatWeatherDescription } from '../utils/weatherFormatter.js';
import { formatCalendarEvents } from '../utils/calendarFormatter.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

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
    
    const pattern = [
      ['','0-9',':','0-9','0-9','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','','']
    ];

    const isMatch = checkBoardPattern(currentContent, pattern);
    
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
    // Fetch current board content
    const currentContent = await boardService.getCurrentBoardContent();
    
    const pattern = [
      ['a-z','a-z','a-z','','0-9','0-9','','','','','','','','','','','','','','','',''],
      ['a-z','a-z','a-z','','0-9','0-9','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','','']
    ];

    const isMatch = checkBoardPattern(currentContent, pattern);
    console.log('IS MATCH?');
    console.log(isMatch);
    // Define a regex pattern for a small portion of the expected weather format
    const weatherFormatPattern = /^[A-Z]{3} \d{1,2}/m;

    // If not initial update and the current content does not match the expected weather format,
    // don't update it. Stop all cron jobs and set mode to manual.
    //
    // This happens when a user has manually updated the board. We don't want a cron job
    // to overwrite their message
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

    // Define a regex pattern for a small portion of the expected calendar format
    const calendarFormatPattern = /\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/;

    // Check if the current content matches the expected calendar format
    if (!initialUpdate && !calendarFormatPattern.test(currentContent)) {
      this.stopAllCronJobs();
      this.currentMode = Mode.MANUAL;
      return;
    }

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

  getScheduleInfo(mode) {
    switch (mode) {
      case Mode.CLOCK:
        return {
          schedule: '* * * * *',
          description: 'Updates every minute'
        };
      case Mode.WEATHER:
        return {
          schedule: '0 6,12,18 * * *',
          description: 'Updates at 6am, noon, and 6pm PST every day'
        };
      case Mode.CALENDAR:
        return {
          schedule: '0 * * * *',
          description: 'Updates every hour'
        };
      default:
        return {
          schedule: '',
          description: 'No automatic updates (Manual mode)'
        };
    }
  }

  stopAllCronJobs() {
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
  }
}

export const modeController = new ModeController(); 