import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class ClockPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    // Clock format: " H:MM" or "HH:MM" — positions 0-4 of row 0
    // Position 0: space or digit (for 10, 11, 12), position 1: digit, position 2: colon, positions 3-4: digits
    this.pattern = [
      ['','0-9',':','0-9','0-9','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','','']
    ];
  }

  matches(boardContent) {
    // First check the basic pattern
    if (!checkBoardPattern(boardContent, this.pattern)) return false;

    // Additional validation: position 0 must be space (0) or digit
    const firstChar = boardContent[0][0];
    return firstChar === 0 || (firstChar >= 27 && firstChar <= 36);
  }

  getDescription() {
    return 'Clock pattern: HH:MM in 12-hour format';
  }
}
