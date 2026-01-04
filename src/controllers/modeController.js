import { Mode } from '../types/Mode.js';
import boardService from '../services/boardService.js';
import { getWeatherData, getHourlyWeatherData, getSunData, getHistoricalAndForecastWeather } from '../services/weatherService.js';
import { getCalendarEvents, getAllDayEvents } from '../services/calendarService.js';
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
      case Mode.FIVEDAY_WEATHER:
        await this.updateFiveDayWeather(true); // Immediate update
        this.setupFiveDayWeatherMode();
        break;
      case Mode.ONEDAY_WEATHER:
        await this.updateOneDayWeather(true); // Immediate update
        this.setupOneDayWeatherMode();
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

  async updateFiveDayWeather(initialUpdate = false) {
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
      if (row.temperature >= 70 ) emoji = '🟧';  // Orange for warm
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
    const matcher = PatternMatcherFactory.createMatcher(Mode.FIVEDAY_WEATHER);
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

  async updateOneDayWeather(initialUpdate = false) {
    console.log('Starting updateOneDayWeather function, initialUpdate:', initialUpdate);

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


    const tempLine = temperatures.join('° ');  // Remove the last space

    console.log('Temperature line:', tempLine);

    // Create weather condition boxes
    console.log('Creating weather condition boxes...');
    const sunData = await getSunData();
    console.log('Sun data:', sunData);


    const getWeatherEmoji = (forecastUpper, dateTime) => {
      const forecast = forecastUpper.toLowerCase();
      const whiteConditions = ['cloud', 'overcast', 'fog', 'smoke', 'ash', 'storm', 'snow', 'ice', 'blizzard'];  // ⬜
      const yellowConditions = ['sunny', 'clear', 'fair', 'haze'];  // 🟨
      const redConditions = ['hot'];  // 🟥
      const purpleConditions = ['windy', 'breezy', 'blustery'];  // 🟪

      if (forecast.includes('thunderstorms')) {
        return '🟦';
      }

      if (forecast.includes('rain') || forecast.includes('shower') || forecast.includes('drizzle')) {
        if (!forecast.includes('chance') && !forecast.includes('patchy')) {
          return '🟦';
        }
      }

      if (dateTime < sunData.sunrise || dateTime > sunData.sunset) {
        return '-';  // Black at night
      }
      if (yellowConditions.some(condition => forecast.includes(condition))) return '🟨';
      if (whiteConditions.some(condition => forecast.includes(condition))) return '⬜';
      if (redConditions.some(condition => forecast.includes(condition))) return '🟥';
      if (purpleConditions.some(condition => forecast.includes(condition))) return '🟪';

      return '⬜';  // Default to white for cloudy or other conditions
    };

    const boxes = hourlyData
      .map(data => {
        const dateTime = new Date();
        dateTime.setHours(data.hour, 0, 0, 0);
        const emoji = getWeatherEmoji(data.shortForecast, dateTime);
        return emoji;
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
    console.log('Getting pattern matcher for 1DAYWEATHER mode...');
    const matcher = PatternMatcherFactory.createMatcher(Mode.ONEDAY_WEATHER);
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

  async updateToday(initialUpdate = false) {
    const now = new Date();
    const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

    // Row 1: Month and date
    const monthStr = pstNow.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Los_Angeles' }).toUpperCase();
    const dateStr = pstNow.getDate();
    const row1 = `${monthStr} ${dateStr}`;

    // Check for holiday
    const holiday = this.getHolidayForDate(pstNow);

    // Get birthdays from calendar
    const birthdays = await this.getTodaysBirthdays();
    const birthdayStr = this.formatBirthdays(birthdays);

    // Rows 2 and 3: Holiday and/or birthdays
    let row2 = '';
    let row3 = '';

    if (holiday) {
      row2 = holiday;
      row3 = birthdayStr; // Birthdays go to row 3 if there's a holiday
    } else {
      row2 = birthdayStr; // Birthdays go to row 2 if no holiday
      row3 = ''; // Row 3 is blank
    }

    // Rows 4-6: Weather summary
    const weatherRows = await this.getWeatherSummary();

    // Combine all rows
    const rows = [row1, row2, row3, weatherRows.morning, weatherRows.midday, weatherRows.evening];
    const content = rows.join('\n');

    // Pattern matching logic
    const currentContent = await boardService.getCurrentBoardContent();
    const matcher = PatternMatcherFactory.createMatcher(Mode.TODAY);
    const isMatch = matcher ? matcher.matches(currentContent) : false;

    if (initialUpdate || isMatch) {
      await boardService.updateBoard(content);
    } else {
      this.stopAllCronJobs();
      this.currentMode = Mode.MANUAL;
      return;
    }
  }

  getHolidayForDate(date) {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();
    const year = date.getFullYear();

    // Fixed date holidays
    const fixedHolidays = {
      '1-1': 'New Year\'s Day',
      '7-4': 'Independence Day',
      '12-25': 'Christmas Day',
      '12-31': 'New Year\'s Eve'
    };

    const key = `${month}-${day}`;
    if (fixedHolidays[key]) {
      return fixedHolidays[key];
    }

    // Floating holidays (need to calculate)
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const weekOfMonth = Math.ceil(day / 7);

    // Martin Luther King Jr. Day - 3rd Monday in January
    if (month === 1 && dayOfWeek === 1 && weekOfMonth === 3) {
      return 'MLK Day';
    }

    // Presidents' Day - 3rd Monday in February
    if (month === 2 && dayOfWeek === 1 && weekOfMonth === 3) {
      return 'Presidents\' Day';
    }

    // Memorial Day - Last Monday in May
    if (month === 5 && dayOfWeek === 1 && day > 24) {
      return 'Memorial Day';
    }

    // Labor Day - 1st Monday in September
    if (month === 9 && dayOfWeek === 1 && day <= 7) {
      return 'Labor Day';
    }

    // Thanksgiving - 4th Thursday in November
    if (month === 11 && dayOfWeek === 4 && weekOfMonth === 4) {
      return 'Thanksgiving';
    }

    return null;
  }

  async getTodaysBirthdays() {
    try {
      // Get all-day events for today
      const now = new Date();
      const allDayEvents = await getAllDayEvents(now);

      // Filter for birthday events
      const birthdays = allDayEvents.filter(event => {
        // Check if the title contains "birthday" (case insensitive)
        return /birthday/i.test(event.summary);
      });

      return birthdays;
    } catch (error) {
      console.error('Error fetching birthdays:', error);
      return [];
    }
  }

  formatBirthdays(birthdays) {
    if (!birthdays || birthdays.length === 0) {
      return '';
    }

    const maxLength = 22; // Board width
    const names = birthdays.map(event => {
      // Remove emojis and "birthday" from the summary
      let name = event.summary
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/birthday/gi, '')
        .trim();

      // Try to parse name (assuming format is "FirstName LastName" or similar)
      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        // Format as "FirstName L" (first name + last initial)
        return `${nameParts[0]} ${nameParts[1][0]}`;
      } else {
        // Just use the first name if no last name
        return nameParts[0];
      }
    });

    // Join names with commas
    let result = names.join(', ');

    // If too long, try without last initials
    if (result.length > maxLength) {
      const firstNames = birthdays.map(event => {
        let name = event.summary
          .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
          .replace(/birthday/gi, '')
          .trim();
        return name.split(/\s+/)[0];
      });
      result = firstNames.join(', ');
    }

    // Truncate if still too long
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 1) + '…';
    }

    return result;
  }

  async getWeatherSummary() {
    try {
      // Try Visual Crossing first (has historical data)
      let hourlyData;
      try {
        hourlyData = await getHistoricalAndForecastWeather();
        console.log('Using Visual Crossing API for weather data');
      } catch (vcError) {
        console.warn('Visual Crossing API failed, falling back to NWS:', vcError.message);
        // Fallback to NWS API if Visual Crossing fails
        hourlyData = await getHourlyWeatherData();
      }

      const sunData = await getSunData();

      // Define time periods (in 24-hour format)
      const periods = {
        morning: { start: 8, end: 12 },   // 8am-12pm (4 hours)
        midday: { start: 12, end: 16 },   // 12pm-4pm (4 hours)
        evening: { start: 16, end: 20 }   // 4pm-8pm (4 hours)
      };

      const formatPeriod = (periodData, periodName) => {
        if (!periodData || periodData.length === 0) {
          return '';
        }

        // Get temperature range
        const temps = periodData.map(d => d.temperature);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        const tempStr = `${minTemp}-${maxTemp}°`;

        // Get most common weather condition
        const conditions = periodData.map(d => d.shortForecast);
        const conditionCounts = {};
        conditions.forEach(c => {
          conditionCounts[c] = (conditionCounts[c] || 0) + 1;
        });
        const mostCommon = Object.keys(conditionCounts).reduce((a, b) =>
          conditionCounts[a] > conditionCounts[b] ? a : b
        );

        // Format weather description (shortened)
        const description = this.formatWeatherForToday(mostCommon);

        // Create color blocks for each hour
        const blocks = periodData.map(data => {
          const dateTime = new Date();
          dateTime.setHours(data.hour, 0, 0, 0);
          return this.getWeatherEmojiForToday(data.shortForecast, dateTime, sunData);
        }).join('');

        // Combine: temp, blocks, description
        // Format: "55-72° ⬜⬜⬜⬜ Sunny"
        return `${tempStr} ${blocks} ${description}`;
      };

      // Filter hourly data for each period
      const morningData = hourlyData.filter(d => d.hour >= periods.morning.start && d.hour < periods.morning.end);
      const middayData = hourlyData.filter(d => d.hour >= periods.midday.start && d.hour < periods.midday.end);
      const eveningData = hourlyData.filter(d => d.hour >= periods.evening.start && d.hour < periods.evening.end);

      return {
        morning: formatPeriod(morningData, 'morning'),
        midday: formatPeriod(middayData, 'midday'),
        evening: formatPeriod(eveningData, 'evening')
      };
    } catch (error) {
      console.error('Error getting weather summary:', error);
      return {
        morning: '',
        midday: '',
        evening: ''
      };
    }
  }

  getWeatherEmojiForToday(forecast, dateTime, sunData) {
    const forecastLower = forecast.toLowerCase();

    // Rain/Storm conditions (always blue)
    if (forecastLower.includes('thunderstorms') ||
        (forecastLower.includes('rain') && !forecastLower.includes('chance') && !forecastLower.includes('patchy')) ||
        forecastLower.includes('shower') ||
        forecastLower.includes('drizzle')) {
      return '🟦';
    }

    // Check if it's nighttime
    if (dateTime < sunData.sunrise || dateTime > sunData.sunset) {
      return '⬛';
    }

    // Daytime conditions
    if (forecastLower.includes('sunny') || forecastLower.includes('clear') ||
        forecastLower.includes('fair') || forecastLower.includes('haze')) {
      return '🟨';
    }

    if (forecastLower.includes('cloud') || forecastLower.includes('overcast') ||
        forecastLower.includes('fog') || forecastLower.includes('smoke') ||
        forecastLower.includes('ash') || forecastLower.includes('storm') ||
        forecastLower.includes('snow') || forecastLower.includes('ice') ||
        forecastLower.includes('blizzard')) {
      return '⬜';
    }

    if (forecastLower.includes('hot')) {
      return '🟥';
    }

    if (forecastLower.includes('windy') || forecastLower.includes('breezy') ||
        forecastLower.includes('blustery')) {
      return '🟪';
    }

    // Default to white for cloudy or other conditions
    return '⬜';
  }

  formatWeatherForToday(description) {
    // Simplified version of weather description formatting for TODAY mode
    // Remove modifiers and simplify to core weather terms
    const normalizers = [
      // Remove modifiers first
      {to: '', from: ['Mostly', 'Partly', 'Patchy', 'Areas Of', 'Increasing', 'Becoming', 'Decreasing', 'Gradual', 'Slight Chance', 'Chance', 'Slight', 'Very', 'Periods Of', 'Intermittent', 'Isolated', 'Scattered', 'Widespread']},
      // Simplify weather conditions
      {to: 'Rain', from: ['Rain Showers', 'Showers', 'Drizzle', 'Spray', 'Rain Fog']},
      {to: 'Snow', from: ['Snow Showers', 'Wintry Mix', 'Flurries']},
      {to: 'Storm', from: ['Thunderstorms', 'T-storms', 'Tstorms']},
      {to: 'Cloudy', from: ['Clouds', 'Overcast']},
      {to: 'Foggy', from: ['Fog']},
      {to: 'Windy', from: ['Breezy', 'Blustery']},
      {to: 'Clear', from: ['Fair']},
      // Intensity modifiers after simplification
      {to: 'Light', from: ['Lt ', 'Light']},
      {to: 'Heavy', from: ['Heavy']},
      {to: '&', from: ['And']}
    ];

    const maxLength = 10; // Max chars for weather description

    let formatted = normalizers.reduce((d, {to, from}) =>
      d.replaceAll(new RegExp(from.sort((a, b) => b.length - a.length).join('|'), 'gi'), to),
      description
    );

    // Clean up multiple spaces and trim
    formatted = formatted.replace(/\s+/g, ' ').trim();

    // First try the full formatted string if it fits
    if (formatted.length <= maxLength) {
      return formatted;
    }

    // Take first significant word that fits
    const words = formatted.split(/\s+/).filter(w => w.length > 0);

    // Try to find a good weather word
    for (const word of words) {
      if (word.length <= maxLength && word.length > 0) {
        // Remove trailing punctuation (comma, etc.) when only returning partial result
        return word.replace(/[,.:;!?]+$/, '');
      }
    }

    // If no word fits, truncate
    return formatted.substring(0, maxLength);
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

  setupFiveDayWeatherMode() {
    this.setupCronJob(Mode.FIVEDAY_WEATHER, () => this.updateFiveDayWeather());
  }

  setupOneDayWeatherMode() {
    this.setupCronJob(Mode.ONEDAY_WEATHER, () => this.updateOneDayWeather());
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