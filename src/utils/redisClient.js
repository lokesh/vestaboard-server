import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { Mode } from '../types/Mode.js';

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Redis keys
const REDIS_KEYS = {
  CURRENT_MODE: 'CURRENT_MODE',
  DEBUG_MODE: 'DEBUG_MODE',
  GOOGLE_ACCESS_TOKEN: 'GOOGLE_ACCESS_TOKEN',
  GOOGLE_REFRESH_TOKEN: 'GOOGLE_REFRESH_TOKEN',
  GOOGLE_TOKEN_EXPIRY: 'GOOGLE_TOKEN_EXPIRY'
};

export const saveTokensToRedis = async (tokens) => {
  try {
    await redis.set(REDIS_KEYS.GOOGLE_ACCESS_TOKEN, tokens.access_token);
    if (tokens.refresh_token) {
      await redis.set(REDIS_KEYS.GOOGLE_REFRESH_TOKEN, tokens.refresh_token);
    }
    await redis.set(REDIS_KEYS.GOOGLE_TOKEN_EXPIRY, tokens.expiry_date.toString());
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
      expiry_date: parseInt(tokenExpiry || '0')
    };
  } catch (error) {
    console.error('Error getting tokens from Redis:', error);
    throw error;
  }
};

export const saveCurrentMode = async (mode) => {
  try {
    await redis.set(REDIS_KEYS.CURRENT_MODE, mode);
    console.log('Successfully saved current mode to Redis:', mode);
  } catch (error) {
    console.error('Error saving current mode to Redis:', error);
    throw error;
  }
};

export const getCurrentMode = async () => {
  try {
    const mode = await redis.get(REDIS_KEYS.CURRENT_MODE);
    return mode || Mode.MANUAL; // Default to MANUAL if not set
  } catch (error) {
    console.error('Error getting current mode from Redis:', error);
    return Mode.MANUAL; // Default to MANUAL on error
  }
};

export const saveDebugMode = async (enabled) => {
  try {
    await redis.set(REDIS_KEYS.DEBUG_MODE, enabled);
    console.log('Successfully saved debug mode to Redis:', enabled);
  } catch (error) {
    console.error('Error saving debug mode to Redis:', error);
    throw error;
  }
};

export const getDebugMode = async () => {
  try {
    const debug = await redis.get(REDIS_KEYS.DEBUG_MODE);
    return debug; // Convert string to boolean, defaults to false if not set
  } catch (error) {
    console.error('Error getting debug mode from Redis:', error);
    return false; // Default to false on error
  }
}; 