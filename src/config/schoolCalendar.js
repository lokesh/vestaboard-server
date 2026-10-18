/**
 * No-school dates for KIERAN mode, on top of weekends and the federal holidays
 * in modeController.getHolidayForDate().
 *
 * Seeded from the SFUSD 2026-27 calendar as published on third-party calendar
 * mirrors (agendahero.com, educounty.net) — confirm against the official SFUSD
 * calendar and adjust for Kieran's actual school. Dates are inclusive, local (PST).
 *
 * Update this file each school year.
 */

// First and last instructional days. Anything outside is summer break.
export const SCHOOL_YEAR = {
  firstDay: '2026-08-17',
  lastDay: '2027-06-02'
};

// Labels show on the board as "🟥 NO SCHOOL - <label>" when that fits in 22 cells,
// otherwise as "🟥 <label>". Keep labels short.
export const SCHOOL_BREAKS = [
  { start: '2026-11-23', end: '2026-11-27', label: 'Fall Break' },
  { start: '2026-12-21', end: '2027-01-01', label: 'Winter Break' },
  { start: '2027-03-26', end: '2027-04-02', label: 'Spring Break' }
  // Single days work too: { start: '2026-11-11', end: '2026-11-11', label: 'Veterans Day' }
];

function toKey(zonedDate) {
  const y = zonedDate.getFullYear();
  const m = String(zonedDate.getMonth() + 1).padStart(2, '0');
  const d = String(zonedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {Date} zonedNow - a Date whose local getters reflect PST (from nowInTz)
 * @returns {string|null} break label if today is a school break, else null
 */
export function getSchoolBreak(zonedNow) {
  const key = toKey(zonedNow);

  for (const b of SCHOOL_BREAKS) {
    if (key >= b.start && key <= b.end) return b.label;
  }

  if (key < SCHOOL_YEAR.firstDay || key > SCHOOL_YEAR.lastDay) return 'Summer Break';

  return null;
}
