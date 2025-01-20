import { PatternMatcher } from '../types/PatternMatcher.js';

export class TodayPatternMatcher extends PatternMatcher {
  matches(content) {
    if (!content) return false;
    
    const lines = content.split('\n');
    if (lines.length < 4) return false;

    // First line should be day and date
    const datePattern = /^[A-Z]{3} [A-Z]{3} \d{1,2}$/;
    if (!datePattern.test(lines[0])) return false;

    // Third line should be temperatures (2 digits with 3 spaces between)
    const tempPattern = /^\d{2}   \d{2}   \d{2}   \d{2}   \d{2}$/;
    if (!tempPattern.test(lines[2])) return false;

    // Fourth line should be colored boxes
    const boxPattern = /^[🟨⬜🟦]+$/;
    if (!boxPattern.test(lines[3])) return false;

    return true;
  }
} 