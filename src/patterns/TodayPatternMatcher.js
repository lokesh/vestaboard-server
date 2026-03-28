import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class TodayPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    // Row 0: "MON DD" — 3-letter month + space + date (1-2 digits)
    // Rows 1-2: flexible text (holidays, birthdays, or empty)
    // Rows 3-5: flexible (weather data or empty)
    this.pattern = [
      ['a-z', 'a-z', 'a-z', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    ];
  }

  matches(boardContent) {
    // Check if row 0 starts with 3 letters (month abbreviation)
    if (!checkBoardPattern(boardContent, this.pattern)) return false;

    // Position 3 should be a space (0) to confirm "MON DD" format
    return boardContent[0][3] === 0;
  }

  getDescription() {
    return 'Today pattern: Month/Date, Holidays/Birthdays, and Weather summary with hourly blocks';
  }
}
