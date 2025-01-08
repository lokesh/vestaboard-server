/**
 * Interface for board pattern matching strategies
 */
export class PatternMatcher {
  /**
   * Check if the board content matches the expected pattern
   * @param {number[][]} boardContent - The current board content (6x22 array of numbers)
   * @returns {boolean} - True if the pattern matches, false otherwise
   */
  matches(boardContent) {
    throw new Error('matches() must be implemented by concrete strategies');
  }

  /**
   * Get a description of the pattern for debugging
   * @returns {string} - Human readable description of the pattern
   */
  getDescription() {
    throw new Error('getDescription() must be implemented by concrete strategies');
  }
} 