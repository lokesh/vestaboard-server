import { format } from 'date-fns';

/**
 * Formats the KIERAN mode board — a kid-friendly daily summary.
 *
 *   WEDNESDAY OCT 18
 *   🟩 SCHOOL DAY
 *   MORNING   58° 🟨 SUNNY
 *   AFTERNOON 64° 🟨 SUNNY
 *   EVENING   60° 🟦 RAIN
 *   🟦 RAIN 4PM-7PM
 *
 * Color key: green = school, red = no school, blue = rain,
 * yellow = sunny, white = cloudy/foggy/snow, violet = windy/chilly/birthday, red = hot.
 *
 * Row priority: rain always owns the callout row. A birthday takes the callout
 * row otherwise, and on a rainy weekend it takes the school row instead.
 */

const COLS = 22;

const RED = '\u{1F7E5}';
const YELLOW = '\u{1F7E8}';
const GREEN = '\u{1F7E9}';
const BLUE = '\u{1F7E6}';
const VIOLET = '\u{1F7EA}';
const WHITE = '⬜';

export const PERIODS = [
  { label: 'MORNING', start: 7, end: 12 },
  { label: 'AFTERNOON', start: 12, end: 16 },
  { label: 'EVENING', start: 16, end: 20 }
];

const DAY_START = PERIODS[0].start;
const DAY_END = PERIODS[PERIODS.length - 1].end;

const HOT_TEMP = 85;
const CHILLY_TEMP = 50;

// Emoji are one board cell but may be two JS chars — count cells, not chars.
const cells = (str) => Array.from(str).length;
const fitToBoard = (str) => Array.from(str).slice(0, COLS).join('');

/**
 * 'rain' = forecast says it will rain, 'maybe' = hedged (chance/patchy/isolated), 'none' otherwise.
 */
export function rainLevel(forecast = '') {
  const f = forecast.toLowerCase();
  if (!/rain|shower|drizzle|thunder|storm|sleet/.test(f)) return 'none';
  return /chance|patchy|isolated|slight|possible/.test(f) ? 'maybe' : 'rain';
}

function classifyCondition(forecast = '') {
  const f = forecast.toLowerCase();
  const rain = rainLevel(forecast);
  if (rain === 'rain') return { emoji: BLUE, word: 'RAIN' };
  if (rain === 'maybe') return { emoji: BLUE, word: 'RAIN?' };
  if (/snow|ice|blizzard|flurr/.test(f)) return { emoji: WHITE, word: 'SNOW' };
  if (/fog|mist/.test(f)) return { emoji: WHITE, word: 'FOGGY' };
  if (/cloud|overcast/.test(f)) return { emoji: WHITE, word: 'CLOUDY' };
  if (/wind|breez|blust/.test(f)) return { emoji: VIOLET, word: 'WINDY' };
  if (/sunny|clear|fair/.test(f)) return { emoji: YELLOW, word: 'SUNNY' };
  return { emoji: WHITE, word: 'CLOUDY' };
}

/**
 * NWS hourly data can run past midnight into tomorrow. Cut it off where the
 * hour counter wraps so we only ever describe today.
 */
export function trimToToday(hourlyData = []) {
  const result = [];
  for (const entry of hourlyData) {
    if (result.length && entry.hour < result[result.length - 1].hour) break;
    result.push(entry);
  }
  return result;
}

