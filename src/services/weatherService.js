export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Create a formatter that will help us work with PST dates
    const pstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Get current time in PST
    const now = new Date();
    const pstDateParts = pstFormatter.formatToParts(now);
    const pstDate = new Date(pstDateParts.find(p => p.type === 'year').value,
                            parseInt(pstDateParts.find(p => p.type === 'month').value) - 1,
                            parseInt(pstDateParts.find(p => p.type === 'day').value),
                            parseInt(pstDateParts.find(p => p.type === 'hour').value),
                            parseInt(pstDateParts.find(p => p.type === 'minute').value));
    
    const isPastSixPM = parseInt(pstDateParts.find(p => p.type === 'hour').value) >= 18;
    
    // Create tomorrow's date in PST
    const tomorrow = new Date(pstDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        // The API provides dates with timezone info (-08:00), so we can use them directly
        const periodDate = new Date(period.startTime);
        
        // Format the period date in PST to compare
        const periodParts = pstFormatter.formatToParts(periodDate);
        const periodYear = periodParts.find(p => p.type === 'year').value;
        const periodMonth = parseInt(periodParts.find(p => p.type === 'month').value) - 1;
        const periodDay = parseInt(periodParts.find(p => p.type === 'day').value);
        const periodHour = parseInt(periodParts.find(p => p.type === 'hour').value);
        
        // Create comparison date in PST
        const periodPST = new Date(periodYear, periodMonth, periodDay, periodHour);
        
        return period.isDaytime && (!isPastSixPM || periodPST >= tomorrow);
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }),
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