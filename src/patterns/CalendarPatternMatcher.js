import { PatternMatcher } from '../types/PatternMatcher.js';
import { charMap } from '../utils/boardCharacters.js';

export class CalendarPatternMatcher extends PatternMatcher {
  constructor() {
    super();
    this.patterns = {
      // Matches "Tomorrow" or month abbreviation with date (e.g., "Jan 15")
      dateHeader: /^(TOMORROW|[A-Z][A-Z][A-Z]\s*\d{1,2})\s*$/,
      // Matches emoji + time (e.g., "🟩 9:30AM MEETING")
      eventRow: /^[\u{1F7E5}\u{1F7E7}\u{1F7E8}\u{1F7E9}\u{1F7E6}\u{1F7EA}\u{2B1C}\u{2B1B}]\s*\d{1,2}:\d{2}[AP]M.+$/u,
      // Matches empty rows
      emptyRow: /^\s*$/
    };
  }

  matches(boardContent) {
    // Create reverse charMap for number to char conversion
    const reverseCharMap = Object.fromEntries(
      Object.entries(charMap).map(([char, num]) => [num, char])
    );

    // Convert board content to strings for easier regex matching
    const boardRows = boardContent.map(row => 
      row.map(val => reverseCharMap[val] || '').join('')
    );

    // Check if the content matches calendar patterns
    for (const row of boardRows) {
      // Skip empty rows
      if (this.patterns.emptyRow.test(row)) continue;

      // Check if the row matches either a date header or event row
      if (!this.patterns.dateHeader.test(row.trim()) && 
          !this.patterns.eventRow.test(row.trim())) {
        return false;
      }
    }

    return true;
  }

  getDescription() {
    return 'Calendar pattern: Date headers and event rows with times';
  }
} 