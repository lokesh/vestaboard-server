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
import { nowInTz, toTz, formatInTz, TIMEZONE } from '../utils/timezone.js';

const MISMATCH_THRESHOLD = 3; // Consecutive mismatches before reverting to MANUAL

class ModeController {
  constructor() {
    this._currentMode = Mode.MANUAL;
    this.cronJobs = new Map();
    this._mismatchCounts = new Map(); // Track consecutive pattern mismatches per mode
    // Do NOT call initialize() here — caller must await it
  }

  async initialize() {
    try {
      this._currentMode = await getCurrentMode();
      console.log('Initialized current mode from Redis:', this._currentMode);

      if (this._currentMode !== Mode.MANUAL) {
        await this.setMode(this._currentMode);
      }
    } catch (error) {
      console.error('Error initializing mode controller:', error);
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

    this.stopAllCronJobs();
    this._mismatchCounts.clear();
    this._currentMode = mode;

    await saveCurrentMode(mode);

    switch (mode) {
      case Mode.CLOCK:
        await this.updateClock(true);
        this.setupCronJob(Mode.CLOCK, () => this.updateClock());
        break;
      case Mode.FIVEDAY_WEATHER:
        await this.updateFiveDayWeather(true);
        this.setupCronJob(Mode.FIVEDAY_WEATHER, () => this.updateFiveDayWeather());
        break;
      case Mode.ONEDAY_WEATHER:
        await this.updateOneDayWeather(true);
        this.setupCronJob(Mode.ONEDAY_WEATHER, () => this.updateOneDayWeather());
        break;
      case Mode.CALENDAR:
        await this.updateCalendar(true);
        this.setupCronJob(Mode.CALENDAR, () => this.updateCalendar());
        break;
      case Mode.TODAY:
        await this.updateToday(true);
        this.setupCronJob(Mode.TODAY, () => this.updateToday());
        break;
      case Mode.MANUAL:
        break;
    }
  }

  /**
   * Check pattern match with grace period. Returns true if update should proceed.
   */
  async _shouldUpdate(mode, initialUpdate) {
    if (initialUpdate) {
      this._mismatchCounts.set(mode, 0);
      return true;
    }

    const currentContent = await boardService.getCurrentBoardContent();
    const matcher = PatternMatcherFactory.createMatcher(mode);
    const isMatch = matcher ? matcher.matches(currentContent) : false;

    if (isMatch) {
      this._mismatchCounts.set(mode, 0);
      return true;
    }

    // Pattern mismatch — increment counter
    const count = (this._mismatchCounts.get(mode) || 0) + 1;
    this._mismatchCounts.set(mode, count);
    console.log(`Pattern mismatch for ${mode}: ${count}/${MISMATCH_THRESHOLD}`);

    if (count >= MISMATCH_THRESHOLD) {
      console.log(`${MISMATCH_THRESHOLD} consecutive mismatches for ${mode} — reverting to MANUAL`);
      this.stopAllCronJobs();
      this._currentMode = Mode.MANUAL;
      await saveCurrentMode(Mode.MANUAL);
      return false;
    }

    // Under threshold — skip this update but keep the mode
    return false;
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

    if (await this._shouldUpdate(Mode.CLOCK, initialUpdate)) {
      await boardService.updateBoard(time);
    }
  }

  async updateFiveDayWeather(initialUpdate = false) {
    const weatherData = await getWeatherData();

    const formattedWeather = weatherData.slice(0, 6).map(row => {
      const pstDate = toTz(new Date(row.date));

      const dayAbbrev = formatInTz(new Date(row.date), 'EEE').toUpperCase().slice(0, 3);

      const tempStr = `${Math.round(row.temperature)}`.padStart(2, ' ');

      let emoji = '\u{1F7EA}';
      if (row.temperature >= 40) emoji = '\u{1F7E9}';
      if (row.temperature >= 55) emoji = '\u{1F7E8}';
      if (row.temperature >= 70) emoji = '\u{1F7E7}';
      if (row.temperature >= 80) emoji = '\u{1F7E5}';

      const pstNow = nowInTz();
      const isTonight = pstNow.toDateString() === pstDate.toDateString() &&
                       pstDate.getHours() === 23;

      const conditionTable = [
        ['\u{1F7E5}', ['Hot']],
        [isTonight ? '\u2B1B' : '\u{1F7E7}', ['Dust', 'Sand']],
        [isTonight ? '\u2B1B' : emoji, ['Sunny', 'Clear', 'Fair', 'Haze']],
        [isTonight ? '\u2B1B' : '\u{1F7E9}', ['Windy', 'Breezy', 'Blustery']],
        ['\u{1F7EA}', ['Frost', 'Cold']],
        ['\u2B1B', ['Cloud', 'Overcast', 'Fog', 'Smoke', 'Ash', 'Storm']],
        ['\u{1F7E6}', ['Sleet', 'Spray', 'Rain', 'Shower', 'Spouts', 'Drizzle']],
        ['\u2B1C', ['Snow', 'Ice', 'Blizzard']]
      ];

      const finalEmoji = conditionTable.find(([_, conditions]) =>
        conditions.some(condition => row.shortForecast.includes(condition)))?.[0] || emoji;

      const formattedDescription = formatWeatherDescription(row.shortForecast);

      return `${dayAbbrev} ${tempStr} ${finalEmoji}${formattedDescription}`;
    }).join('\n');

    if (await this._shouldUpdate(Mode.FIVEDAY_WEATHER, initialUpdate)) {
      await boardService.updateBoard(formattedWeather);
    }
  }

  async updateCalendar(initialUpdate = false) {
    try {
      const events = await getCalendarEvents(5);
      const formattedEvents = formatCalendarEvents(events);

      if (await this._shouldUpdate(Mode.CALENDAR, initialUpdate)) {
        await boardService.updateBoard(formattedEvents);
      }
    } catch (error) {
      console.error('Calendar update failed:', error.message);
      if (error.message.includes('authenticate first')) {
      }
      throw error;
    }
  }

  async updateOneDayWeather(initialUpdate = false) {
    const hourlyData = await getHourlyWeatherData();

    const now = new Date();
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const monthStr = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const dateStr = now.getDate().toString();
    const firstLine = `${dayStr} ${monthStr} ${dateStr}`;

    const temperatures = hourlyData
      .filter((_, index) => index % 4 === 0)
      .map(data => data.temperature.toString().padStart(2, ' '));

    const tempLine = temperatures.join('\u00B0 ');

    const sunData = await getSunData();

    const getWeatherEmoji = (forecastUpper, dateTime) => {
      const forecast = forecastUpper.toLowerCase();
      const whiteConditions = ['cloud', 'overcast', 'fog', 'smoke', 'ash', 'storm', 'snow', 'ice', 'blizzard'];
      const yellowConditions = ['sunny', 'clear', 'fair', 'haze'];
      const redConditions = ['hot'];
      const purpleConditions = ['windy', 'breezy', 'blustery'];

      if (forecast.includes('thunderstorms')) return '\u{1F7E6}';
      if (forecast.includes('rain') || forecast.includes('shower') || forecast.includes('drizzle')) {
        if (!forecast.includes('chance') && !forecast.includes('patchy')) return '\u{1F7E6}';
      }

      if (dateTime < sunData.sunrise || dateTime > sunData.sunset) return '-';
      if (yellowConditions.some(c => forecast.includes(c))) return '\u{1F7E8}';
      if (whiteConditions.some(c => forecast.includes(c))) return '\u2B1C';
      if (redConditions.some(c => forecast.includes(c))) return '\u{1F7E5}';
      if (purpleConditions.some(c => forecast.includes(c))) return '\u{1F7EA}';

      return '\u2B1C';
    };

    const boxes = hourlyData
      .map(data => {
        const dateTime = new Date();
        dateTime.setHours(data.hour, 0, 0, 0);
        return getWeatherEmoji(data.shortForecast, dateTime);
      })
      .join('');

    const timeLabels = hourlyData
      .filter((_, index) => index % 4 === 0)
      .map(data => {
        const hour = data.hour % 12 || 12;
        const ampm = data.hour < 12 ? 'a' : 'p';
        return `${hour}${ampm}${hour < 10 ? '  ' : ' '}`;
      })
      .join('');

    const content = `${firstLine}\n\n${tempLine}\n${boxes}\n${timeLabels}`;

    if (await this._shouldUpdate(Mode.ONEDAY_WEATHER, initialUpdate)) {
      await boardService.updateBoard(content);
    }
  }

  async updateToday(initialUpdate = false) {
    const pstNow = nowInTz();

    const monthStr = formatInTz(new Date(), 'MMM').toUpperCase();
    const dateStr = pstNow.getDate();
    const row1 = `${monthStr} ${dateStr}`;

    const holiday = this.getHolidayForDate(pstNow);

    const birthdays = await this.getTodaysBirthdays();
    const birthdayStr = this.formatBirthdays(birthdays);

    let row2 = '';
    let row3 = '';

    if (holiday) {
      row2 = holiday;
      row3 = birthdayStr;
    } else {
      row2 = birthdayStr;
      row3 = '';
    }

    const weatherRows = await this.getWeatherSummary();

    const rows = [row1, row2, row3, weatherRows.morning, weatherRows.midday, weatherRows.evening];
    const content = rows.join('\n');

    console.log('[TODAY DEBUG] Content to send:');
    rows.forEach((r, i) => console.log(`  Row ${i}: "${r}" (length: ${r.length})`));
    console.log(`[TODAY DEBUG] Total content length: ${content.length}`);

    if (await this._shouldUpdate(Mode.TODAY, initialUpdate)) {
      console.log('[TODAY DEBUG] _shouldUpdate returned true, calling updateBoard');
      await boardService.updateBoard(content);
      console.log('[TODAY DEBUG] updateBoard completed');
    } else {
      console.log('[TODAY DEBUG] _shouldUpdate returned false, skipping update');
    }
  }

  getHolidayForDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

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

    const dayOfWeek = date.getDay();
    const weekOfMonth = Math.ceil(day / 7);

    if (month === 1 && dayOfWeek === 1 && weekOfMonth === 3) return 'MLK Day';
    if (month === 2 && dayOfWeek === 1 && weekOfMonth === 3) return 'Presidents\' Day';
    if (month === 5 && dayOfWeek === 1 && day > 24) return 'Memorial Day';
    if (month === 9 && dayOfWeek === 1 && day <= 7) return 'Labor Day';
    if (month === 11 && dayOfWeek === 4 && weekOfMonth === 4) return 'Thanksgiving';

    return null;
  }

