export const charMap = {
  ' ': 0,
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9,
  'J': 10, 'K': 11, 'L': 12, 'M': 13, 'N': 14, 'O': 15, 'P': 16, 'Q': 17,
  'R': 18, 'S': 19, 'T': 20, 'U': 21, 'V': 22, 'W': 23, 'X': 24, 'Y': 25,
  'Z': 26,
  '1': 27, '2': 28, '3': 29, '4': 30, '5': 31, '6': 32, '7': 33, '8': 34,
  '9': 35, '0': 36,
  '!': 37, '@': 38, '#': 39, '$': 40, '(': 41, ')': 42, '-': 44, '+': 46,
  '&': 47, '=': 48, ';': 49, ':': 50, "'": 52, '"': 53, '%': 54, ',': 55,
  '.': 56, '/': 59, '?': 60, '°': 62,
  // Special color characters
  'RED': 63, 'ORANGE': 64, 'YELLOW': 65, 'GREEN': 66, 'BLUE': 67,
  'VIOLET': 68, 'WHITE': 69, 'BLACK': 70, 'FILLED': 71,
  '🟥': 63, '🟧': 64, '🟨': 65, '🟩': 66, '🟦': 67, '🟪': 68, '⬜': 69, '⬛️': 70
};

/**
 * Checks if a board message matches a given pattern
 * @param {number[][]} message - The current board message (6x22 array of numbers)
 * @param {string[][]} pattern - The pattern to match against (6x22 array of strings)
 * @returns {boolean} - True if the pattern matches, false otherwise
 */
export function checkBoardPattern(message, pattern) {
    // Validate input dimensions
    if (!message || !pattern || 
        message.length !== 6 || pattern.length !== 6 ||
        !message.every(row => row.length === 22) ||
        !pattern.every(row => row.length === 22)) {
        return false;
    }

    // Create reverse charMap for number to char conversion
    const reverseCharMap = Object.fromEntries(
        Object.entries(charMap).map(([char, num]) => [num, char])
    );

    // Create a set of color values for efficient lookup
    const colorValues = new Set(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'VIOLET', 'WHITE', 'BLACK', 'FILLED',
        '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬜', '⬛️']);

    // Check each row in the board
    for (let row = 0; row < 6; row++) {
        const boardRow = message[row];
        const patternRow = pattern[row];
        
        // Convert board row to characters for easier pattern matching
        const boardChars = boardRow.map(val => reverseCharMap[val] || '');
        
        // Skip empty pattern rows (all empty strings)
        if (patternRow.every(val => val === '')) continue;

        // Check if this row matches any of our known patterns
        let rowMatches = false;

        // Check each position in the row
        let positionMatches = true;
        for (let col = 0; col < 22; col++) {
            const boardChar = boardChars[col];
            const patternValue = patternRow[col];
            
            // If pattern value is empty, any character is valid
            if (patternValue === '') continue;

            // Check different pattern types
            if (patternValue === ':' && boardChar !== ':') {
                positionMatches = false;
                break;
            }
            else if (patternValue === 'COLOR' && !colorValues.has(boardChar)) {
                positionMatches = false;
                break;
            }
            else if (patternValue === 'a-z' && !/^[A-Z]$/.test(boardChar)) {
                positionMatches = false;
                break;
            }
            else if (patternValue === '0-9' && !/^[0-9]$/.test(boardChar)) {
                positionMatches = false;
                break;
            }
            else if (patternValue === 'emoji' && !colorValues.has(boardChar)) {
                positionMatches = false;
                break;
            }
            else if (patternValue === 'time' && !/^[0-9:]$/.test(boardChar)) {
                positionMatches = false;
                break;
            }
            else if (patternValue.length === 1 && boardChar !== patternValue.toUpperCase()) {
                positionMatches = false;
                break;
            }
        }

        rowMatches = positionMatches;

        // If this row doesn't match any pattern, return false
        if (!rowMatches) return false;
    }

    return true;
}

/**
 * Checks if a single row matches a specific pattern type
 * @param {string[]} boardChars - Array of characters in the board row
 * @param {string} patternType - Type of pattern to check ('date-header', 'event-row', etc.)
 * @returns {boolean} - True if the row matches the pattern type
 */
export function checkRowPattern(boardChars, patternType) {
    switch (patternType) {
        case 'date-header':
            // Check for "Tomorrow" or "Jan 15" style headers
            return /^[A-Z][a-z]{2,7}$/.test(boardChars.join('').trim()) ||
                   /^[A-Z][a-z]{2}\s\d{1,2}$/.test(boardChars.join('').trim());
        
        case 'event-row':
            // Check for emoji + time + title pattern
            const colorChar = boardChars[0];
            const timeStart = boardChars.slice(1, 7).join('').trim();
            return colorValues.has(colorChar) && 
                   /^\d{1,2}:\d{2}[ap]m$/.test(timeStart);
        
        default:
            return false;
    }
} 

