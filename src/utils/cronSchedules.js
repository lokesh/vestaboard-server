export const CronSchedules = {
  CLOCK: {
    schedule: '* * * * *',
    description: 'Updates every minute'
  },
  WEATHER: {
    schedule: '0 6,12,18 * * *',
    description: 'Updates at 6am, noon, and 6pm PST every day'
  },
  CALENDAR: {
    schedule: '0 * * * *',
    description: 'Updates every hour'
  },
  MANUAL: {
    schedule: '',
    description: 'No automatic updates (Manual mode)'
  }
}; 