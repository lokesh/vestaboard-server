import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class FiveDayWeatherPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    // Format per row: "DAY NN [emoji]description"
    // Positions 0-2: 3-letter day, 3: space, 4-5: temperature digits (could be space+digit or digit+digit)
    // Only validate first 2 rows to confirm it's a weather display
    this.pattern = [
      ['a-z','a-z','a-z','','','','','','','','','','','','','','','','','','',''],
      ['a-z','a-z','a-z','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','',''],
      ['','','','','','','','','','','','','','','','','','','','','','']
    ];
  }

  matches(boardContent) {
    return checkBoardPattern(boardContent, this.pattern);
  }

  getDescription() {
    return '5-Day Weather pattern: DAY NN [emoji] description';
  }
}
