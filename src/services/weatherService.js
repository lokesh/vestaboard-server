export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Get current time (will be in PST due to TZ env variable)
    const now = new Date();
    const isPastSixPM = now.getHours() >= 18;

    // Create tomorrow at midnight
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    console.log('Time check:', {
      currentTime: now.toISOString(),
      currentHour: now.getHours(),
      isPastSixPM,
      tomorrow: tomorrow.toISOString()
    });

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        const periodDate = new Date(period.startTime);
        const shouldInclude = period.isDaytime && (!isPastSixPM || periodDate >= tomorrow);

        console.log('Period:', {
          original: period.startTime,
          parsed: periodDate.toISOString(),
          hour: periodDate.getHours(),
          isDaytime: period.isDaytime,
          isPastSixPM,
          isAfterTomorrow: periodDate >= tomorrow,
          shouldInclude
        });

        return shouldInclude;
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString(),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));

    console.log('Result:', {
      currentTime: now.toISOString(),
      isPastSixPM,
      tomorrow: tomorrow.toISOString(),
      firstPeriod: data.properties.periods[0].startTime,
      includedDates: weatherData.map(d => d.date),
      totalPeriods: data.properties.periods.length,
      includedPeriods: weatherData.length
    });

    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 