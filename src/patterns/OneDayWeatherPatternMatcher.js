import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class OneDayWeatherPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    // Format row 0: "DAY MON DD" — e.g., "SAT MAR 28"
    // Positions 0-2: day abbrev, 3: space, 4-6: month abbrev, 7: space, 8+: date digits
    this.pattern = [
      ['a-z', 'a-z', 'a-z', '', 'a-z', 'a-z', 'a-z', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    ];
  }

  matches(boardContent) {
    return checkBoardPattern(boardContent, this.pattern);
  }

  getDescription() {
    return 'Hourly Weather pattern: DAY MON DD with temperatures and weather boxes';
  }
}
