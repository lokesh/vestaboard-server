/**
 * No-school dates for KIRAN mode, on top of weekends.
 *
 * Source: the Friends of St. Francis Childcare Center 2026-2027 holiday
 * schedule, as entered in the "Sarah & Lokesh" Google Calendar
 * ("St. Francis Closed – ..." events). Dates are inclusive, local (PST).
 *
 * St. Francis is year-round childcare, so there is no summer break, and it
 * stays open on some federal holidays (e.g. Presidents' Day). Within the
 * period this list covers it is the only source of closures; the generic
 * federal-holiday list is not consulted.
 *
 * Update this file each school year.
 */

// Last date the list below is known to cover. After this, callers fall back
// to federal holidays so a stale file doesn't show every holiday as a school day.
export const SCHEDULE_COVERS_THROUGH = '2027-06-30';

// Labels show on the board as "🟥 NO SCHOOL - <label>" when that fits in 22 cells,
// otherwise as "🟥 <label>". Keep labels short.
export const SCHOOL_CLOSURES = [
  { start: '2026-09-07', end: '2026-09-07', label: 'Labor Day' },
  { start: '2026-10-12', end: '2026-10-12', label: 'Staff Day' },
  { start: '2026-11-11', end: '2026-11-11', label: 'Veterans Day' },
  { start: '2026-11-26', end: '2026-11-27', label: 'Thanksgiving' },
  { start: '2026-12-24', end: '2027-01-01', label: 'Winter Break' },
  { start: '2027-01-18', end: '2027-01-18', label: 'MLK Day' },
  { start: '2027-04-02', end: '2027-04-02', label: 'Staff Day' },
  { start: '2027-05-31', end: '2027-05-31', label: 'Memorial Day' },
  { start: '2027-06-18', end: '2027-06-18', label: 'Juneteenth' }
];

function toKey(zonedDate) {
  const y = zonedDate.getFullYear();
  const m = String(zonedDate.getMonth() + 1).padStart(2, '0');
  const d = String(zonedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {Date} zonedNow - a Date whose local getters reflect PST (from nowInTz)
 * @returns {string|null} closure label if St. Francis is closed today, else null
 */
export function getSchoolClosure(zonedNow) {
  const key = toKey(zonedNow);
  const closure = SCHOOL_CLOSURES.find(c => key >= c.start && key <= c.end);
  return closure ? closure.label : null;
}

/**
 * @param {Date} zonedNow - a Date whose local getters reflect PST (from nowInTz)
 * @returns {boolean} true once today is past the dates this file covers
 */
export function isPastSchedule(zonedNow) {
  return toKey(zonedNow) > SCHEDULE_COVERS_THROUGH;
}
