import { Mode } from '../types/Mode.js';
import { ClockPatternMatcher } from './ClockPatternMatcher.js';
import { FiveDayWeatherPatternMatcher } from './FiveDayWeatherPatternMatcher.js';
import { OneDayWeatherPatternMatcher } from './OneDayWeatherPatternMatcher.js';
import { CalendarPatternMatcher } from './CalendarPatternMatcher.js';
import { TodayPatternMatcher } from './TodayPatternMatcher.js';

/**
 * Factory class for creating pattern matchers based on mode
 */
export class PatternMatcherFactory {
  /**
   * Create a pattern matcher for the given mode
   * @param {Mode} mode - The mode to create a pattern matcher for
   * @returns {PatternMatcher|null} The pattern matcher for the mode, or null for manual mode
   */
  static createMatcher(mode) {
    switch (mode) {
      case Mode.CLOCK:
        return new ClockPatternMatcher();
      case Mode.FIVEDAY_WEATHER:
        return new FiveDayWeatherPatternMatcher();
      case Mode.ONEDAY_WEATHER:
        return new OneDayWeatherPatternMatcher();
      case Mode.CALENDAR:
        return new CalendarPatternMatcher();
      case Mode.TODAY:
        return new TodayPatternMatcher();
      case Mode.MANUAL:
        return null; // Manual mode doesn't need pattern matching
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }
  }
}