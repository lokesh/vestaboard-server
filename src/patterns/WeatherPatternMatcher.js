import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class WeatherPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    this.pattern = [
      ['a-z','a-z','a-z','','0-9','0-9','','','','','','','','','','','','','','','',''],
      ['a-z','a-z','a-z','','0-9','0-9','','','','','','','','','','','','','','','',''],
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
    return 'Weather pattern: DAY NN° [emoji] description';
  }
} 