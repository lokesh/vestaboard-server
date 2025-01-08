export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Get current time in PST
    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const isPastSixPM = pstTime.getHours() >= 18;
    const tomorrow = new Date(pstTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        const periodDate = new Date(period.startTime);
        return period.isDaytime && (!isPastSixPM || periodDate >= tomorrow);
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));
      /* Example output:
      [
        {
          date: "12/23/2024",
          temperature: 64,
          probabilityOfPrecipitation: 20,
          windSpeed: "3 to 8 mph",
          shortForecast: "Mostly Cloudy then Slight Chance Light Rain"
        },
        // ... 5 more days
      ]
      */
     console.log(weatherData);
    return weatherData;
  } catch (error) {
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 