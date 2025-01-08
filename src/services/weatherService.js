import { DateTime } from 'luxon';

export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Get current time in PST
    const pstNow = DateTime.now().setZone('America/Los_Angeles');
    const isPastSixPM = pstNow.hour >= 18;

    // Create tomorrow at midnight PST
    const pstTomorrow = pstNow.plus({ days: 1 }).startOf('day');
    
    console.log('Initial time check:', {
      currentTime: pstNow.toISO(),
      currentHour: pstNow.hour,
      isPastSixPM,
      currentStartOfDay: pstNow.startOf('day').toISO(),
      tomorrowStartOfDay: pstTomorrow.toISO()
    });

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        // Convert period time to PST
        const periodDate = DateTime.fromISO(period.startTime)
                                 .setZone('America/Los_Angeles');
        
        // If it's past 6 PM, we want to exclude any periods before tomorrow
        const shouldInclude = period.isDaytime && 
                            (!isPastSixPM || periodDate >= pstTomorrow);
        
        console.log('Period analysis:', {
          periodOriginal: period.startTime,
          periodInPST: periodDate.toISO(),
          periodDateTime: periodDate.toFormat('yyyy-MM-dd HH:mm'),
          tomorrowDateTime: pstTomorrow.toFormat('yyyy-MM-dd HH:mm'),
          isDaytime: period.isDaytime,
          isPastSixPM,
          isAfterTomorrow: periodDate >= pstTomorrow,
          shouldInclude,
          comparison: {
            periodYear: periodDate.year,
            periodMonth: periodDate.month,
            periodDay: periodDate.day,
            tomorrowYear: pstTomorrow.year,
            tomorrowMonth: pstTomorrow.month,
            tomorrowDay: pstTomorrow.day
          }
        });
        
        return shouldInclude;
      })
      .slice(0, 6)
      .map(period => ({
        date: DateTime.fromISO(period.startTime)
                     .setZone('America/Los_Angeles')
                     .toLocaleString(DateTime.DATE_SHORT),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));

    console.log('Final result:', {
      serverTime: DateTime.now().toISO(),
      pstTime: pstNow.toISO(),
      isPastSixPM,
      pstTomorrow: pstTomorrow.toISO(),
      firstPeriodTime: data.properties.periods[0].startTime,
      firstPeriodInPST: DateTime.fromISO(data.properties.periods[0].startTime)
                               .setZone('America/Los_Angeles')
                               .toISO(),
      includedDates: weatherData.map(d => d.date),
      totalPeriodsBeforeFilter: data.properties.periods.length,
      totalPeriodsAfterFilter: weatherData.length
    });

    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 