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

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        const periodDate = new Date(period.startTime);
        return period.isDaytime && (!isPastSixPM || periodDate >= tomorrow);
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString(),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));

    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
};

export const getHourlyWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast/hourly');
    const data = await response.json();

    // Get current time in PST
    const now = new Date();

    // Get next 22 hours of forecast data
    const hourlyData = data.properties.periods
      .filter(period => {
        const periodDate = new Date(period.startTime);
        return periodDate >= now;
      })
      .slice(0, 22)
      .map(period => ({
        hour: new Date(period.startTime).getHours(),
        temperature: Math.round(period.temperature),
        shortForecast: period.shortForecast
      }));

    return hourlyData;
  } catch (error) {
    console.error('Hourly weather service error:', error);
    throw new Error(`Failed to fetch hourly weather data: ${error.message}`);
  }
};

export const getSunData = async () => {
  try {
    // Get today's date in PST
    const today = new Date();
    const pstDate = today.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
    
    const response = await fetch(`https://api.sunrise-sunset.org/json?lat=37.7749&lng=-122.4194&formatted=0&date=${pstDate}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error('Failed to get sun data');
    }

    // Convert UTC times to PST
    const sunriseUTC = new Date(data.results.sunrise);
    const sunsetUTC = new Date(data.results.sunset);

    return {
      sunrise: new Date(sunriseUTC.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })),
      sunset: new Date(sunsetUTC.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })),
    };
  } catch (error) {
    console.error('Sun data service error:', error);
    throw new Error(`Failed to fetch sun data: ${error.message}`);
  }
}; 