function formatHour(hour) {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? 'AM' : 'PM'}`;
}

function formatHourRange(hours) {
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  if (first <= DAY_START && last >= DAY_END - 1) return 'ALL DAY';
  if (first === last) return formatHour(first);
  return `${formatHour(first)}-${formatHour(last + 1)}`;
}

/**
 * @param {Date} zonedNow - a Date whose local getters reflect PST (from nowInTz)
 */
export function formatDateLine(zonedNow) {
  return format(zonedNow, 'EEEE MMM d').toUpperCase();
}

/**
 * @param {Date} zonedNow - a Date whose local getters reflect PST (from nowInTz)
 * @param {string|null} noSchoolReason - holiday or school-break label, if any
 */
export function formatSchoolLine(zonedNow, noSchoolReason) {
  const dow = zonedNow.getDay();
  const isWeekend = dow === 0 || dow === 6;

  if (!isWeekend && !noSchoolReason) return `${GREEN} SCHOOL DAY`;

  if (noSchoolReason) {
    const name = noSchoolReason.toUpperCase();
    const withLabel = `${RED} NO SCHOOL - ${name}`;
    return cells(withLabel) <= COLS ? withLabel : fitToBoard(`${RED} ${name}`);
  }

  return `${RED} NO SCHOOL`;
}

/**
 * One line per period: "AFTERNOON 64° 🟨 SUNNY". Temperature is the period average.
 * Any rain in the period wins over the dominant condition.
 */
export function formatPeriodLine(period, hourlyData) {
  const label = period.label.padEnd(9);
  const hours = hourlyData.filter(h => h.hour >= period.start && h.hour < period.end);

  if (!hours.length) return `${label} --`;

  const avgTemp = Math.round(hours.reduce((sum, h) => sum + h.temperature, 0) / hours.length);

  let condition;
  const rainy = hours.find(h => rainLevel(h.shortForecast) === 'rain');
  const maybeRainy = hours.find(h => rainLevel(h.shortForecast) === 'maybe');
  if (rainy) {
    condition = classifyCondition(rainy.shortForecast);
  } else if (maybeRainy) {
    condition = classifyCondition(maybeRainy.shortForecast);
  } else {
    const counts = new Map();
    for (const h of hours) {
      const key = classifyCondition(h.shortForecast).word;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dominantWord = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    condition = classifyCondition(hours.find(h => classifyCondition(h.shortForecast).word === dominantWord).shortForecast);
  }

  const prefix = `${label} ${avgTemp}° ${condition.emoji} `;
  const room = COLS - cells(prefix);
  return `${prefix}${condition.word.slice(0, Math.max(room, 0))}`;
}

function daytimeScope(hourlyData, currentHour) {
  const today = hourlyData.filter(h => h.hour >= DAY_START && h.hour < DAY_END);
  const upcoming = today.filter(h => h.hour >= currentHour);
  return { today, scope: upcoming.length ? upcoming : today };
}

/**
 * Rain still to come today (from now onward). Returns null if none.
 * @returns {{ level: 'rain'|'maybe', hours: number[] } | null}
 */
export function upcomingRain(hourlyData, currentHour) {
  const { scope } = daytimeScope(hourlyData, currentHour);

  const rainHours = scope.filter(h => rainLevel(h.shortForecast) === 'rain').map(h => h.hour);
  if (rainHours.length) return { level: 'rain', hours: rainHours };

  const maybeHours = scope.filter(h => rainLevel(h.shortForecast) === 'maybe').map(h => h.hour);
  if (maybeHours.length) return { level: 'maybe', hours: maybeHours };

  return null;
}

/**
 * Bottom-row callout. Rain is the headline; otherwise hot/chilly tips; otherwise reassurance.
 * Only looks at hours from now onward so the advice is actionable.
 */
export function formatAlertLine(hourlyData, currentHour) {
  const { today, scope } = daytimeScope(hourlyData, currentHour);

  const rain = upcomingRain(hourlyData, currentHour);
  if (rain?.level === 'rain') return fitToBoard(`${BLUE} RAIN ${formatHourRange(rain.hours)}`);
  if (rain?.level === 'maybe') return fitToBoard(`${BLUE} MAYBE RAIN ${formatHourRange(rain.hours)}`);

  if (scope.length) {
    const maxTemp = Math.max(...scope.map(h => h.temperature));
    if (maxTemp >= HOT_TEMP) return `${RED} HOT! DRINK WATER`;

    const morning = scope.filter(h => h.hour < PERIODS[0].end);
    if (morning.length && Math.min(...morning.map(h => h.temperature)) < CHILLY_TEMP) {
      return `${VIOLET} CHILLY - WEAR A COAT`;
    }
  }

  const rainedEarlier = today.some(h => h.hour < currentHour && rainLevel(h.shortForecast) !== 'none');
  return rainedEarlier ? 'NO MORE RAIN TODAY' : 'NO RAIN TODAY';
}

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

/**
 * First names from calendar birthday events, e.g. "🎂 Maya Chen's Birthday" → "Maya".
 * @param {Array<{summary: string}>} events
 */
export function extractBirthdayNames(events = []) {
  return events
    .map(event => (event.summary || '')
      .replace(EMOJI_RE, '')
      .replace(/birthday/gi, '')
      .replace(/'s\b/gi, '')
      .replace(/^[^a-z]+/i, '')
      .trim()
      .split(/\s+/)[0])
    .filter(Boolean);
}

/**
 * "🟪 MAYA'S BIRTHDAY!" for one name, "🟪 BDAY: MAYA, LEO" for several.
 * @param {string[]} names
 */
export function formatBirthdayLine(names) {
  if (!names?.length) return null;
  const upper = names.map(n => n.toUpperCase());

  if (upper.length === 1) {
    const single = `${VIOLET} ${upper[0]}'S BIRTHDAY!`;
    if (cells(single) <= COLS) return single;
  }

  // Add names while they fit; summarize the rest as "+N" instead of cutting a name in half.
  const prefix = `${VIOLET} BDAY: `;
  const shown = [];
  for (let i = 0; i < upper.length; i++) {
    const remaining = upper.length - i - 1;
    const candidate = [...shown, upper[i]].join(', ') + (remaining ? ` +${remaining}` : '');
    if (cells(prefix + candidate) > COLS) break;
    shown.push(upper[i]);
  }
  if (!shown.length) return fitToBoard(prefix + upper[0]);
  const rest = upper.length - shown.length;
  return `${prefix}${shown.join(', ')}${rest ? ` +${rest}` : ''}`;
}

/**
 * Build the full 6-line board text.
 * @param {object} opts
 * @param {Date} opts.zonedNow - from nowInTz()
 * @param {Array<{hour:number, temperature:number, shortForecast:string}>} opts.hourlyData
 * @param {string|null} opts.noSchoolReason - holiday or school-break label
 * @param {string[]} [opts.birthdays] - first names with a birthday today
 */
export function formatKieranBoard({ zonedNow, hourlyData, noSchoolReason, birthdays = [] }) {
  const todayHours = trimToToday(hourlyData);
  const currentHour = zonedNow.getHours();

  let schoolLine = formatSchoolLine(zonedNow, noSchoolReason);
  let calloutLine = formatAlertLine(todayHours, currentHour);

  const birthdayLine = formatBirthdayLine(birthdays);
  if (birthdayLine) {
    const rainAhead = upcomingRain(todayHours, currentHour) !== null;
    const dow = zonedNow.getDay();
    const plainWeekend = (dow === 0 || dow === 6) && !noSchoolReason;

    if (!rainAhead) {
      calloutLine = birthdayLine;
    } else if (plainWeekend) {
      schoolLine = birthdayLine;
    }
  }

  const rows = [
    formatDateLine(zonedNow),
    schoolLine,
    ...PERIODS.map(p => formatPeriodLine(p, todayHours)),
    calloutLine
  ];

  return rows.map(fitToBoard).join('\n');
}
