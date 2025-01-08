export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Get current time in PST
    const now = new Date();
    // Force the date to be interpreted in America/Los_Angeles timezone
    const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const isPastSixPM = pstNow.getHours() >= 18;

    // Create tomorrow at midnight PST, properly accounting for UTC offset
    const pstTomorrow = new Date(pstNow);
    pstTomorrow.setDate(pstTomorrow.getDate() + 1);
    pstTomorrow.setHours(0, 0, 0, 0);
    
    // Convert PST midnight to UTC for comparison (add 8 hours)
    const tomorrowUTC = new Date(pstTomorrow);
    tomorrowUTC.setHours(tomorrowUTC.getHours() + 8);

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        // The API provides dates with timezone info (-08:00), so we can use them directly
        const periodDate = new Date(period.startTime);
        return period.isDaytime && (!isPastSixPM || periodDate >= tomorrowUTC);
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
      pstTomorrow: pstTomorrow.toISOString(),
      tomorrowUTC: tomorrowUTC.toISOString(),
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