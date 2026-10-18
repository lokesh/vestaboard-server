import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class KieranPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    // Row 0: full weekday name (shortest is 6 letters) + date — distinct from TODAY's "MON DD"
    // Row 1: color square (green = school, red = no school) + label
    // Rows 2-5: weather periods and alert — flexible
    this.pattern = [
      ['a-z', 'a-z', 'a-z', 'a-z', 'a-z', 'a-z', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['COLOR', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
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
    return 'Kieran pattern: weekday + date, school day indicator, morning/afternoon/evening weather, rain alert';
  }
}
