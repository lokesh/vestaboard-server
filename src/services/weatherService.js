import { getWeatherCache, saveWeatherCache } from '../utils/redisClient.js';
import { nowInTz, toTz, formatInTz } from '../utils/timezone.js';

const FETCH_TIMEOUT = 10000; // 10 seconds

export const getWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast', {
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });
    const data = await response.json();

    const now = new Date();
    const isPastSixPM = now.getHours() >= 18;

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const weatherData = data.properties.periods
      .filter(period => {
        const periodDate = new Date(period.startTime);
        return period.isDaytime && (!isPastSixPM || periodDate >= tomorrow);
      })
      .slice(0, 6)
      .map(period => ({
        date: new Date(period.startTime).toLocaleDateString(),
        temperature: period.temperature,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value || 0,
        windSpeed: period.windSpeed,
        shortForecast: period.shortForecast
      }));

    // Cache successful response
    await saveWeatherCache('forecast', weatherData);
    return weatherData;
  } catch (error) {
    console.error('Weather service error:', error.message);

    // Try to use cached data
    const cached = await getWeatherCache('forecast');
    if (cached) {
      console.log('Using cached forecast data');
      return cached;
    }

    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
};

export const getHourlyWeatherData = async () => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/MTR/84,105/forecast/hourly', {
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });
    const data = await response.json();

    const now = new Date();

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

    await saveWeatherCache('hourly', hourlyData);
    return hourlyData;
  } catch (error) {
    console.error('Hourly weather service error:', error.message);

    const cached = await getWeatherCache('hourly');
    if (cached) {
      console.log('Using cached hourly data');
      return cached;
    }

    throw new Error(`Failed to fetch hourly weather data: ${error.message}`);
  }
};

export const getSunData = async () => {
  try {
    const pstDate = formatInTz(new Date(), 'M/d/yyyy');

    const response = await fetch(`https://api.sunrise-sunset.org/json?lat=37.7749&lng=-122.4194&formatted=0&date=${pstDate}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error('Failed to get sun data');
    }

    const result = {
      sunrise: toTz(new Date(data.results.sunrise)),
      sunset: toTz(new Date(data.results.sunset)),
    };

    await saveWeatherCache('sun', result);
    return result;
  } catch (error) {
    console.error('Sun data service error:', error.message);

    const cached = await getWeatherCache('sun');
    if (cached) {
      console.log('Using cached sun data');
      // Restore Date objects from JSON
      return {
        sunrise: new Date(cached.sunrise),
        sunset: new Date(cached.sunset)
      };
    }

    throw new Error(`Failed to fetch sun data: ${error.message}`);
  }
};

export const getHistoricalAndForecastWeather = async () => {
  try {
    const apiKey = process.env.VISUAL_CROSSING_API_KEY;
    if (!apiKey) {
      throw new Error('VISUAL_CROSSING_API_KEY not found in environment variables');
    }

    const pstNow = nowInTz();

    const today = formatInTz(new Date(), 'yyyy-MM-dd');

    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/37.7749,-122.4194/${today}?unitGroup=us&key=${apiKey}&include=hours`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`Visual Crossing API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data?.days?.[0]?.hours) {
      throw new Error('Invalid response from Visual Crossing API');
    }

    const hourlyData = data.days[0].hours.map(hour => {
      const hourNum = parseInt(hour.datetime.split(':')[0], 10);

      return {
        hour: hourNum,
        temperature: Math.round(hour.temp),
        shortForecast: hour.conditions,
        isHistorical: hourNum <= pstNow.getHours()
      };
    });

    await saveWeatherCache('visualcrossing', hourlyData);
    return hourlyData;
  } catch (error) {
    console.error('Visual Crossing weather service error:', error.message);

    const cached = await getWeatherCache('visualcrossing');
    if (cached) {
      console.log('Using cached Visual Crossing data');
      return cached;
    }

    throw new Error(`Failed to fetch weather data from Visual Crossing: ${error.message}`);
  }
};
