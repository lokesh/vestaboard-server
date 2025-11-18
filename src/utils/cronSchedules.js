export const CronSchedules = {
  CLOCK: {
    schedule: '* * * * *',
    description: 'Updates every minute'
  },
  '5DAYWEATHER': {
    schedule: '0 6,12,18 * * *',
    description: 'Updates at 6am, noon, and 6pm PST every day'
  },
  '1DAYWEATHER': {
    schedule: '0 6,9,12,15,18 * * *',
    description: 'Updates at 6am, 9am, noon, 3pm, and 6pm PST every day'
  },
  TODAY: {
    schedule: '0 6,9,12,15,18 * * *',
    description: 'Updates at 6am, 9am, noon, 3pm, and 6pm PST every day'
  },
  CALENDAR: {
    schedule: '0 * * * *',
    description: 'Updates every hour'
  },
  MANUAL: {
    schedule: '',
    description: ''
  }
};