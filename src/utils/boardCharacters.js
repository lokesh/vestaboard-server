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

    // Check each position in the board
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 22; col++) {
            const boardValue = message[row][col];
            const patternValue = pattern[row][col];
            
            // If pattern value is empty, any character is valid
            if (patternValue === '') continue;

            // Get the actual character from the board value
            const boardChar = reverseCharMap[boardValue];
            if (!boardChar) return false;

            // Check different pattern types
            if (patternValue === ':' && boardChar !== ':') return false;
            else if (patternValue === 'a-z' && !/^[A-Z]$/.test(boardChar)) return false;
            else if (patternValue === '0-9' && !/^[0-9]$/.test(boardChar)) return false;
            else if (patternValue.length === 1 && boardChar !== patternValue.toUpperCase()) return false;
        }
    }

    return true;
} 

