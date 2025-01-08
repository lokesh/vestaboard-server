export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast');
    const data = await response.json();

    // Get current time in PST using explicit timezone conversion
    const now = new Date();
    console.log('Server time:', now.toString());
    
    // Convert to PST using explicit offset for Pacific Time (-8 or -7 depending on DST)
    const pstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    console.log('PST time after conversion:', pstDate.toString());
    
    const isPastSixPM = pstDate.getHours() >= 18;
    console.log('Is past 6 PM PST:', isPastSixPM, 'Current PST hour:', pstDate.getHours());
    
    // Create tomorrow's date in PST
    const tomorrow = new Date(pstDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    console.log('Tomorrow at midnight PST:', tomorrow.toString());

    // Filter daytime periods and adjust based on time
    const weatherData = data.properties.periods
      .filter(period => {
        const periodDate = new Date(period.startTime);
        console.log('Original period date from API:', period.startTime);
        console.log('Parsed period date:', periodDate.toString());
        
        // Convert period date to PST
        const periodPST = new Date(periodDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        console.log('Period date in PST:', periodPST.toString());
        
        const shouldInclude = period.isDaytime && (!isPastSixPM || periodPST >= tomorrow);
        console.log('Including period?', shouldInclude, 'isDaytime:', period.isDaytime);
        
        return shouldInclude;
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));

    console.log('Final weather data:', JSON.stringify(weatherData, null, 2));
    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}; 