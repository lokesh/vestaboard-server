import fetch from 'node-fetch';
import { getWeatherData } from './weatherService.js';


// Load environment variables from .env file

class BoardService {
  constructor() {

    this.apiKey = process.env.VESTABOARD_READ_WRITE_API_KEY;
    this.baseUrl = 'https://rw.vestaboard.com';
    console.log(process.env.VESTABOARD_DEBUG);
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
      await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ characters })
      });
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
    ' ': 0, '!': 1, '"': 2, '#': 3, '$': 4, '%': 5, '&': 6, "'": 7,
    '(': 8, ')': 9, '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, '/': 15,
    '0': 16, '1': 17, '2': 18, '3': 19, '4': 20, '5': 21, '6': 22, '7': 23,
    '8': 24, '9': 25, ':': 26, ';': 27, '<': 28, '=': 29, '>': 30, '?': 31,
    '@': 32, 'A': 33, 'B': 34, 'C': 35, 'D': 36, 'E': 37, 'F': 38, 'G': 39,
    'H': 40, 'I': 41, 'J': 42, 'K': 43, 'L': 44, 'M': 45, 'N': 46, 'O': 47,
    'P': 48, 'Q': 49, 'R': 50, 'S': 51, 'T': 52, 'U': 53, 'V': 54, 'W': 55,
    'X': 56, 'Y': 57, 'Z': 58, '[': 59, '\\': 60, ']': 61, '^': 62, '_': 63
  };

  _convertToVestaboardCharacters(message) {
    // Split message into lines and pad/truncate to 22 characters
    const lines = message.split('\n').slice(0, 6).map(line => 
      line.padEnd(22, ' ').slice(0, 22)
    );

    // Convert to 6x22 character matrix
    return lines.map(line =>
      Array.from(line.toUpperCase()).map(char => this.charMap[char] || 0)
    );
  }
}

export default new BoardService(); 