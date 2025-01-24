import { PatternMatcher } from '../types/PatternMatcher.js';
import { checkBoardPattern } from '../utils/boardCharacters.js';

export class TodayPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    this.pattern = [
      ['a-z', 'a-z', 'a-z', '', 'a-z', 'a-z', 'a-z', '', '0-9', '', '', '', '', '', '', '', '', '', '', '', '', ''],
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
    return 'Today pattern: DAY MON DD with temperatures and weather boxes';
  }
} 