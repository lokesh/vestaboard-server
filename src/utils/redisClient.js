import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { Mode } from '../types/Mode.js';

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const REDIS_KEYS = {
  CURRENT_MODE: 'CURRENT_MODE',
  DEBUG_MODE: 'DEBUG_MODE',
  GOOGLE_ACCESS_TOKEN: 'GOOGLE_ACCESS_TOKEN',
  GOOGLE_REFRESH_TOKEN: 'GOOGLE_REFRESH_TOKEN',
  GOOGLE_TOKEN_EXPIRY: 'GOOGLE_TOKEN_EXPIRY',
  WEATHER_CACHE: 'WEATHER_CACHE'
};

const WEATHER_CACHE_TTL = 21600; // 6 hours in seconds

export const saveTokensToRedis = async (tokens) => {
  try {
    await redis.set(REDIS_KEYS.GOOGLE_ACCESS_TOKEN, tokens.access_token);
    if (tokens.refresh_token) {
      await redis.set(REDIS_KEYS.GOOGLE_REFRESH_TOKEN, tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      await redis.set(REDIS_KEYS.GOOGLE_TOKEN_EXPIRY, String(tokens.expiry_date));
    }
    console.log('Successfully saved tokens to Redis');
  } catch (error) {
    console.error('Error saving tokens to Redis:', error);
    throw error;
  }
};

export const getTokensFromRedis = async () => {
  try {
    const [accessToken, refreshToken, tokenExpiry] = await Promise.all([
      redis.get(REDIS_KEYS.GOOGLE_ACCESS_TOKEN),
      redis.get(REDIS_KEYS.GOOGLE_REFRESH_TOKEN),
      redis.get(REDIS_KEYS.GOOGLE_TOKEN_EXPIRY)
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: tokenExpiry ? Number(tokenExpiry) : 0
    };
  } catch (error) {
    console.error('Error getting tokens from Redis:', error);
    throw error;
  }
};

export const saveCurrentMode = async (mode) => {
  try {
    await redis.set(REDIS_KEYS.CURRENT_MODE, mode);
  } catch (error) {
    console.error('Error saving current mode to Redis:', error);
    throw error;
  }
};

export const getCurrentMode = async () => {
  try {
    const mode = await redis.get(REDIS_KEYS.CURRENT_MODE);
    return mode || Mode.MANUAL;
  } catch (error) {
    console.error('Error getting current mode from Redis:', error);
    return Mode.MANUAL;
  }
};

export const saveDebugMode = async (enabled) => {
  try {
    await redis.set(REDIS_KEYS.DEBUG_MODE, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving debug mode to Redis:', error);
    throw error;
  }
};

export const getDebugMode = async () => {
  try {
    const debug = await redis.get(REDIS_KEYS.DEBUG_MODE);
    return debug === true || debug === 'true';
  } catch (error) {
    console.error('Error getting debug mode from Redis:', error);
    return false;
  }
};

// Weather cache functions
export const saveWeatherCache = async (type, data) => {
  try {
    const key = `${REDIS_KEYS.WEATHER_CACHE}:${type}`;
    await redis.set(key, JSON.stringify(data), { ex: WEATHER_CACHE_TTL });
  } catch (error) {
    // Cache save is best-effort
    console.error('Error saving weather cache:', error.message);
  }
};

export const getWeatherCache = async (type) => {
  try {
    const key = `${REDIS_KEYS.WEATHER_CACHE}:${type}`;
    const data = await redis.get(key);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error) {
    console.error('Error getting weather cache:', error.message);
    return null;
  }
};
