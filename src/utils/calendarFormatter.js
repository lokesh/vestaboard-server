/**
 * Formats calendar events for display on the board
 * @param {Array} events Array of calendar events with date and summary
 * @returns {string} Formatted events string
 */
export function formatCalendarEvents(events) {
  if (!events?.length) return '';
  
  const maxDisplayEvents = 5;
  const maxTitleLength = 14; // Leaving room for time and emoji
  const now = new Date();
  const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const today = new Date(pstNow);
  today.setHours(0, 0, 0, 0);

  // Filter out completed events
  const activeEvents = events.filter(event => {
    const eventEndTime = new Date(event.end.dateTime);
    const pstEventEndTime = new Date(eventEndTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return pstEventEndTime > pstNow;
  });

  if (!activeEvents.length) return '';

  let currentDate = null;
  
  return activeEvents
    .slice(0, maxDisplayEvents)
    .map(event => {
      const eventDate = new Date(event.start.dateTime);
      const pstEventDate = new Date(eventDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const eventDay = new Date(pstEventDate);
      eventDay.setHours(0, 0, 0, 0);
      
      // Determine if we need to show a date header
      let dateHeader = '';
      if (currentDate?.getTime() !== eventDay.getTime()) {
        currentDate = eventDay;
        
        if (eventDay.getTime() === today.getTime()) {
          // Don't show "Today" header
          dateHeader = '';
        } else if (eventDay.getTime() === today.getTime() + 86400000) {
          dateHeader = 'Tomorrow\n';
        } else {
          dateHeader = `${pstEventDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
          })}\n`;
        }
      }

      // Format the time
      const timeStr = pstEventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Los_Angeles'
      }).toLowerCase().replace(/\s/g, '');

      // Determine emoji color based on date
      const emoji = eventDay.getTime() === today.getTime() ? '🟩' : '🟨';

      // Clean up the summary by removing emojis and leading spaces
      const cleanSummary = event.summary
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .trim();

      // Format and truncate the title
      const title = cleanSummary.length > maxTitleLength 
        ? cleanSummary.substring(0, maxTitleLength - 1) + '…'
        : cleanSummary.padEnd(maxTitleLength, ' ');

      return `${dateHeader}${emoji}${timeStr} ${title}`;
    })
    .join('\n')
    .trim();
} 