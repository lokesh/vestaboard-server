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
    
    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        const periodDate = DateTime.fromISO(period.startTime);
        const shouldInclude = period.isDaytime && (!isPastSixPM || periodDate >= pstTomorrow);
        console.log('Period:', period.startTime, 
                   'Include?:', shouldInclude, 
                   'isDaytime:', period.isDaytime, 
                   'isPastSixPM:', isPastSixPM, 
                   'periodDate >= pstTomorrow:', periodDate >= pstTomorrow,
                   'periodDate:', periodDate.toISO(),
                   'pstTomorrow:', pstTomorrow.toISO());
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

    console.log({
      serverTime: DateTime.now().toISO(),
      pstTime: pstNow.toISO(),
      isPastSixPM,
      pstTomorrow: pstTomorrow.toISO(),
      firstPeriodTime: data.properties.periods[0].startTime,
      firstPeriodDateTime: DateTime.fromISO(data.properties.periods[0].startTime).toISO(),
      includedDates: weatherData.map(d => d.date)
    });

    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 