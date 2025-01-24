import { Mode } from '../types/Mode.js';
import boardService from '../services/boardService.js';
import { getWeatherData, getHourlyWeatherData, getSunData } from '../services/weatherService.js';
import { getCalendarEvents } from '../services/calendarService.js';
import cron from 'node-cron';
import { formatWeatherDescription } from '../utils/weatherFormatter.js';
import { formatCalendarEvents } from '../utils/calendarFormatter.js';
import { CronSchedules } from '../utils/cronSchedules.js';
import { PatternMatcherFactory } from '../patterns/PatternMatcherFactory.js';
import { getCurrentMode, saveCurrentMode } from '../utils/redisClient.js';

class ModeController {
  constructor() {
    this._currentMode = Mode.MANUAL;
    this.cronJobs = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      // Get saved mode from Redis
      this._currentMode = await getCurrentMode();
      console.log('Initialized current mode from Redis:', this._currentMode);
      
      // Set up scheduling based on saved mode
      if (this._currentMode !== Mode.MANUAL) {
        await this.setMode(this._currentMode);
      }
    } catch (error) {
      console.error('Error initializing mode controller:', error);
      // Default to MANUAL mode on error
      this._currentMode = Mode.MANUAL;
    }
  }

  getCurrentMode() {
    return this._currentMode;
  }

  set currentMode(mode) {
    if (!Object.values(Mode).includes(mode)) {
      throw new Error('Invalid mode');
    }
    this._currentMode = mode;
  }

  async setMode(mode) {
    if (!Object.values(Mode).includes(mode)) {
      throw new Error('Invalid mode');
    }

    // Clear any existing cron jobs
    this.stopAllCronJobs();
    
    this._currentMode = mode;
    
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
      case Mode.TODAY:
        await this.updateToday(true); // Immediate update
        this.setupTodayMode();
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
      let emoji = '🟪';  // Default to purple for cold
      if (row.temperature >= 40) emoji = '🟩';  // Green for cool
      if (row.temperature >= 55) emoji = '🟨';  // Yellow for mild
      if (row.temperature >= 70) emoji = '🟧';  // Orange for warm
      if (row.temperature >= 80) emoji = '🟥';  // Red for hot

      // Check for special conditions using PST time
      const now = new Date();
      const pstNow = new Date(now.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
      const isTonight = pstNow.toDateString() === pstDate.toDateString() && 
                       pstDate.getHours() === 23;
      
      // Determine final emoji based on conditions
      const conditionTable = [
        ['🟥', ['Hot']],  // Red for hot
        [isTonight ? '⬛' : '🟧', ['Dust', 'Sand']],  // Black at night, orange in day
        [isTonight ? '⬛' : emoji, ['Sunny', 'Clear', 'Fair', 'Haze']],  // Black at night, temp-based in day
        [isTonight ? '⬛' : '🟩', ['Windy', 'Breezy', 'Blustery']],  // Black at night, green in day
        ['🟪', ['Frost', 'Cold']],  // Purple for cold
        ['⬛', ['Cloud', 'Overcast', 'Fog', 'Smoke', 'Ash', 'Storm']],  // Black for dark conditions
        ['🟦', ['Sleet', 'Spray', 'Rain', 'Shower', 'Spouts', 'Drizzle']],  // Blue for rain
        ['⬜', ['Snow', 'Ice', 'Blizzard']]  // White for snow/ice
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

  async updateToday(initialUpdate = false) {
    console.log('Starting updateToday function, initialUpdate:', initialUpdate);
    
    // Get hourly weather data
    console.log('Fetching hourly weather data...');
    const hourlyData = await getHourlyWeatherData();
    // console.log('Received hourly weather data:', hourlyData ? 'data present' : 'no data');
    console.log('Hourly data:', hourlyData);
    // Format current date
    console.log('Formatting date...');
    const now = new Date();
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const monthStr = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const dateStr = now.getDate().toString();
    const firstLine = `${dayStr} ${monthStr} ${dateStr}`;
    console.log('Formatted first line:', firstLine);

    // Get temperatures for specific hours
    console.log('Processing temperatures for specific hours...');
    const temperatures = hourlyData
      .filter((_, index) => index % 4 === 0)  // Take every 3rd hour
      .map(data => data.temperature.toString().padStart(2, ' '))
    

    const tempLine = temperatures.join('  ');  // Increased spacing to account for fewer numbers
    console.log('Temperature line:', tempLine);

    // Create weather condition boxes
    console.log('Creating weather condition boxes...');
    const sunData = await getSunData();
    console.log('Sun data:', sunData);

    const getWeatherEmoji = (forecast, dateTime) => {
      const blueConditions = ['rain', 'shower'];  // 🟦
      const whiteConditions = ['cloud', 'overcast', 'fog', 'smoke', 'ash', 'storm', 'snow', 'ice', 'blizzard'];  // ⬜
      const yellowConditions = ['sunny', 'clear', 'fair', 'haze'];  // 🟨
      const redConditions = ['hot'];  // 🟥
      const purpleConditions = ['windy', 'breezy', 'blustery'];  // 🟪

      if (blueConditions.some(condition => forecast.toLowerCase().includes(condition))) return '🟦';
      
      if (dateTime < sunData.sunrise || dateTime > sunData.sunset) {
        return '⬛';  // Black at night
      }
      
      if (whiteConditions.some(condition => forecast.toLowerCase().includes(condition))) return '⬜';
      if (yellowConditions.some(condition => forecast.toLowerCase().includes(condition))) return '🟨';
      if (redConditions.some(condition => forecast.toLowerCase().includes(condition))) return '🟥';
      if (purpleConditions.some(condition => forecast.toLowerCase().includes(condition))) return '🟪';
  
      return '⬜';  // Default to white for cloudy or other conditions
    };

    const boxes = hourlyData
      .map(data => {
        const dateTime = new Date();
        dateTime.setHours(data.hour, 0, 0, 0);
        return getWeatherEmoji(data.shortForecast, dateTime);
      })
      .join('');  // Remove spacing since we want boxes to be adjacent
    console.log('Weather boxes:', boxes);

    // Create time labels for every 4th hour
    const timeLabels = hourlyData
      .filter((_, index) => index % 4 === 0)
      .map(data => {
        const hour = data.hour % 12 || 12;  // Convert 24h to 12h format
        const ampm = data.hour < 12 ? 'a' : 'p';
        // Add two spaces after single digit hours, one space after double digit hours
        return `${hour}${ampm}${hour < 10 ? '  ' : ' '}`;
      })
      .join('');
    console.log('Time labels:', timeLabels);

    // Combine all lines with a blank line between date and temperatures
    const content = `${firstLine}\n\n${tempLine}\n${boxes}\n${timeLabels}`;
    console.log('Final content to display:', content);

    // Fetch current board content
    console.log('Fetching current board content...');
    const currentContent = await boardService.getCurrentBoardContent();
    console.log('Current board content:', currentContent);
    
    // Get the appropriate pattern matcher
    console.log('Getting pattern matcher for TODAY mode...');
    const matcher = PatternMatcherFactory.createMatcher(Mode.TODAY);
    console.log('Pattern matcher created:', matcher ? 'success' : 'failed');
    
    if (matcher) {
      console.log('Checking if content matches pattern...');
      const isMatch = matcher.matches(currentContent);
      console.log('Pattern match result:', isMatch);
    }
    
    const isMatch = matcher ? matcher.matches(currentContent) : false;

    // If not initial update and the current content doesn't match today patterns,
    // don't update it. Stop all cron jobs and set mode to manual.
    console.log('Checking conditions for update - initialUpdate:', initialUpdate, 'isMatch:', isMatch);
    if (initialUpdate || isMatch) {
      console.log('Updating board with new content...');
      await boardService.updateBoard(content);
      console.log('Board update complete');
    } else {
      console.log('Content pattern mismatch - stopping cron jobs and switching to manual mode');
      this.stopAllCronJobs();
      this.currentMode = Mode.MANUAL;
      return;
    }
  }

  setupCronJob(mode, updateFn) {
    const schedule = CronSchedules[mode].schedule;
    const job = cron.schedule(schedule, async () => {
      const serverTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      console.log(`[${serverTime}] Starting ${mode} cron job. Current mode: ${this._currentMode}`);
      try {
        await updateFn();
        console.log(`[${serverTime}] Successfully completed ${mode} cron job`);
      } catch (error) {
        console.error(`[${serverTime}] Failed ${mode} cron job:`, error);
      }
    }, {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set(mode.toLowerCase(), job);
  }

  setupClockMode() {
    this.setupCronJob(Mode.CLOCK, () => this.updateClock());
  }

  setupWeatherMode() {
    this.setupCronJob(Mode.WEATHER, () => this.updateWeather());
  }

  setupCalendarMode() {
    this.setupCronJob(Mode.CALENDAR, () => this.updateCalendar());
  }

  setupTodayMode() {
    this.setupCronJob(Mode.TODAY, () => this.updateToday());
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

  async testPattern(mode) {
    if (!Object.values(Mode).includes(mode)) {
      throw new Error('Invalid mode');
    }

    // Get current board content
    const currentContent = await boardService.getCurrentBoardContent();
    
    // Get the appropriate pattern matcher
    const matcher = PatternMatcherFactory.createMatcher(mode);
    
    // Test the pattern
    const matches = matcher ? matcher.matches(currentContent) : false;
    
    return {
      mode,
      matches,
      description: matcher ? matcher.getDescription() : 'No pattern matcher available'
    };
  }
}

export const modeController = new ModeController(); 