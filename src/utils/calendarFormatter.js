import { toTz, nowInTz, formatInTz } from './timezone.js';

const MS_PER_DAY = 86400000;

/**
 * Formats calendar events for display on the board
 * @param {Array} events Array of calendar events with date and summary
 * @returns {string} Formatted events string
 */
export function formatCalendarEvents(events) {
  if (!events?.length) return '';

  const maxDisplayEvents = 5;
  const maxTitleLength = 14;
  const pstNow = nowInTz();
  const today = new Date(pstNow);
  today.setHours(0, 0, 0, 0);

  // Filter out completed events
  const activeEvents = events.filter(event => {
    const pstEnd = toTz(new Date(event.end.dateTime));
    return pstEnd > pstNow;
  });

  if (!activeEvents.length) return '';

  let currentDate = null;

  return activeEvents
    .slice(0, maxDisplayEvents)
    .map(event => {
      const pstEventDate = toTz(new Date(event.start.dateTime));
      const eventDay = new Date(pstEventDate);
      eventDay.setHours(0, 0, 0, 0);

      let dateHeader = '';
      if (currentDate?.getTime() !== eventDay.getTime()) {
        currentDate = eventDay;

        if (eventDay.getTime() === today.getTime()) {
          dateHeader = '';
        } else if (eventDay.getTime() === today.getTime() + MS_PER_DAY) {
          dateHeader = 'Tomorrow\n';
        } else {
          dateHeader = `${formatInTz(new Date(event.start.dateTime), 'MMM d')}\n`;
        }
      }

      const timeStr = formatInTz(new Date(event.start.dateTime), 'h:mma').toLowerCase();

      const emoji = eventDay.getTime() === today.getTime() ? '\u{1F7E9}' : '\u{1F7E8}';

      const cleanSummary = event.summary
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .trim();

      const title = cleanSummary.length > maxTitleLength
        ? cleanSummary.substring(0, maxTitleLength - 1) + '.'
        : cleanSummary.padEnd(maxTitleLength, ' ');

      return `${dateHeader}${emoji}${timeStr} ${title}`;
    })
    .join('\n')
    .trim();
}