  async getTodaysBirthdays() {
    try {
      const now = new Date();
      const allDayEvents = await getAllDayEvents(now);
      return allDayEvents.filter(event => /birthday/i.test(event.summary));
    } catch (error) {
      console.error('Error fetching birthdays:', error);
      return [];
    }
  }

  formatBirthdays(birthdays) {
    if (!birthdays || birthdays.length === 0) return '';

    const maxLength = 22;
    const names = birthdays.map(event => {
      let name = event.summary
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/birthday/gi, '')
        .trim();

      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        return `${nameParts[0]} ${nameParts[1][0]}`;
      }
      return nameParts[0];
    });

    let result = names.join(', ');

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

    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 1) + '...';
    }

    return result;
  }

  async getWeatherSummary() {
    try {
      let hourlyData;
      try {
        hourlyData = await getHistoricalAndForecastWeather();
      } catch (vcError) {
        console.warn('Visual Crossing API failed, falling back to NWS:', vcError.message);
        hourlyData = await getHourlyWeatherData();
      }

      const sunData = await getSunData();

      const periods = {
        morning: { start: 8, end: 12 },
        midday: { start: 12, end: 16 },
        evening: { start: 16, end: 20 }
      };

      const formatPeriod = (periodData) => {
        if (!periodData || periodData.length === 0) return '';

        const temps = periodData.map(d => d.temperature);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        const tempStr = `${minTemp}-${maxTemp}\u00B0`;

        const conditions = periodData.map(d => d.shortForecast);
        const conditionCounts = {};
        conditions.forEach(c => { conditionCounts[c] = (conditionCounts[c] || 0) + 1; });
        const mostCommon = Object.keys(conditionCounts).reduce((a, b) =>
          conditionCounts[a] > conditionCounts[b] ? a : b
        );

        const description = this.formatWeatherForToday(mostCommon);

        const blocks = periodData.map(data => {
          const dateTime = new Date();
          dateTime.setHours(data.hour, 0, 0, 0);
          return this.getWeatherEmojiForToday(data.shortForecast, dateTime, sunData);
        }).join('');

        return `${tempStr} ${blocks} ${description}`;
      };

      const morningData = hourlyData.filter(d => d.hour >= periods.morning.start && d.hour < periods.morning.end);
      const middayData = hourlyData.filter(d => d.hour >= periods.midday.start && d.hour < periods.midday.end);
      const eveningData = hourlyData.filter(d => d.hour >= periods.evening.start && d.hour < periods.evening.end);

      return {
        morning: formatPeriod(morningData),
        midday: formatPeriod(middayData),
        evening: formatPeriod(eveningData)
      };
    } catch (error) {
      console.error('Error getting weather summary:', error);
      return { morning: '', midday: '', evening: '' };
    }
  }

  getWeatherEmojiForToday(forecast, dateTime, sunData) {
    const forecastLower = forecast.toLowerCase();

    if (forecastLower.includes('thunderstorms') ||
        (forecastLower.includes('rain') && !forecastLower.includes('chance') && !forecastLower.includes('patchy')) ||
        forecastLower.includes('shower') ||
        forecastLower.includes('drizzle')) {
      return '\u{1F7E6}';
    }

    if (dateTime < sunData.sunrise || dateTime > sunData.sunset) return '\u2B1B';

    if (forecastLower.includes('sunny') || forecastLower.includes('clear') ||
        forecastLower.includes('fair') || forecastLower.includes('haze')) {
      return '\u{1F7E8}';
    }

    if (forecastLower.includes('cloud') || forecastLower.includes('overcast') ||
        forecastLower.includes('fog') || forecastLower.includes('smoke') ||
        forecastLower.includes('ash') || forecastLower.includes('storm') ||
        forecastLower.includes('snow') || forecastLower.includes('ice') ||
        forecastLower.includes('blizzard')) {
      return '\u2B1C';
    }

    if (forecastLower.includes('hot')) return '\u{1F7E5}';

    if (forecastLower.includes('windy') || forecastLower.includes('breezy') ||
        forecastLower.includes('blustery')) {
      return '\u{1F7EA}';
    }

    return '\u2B1C';
  }

  formatWeatherForToday(description) {
    const normalizers = [
      {to: '', from: ['Mostly', 'Partly', 'Patchy', 'Areas Of', 'Increasing', 'Becoming', 'Decreasing', 'Gradual', 'Slight Chance', 'Chance', 'Slight', 'Very', 'Periods Of', 'Intermittent', 'Isolated', 'Scattered', 'Widespread']},
      {to: 'Rain', from: ['Rain Showers', 'Showers', 'Drizzle', 'Spray', 'Rain Fog']},
      {to: 'Snow', from: ['Snow Showers', 'Wintry Mix', 'Flurries']},
      {to: 'Storm', from: ['Thunderstorms', 'T-storms', 'Tstorms']},
      {to: 'Cloudy', from: ['Clouds', 'Overcast']},
      {to: 'Foggy', from: ['Fog']},
      {to: 'Windy', from: ['Breezy', 'Blustery']},
      {to: 'Clear', from: ['Fair']},
      {to: 'Light', from: ['Lt ', 'Light']},
      {to: 'Heavy', from: ['Heavy']},
      {to: '&', from: ['And']}
    ];

    const maxLength = 10;

    let formatted = normalizers.reduce((d, {to, from}) =>
      d.replaceAll(new RegExp(from.sort((a, b) => b.length - a.length).join('|'), 'gi'), to),
      description
    );

    formatted = formatted.replace(/\s+/g, ' ').trim();

    if (formatted.length <= maxLength) return formatted;

    const words = formatted.split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      if (word.length <= maxLength && word.length > 0) {
        return word.replace(/[,.:;!?]+$/, '');
      }
    }

    return formatted.substring(0, maxLength);
  }

  setupCronJob(mode, updateFn) {
    const schedule = CronSchedules[mode]?.schedule;
    if (!schedule) return;

    const job = cron.schedule(schedule, async () => {
      const serverTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      console.log(`[${serverTime}] Starting ${mode} cron job`);
      try {
        await updateFn();
      } catch (error) {
        console.error(`[${serverTime}] Failed ${mode} cron job:`, error.message);
      }
    }, {
      timezone: 'America/Los_Angeles'
    });
    this.cronJobs.set(mode, job);
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

    const currentContent = await boardService.getCurrentBoardContent();
    const matcher = PatternMatcherFactory.createMatcher(mode);
    const matches = matcher ? matcher.matches(currentContent) : false;

    return {
      mode,
      matches,
      description: matcher ? matcher.getDescription() : 'No pattern matcher available'
    };
  }
}

export const modeController = new ModeController();
