import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class ClockPatternMatcher extends PatternMatcher {
  constructor() {
    super();
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
    return checkBoardPattern(boardContent, this.pattern);
  }

  getDescription() {
    return 'Clock pattern: HH:MM in 12-hour format';
  }
} 