export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Filter only daytime periods and get first 6 days
    const weatherData = data.properties.periods
      .filter(period => period.isDaytime)
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString(),
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
    return weatherData;
  } catch (error) {
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 