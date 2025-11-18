import { PatternMatcher } from '../types/PatternMatcher.js';

export class TodayPatternMatcher extends PatternMatcher {
  constructor() {
    super();
  }

  matches(boardContent) {
    // Simple stub pattern matcher for the new TODAY mode
    // Matches if the board contains "TODAY MODE" or "COMING SOON"
    const contentStr = boardContent.join('').toUpperCase();
    return contentStr.includes('TODAY MODE') || contentStr.includes('COMING SOON');
  }

  getDescription() {
    return 'Today pattern: Condensed weather summary and birthdays (stub)';
  }
}