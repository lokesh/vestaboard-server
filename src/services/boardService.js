import fetch from 'node-fetch';
import { getWeatherData } from './weatherService.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv/config';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file (no need to call config() as it's done by the import)

class BoardService {
  constructor() {
    this.apiKey = process.env.VESTABOARD_READ_WRITE_API_KEY;
    
    this.baseUrl = 'https://rw.vestaboard.com';
    this.debugMode = process.env.VESTABOARD_DEBUG === 'true';
  }

  async updateBoard(message) {
    try {
      const characters = this._convertToVestaboardCharacters(message);
      await this._postToVestaboard(characters);
    } catch (error) {
      console.error('Error updating board:', error);
      throw error;
    }
  }

  async displayWeather() {
    try {
      const weather = await getWeatherData();
      
      // Format weather info for display
      const temperature = Math.round(weather.current.temp);
      const condition = weather.current.weather[0].main;
      const humidity = weather.current.humidity;
      const windSpeed = Math.round(weather.current.wind_speed);
      
      // Create board layout
      const layout = [
        'Current Weather'.padEnd(22),
        '-'.repeat(22),
        `Temp: ${temperature}°F`.padEnd(22),
        `Condition: ${condition}`.padEnd(22),
        `Humidity: ${humidity}%`.padEnd(22),
        `Wind: ${windSpeed} MPH`.padEnd(22)
      ];

      await this.updateBoard(layout.join('\n'));
    } catch (error) {
      console.error('Error displaying weather:', error);
      throw error;
    }
  }

  async _postToVestaboard(characters) {
    if (this.debugMode) {
      this._debugPrintBoard(characters);
      return;
    }

    

    const headers = {
      'X-Vestaboard-Read-Write-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
    
    try {
      
      console.log(characters);
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body:  JSON.stringify(characters),
      });

      console.log('Vestaboard API Response:', {
        status: response.status,
        statusText: response.statusText
      });

      // Log response body if there's an error
      if (!response.ok) {
        const responseBody = await response.text();
        console.log('Error Response Body:', responseBody);
      }
      
    } catch (error) {
      console.error('Error posting to Vestaboard:', error);
      throw error;
    }
  }

  _debugPrintBoard(characters) {
    console.log('\nVestaboard Debug Output:');
    console.log('┌' + '─'.repeat(44) + '┐');
    
    characters.forEach(row => {
      const rowString = row.map(char => {
        // Convert number back to character using reverse charMap lookup
        const foundChar = Object.entries(this.charMap)
          .find(([_, value]) => value === char)?.[0] || ' ';
        return foundChar.padStart(2);
      }).join(' ');
      
      console.log('│ ' + rowString + ' │');
    });
    
    console.log('└' + '─'.repeat(44) + '┘');
    console.log('Board dimensions: 6 rows x 22 columns');
    console.log('Debug mode: ON\n');
  }

  charMap = {
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
    'VIOLET': 68, 'WHITE': 69, 'BLACK': 70, 'FILLED': 71
  };

  _convertToVestaboardCharacters(message) {
    console.log('Converting msg: ', characters);
    // Split message into lines
    const lines = message.split('\n');
    
    // Create a 6x22 matrix filled with spaces (0 in Vestaboard characters)
    const matrix = Array(6).fill().map(() => Array(22).fill(0));
    
    // Fill in the matrix with the message content, up to 6 lines
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i].padEnd(22, ' ').slice(0, 22);
      matrix[i] = Array.from(line.toUpperCase()).map(char => this.charMap[char] || 0);
    }
    
    return matrix;
  }
}

export default new BoardService(); 