export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Get current time in PST
    const now = new Date();
    // Force the date to be interpreted in America/Los_Angeles timezone
    const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const isPastSixPM = pstNow.getHours() >= 18;

    // Create tomorrow at midnight PST
    const tomorrow = new Date(pstNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // Convert tomorrow to UTC timestamp for comparison
    const tomorrowUTC = Date.UTC(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      0, 0, 0
    );

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        // Get UTC timestamp from the API's period time
        const periodUTC = new Date(period.startTime).getTime();
        return period.isDaytime && (!isPastSixPM || periodUTC >= tomorrowUTC);
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));

    console.log({
      serverTime: now.toISOString(),
      pstTime: pstNow.toISOString(),
      isPastSixPM,
      tomorrowUTC: new Date(tomorrowUTC).toISOString(),
      firstPeriodTime: data.properties.periods[0].startTime,
      firstPeriodUTC: new Date(data.properties.periods[0].startTime).toISOString(),
      includedDates: weatherData.map(d => d.date)
    });

    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 