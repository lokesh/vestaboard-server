import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class TodayPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    // Pattern for TODAY mode:
    // Row 1: MON DD (e.g., "NOV 18")
    // Row 2: Holiday or birthdays (text)
    // Row 3: Birthdays or blank (text or empty)
    // Row 4-6: Weather with temp range, emojis, and description
    this.pattern = [
      // Row 1: Month (3 letters) + space + date (1-2 digits)
      ['a-z', 'a-z', 'a-z', '', '0-9', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // Row 2: Text (holiday or birthdays) - flexible
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // Row 3: Text (birthdays) or empty - flexible
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // Row 4-6: Weather rows - temp range (digits, dash, degree) + emojis + text
      // e.g., "55-72° ⬜⬜⬜⬜ Sunny"
      ['0-9', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['0-9', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['0-9', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    ];
  }

  matches(boardContent) {
    // Check if it matches the pattern
    if (checkBoardPattern(boardContent, this.pattern)) {
      return true;
    }

    // Also accept the old stub content for backward compatibility during transition
    const contentStr = boardContent.join('').toUpperCase();
    return contentStr.includes('TODAY MODE') || contentStr.includes('COMING SOON');
  }

  getDescription() {
    return 'Today pattern: Month/Date, Holidays/Birthdays, and Weather summary with hourly blocks';
  }
}