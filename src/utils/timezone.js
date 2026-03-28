import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

export const TIMEZONE = 'America/Los_Angeles';

/**
 * Get the current time in PST/PDT as a proper Date-like object.
 * Returns a Date whose local getters (getHours, getDate, etc.) reflect PST values.
 */
export function nowInTz() {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Convert a UTC Date to PST/PDT.
 */
export function toTz(date) {
  return toZonedTime(date, TIMEZONE);
}

/**
 * Format a date in PST/PDT using date-fns format tokens.
 */
export function formatInTz(date, formatStr) {
  return format(toZonedTime(date, TIMEZONE), formatStr, { timeZone: TIMEZONE });
}
