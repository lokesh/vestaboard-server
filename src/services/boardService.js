import fetch from 'node-fetch';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv/config';
import { charMap } from '../utils/boardCharacters.js';
import { getDebugMode, saveDebugMode } from '../utils/redisClient.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file (no need to call config() as it's done by the import)

class BoardService {
  constructor() {
    this.apiKey = process.env.VESTABOARD_READ_WRITE_API_KEY;
    this.charMap = charMap;
    this.baseUrl = 'https://rw.vestaboard.com';
    this._debugMode = false;
    this.initialize();
  }

  async initialize() {
    try {
      this._debugMode = await getDebugMode();
      console.log('Initialized debug mode from Redis:', this._debugMode);
    } catch (error) {
      console.error('Error initializing debug mode:', error);
      this._debugMode = false;
    }
  }

  get debugMode() {
    return this._debugMode;
  }

  set debugMode(value) {
    this._debugMode = value;
  }

  async toggleDebugMode() {
    this._debugMode = !this._debugMode;
    await saveDebugMode(this._debugMode);
    return this._debugMode;
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
      
      // const response = await fetch(this.baseUrl, {
      //   method: 'POST',
      //   headers,
      //   body:  JSON.stringify(characters),
      // });

      // console.log('Vestaboard API Response:', {
      //   status: response.status,
      //   statusText: response.statusText
      // });

      // // Log response body if there's an error
      // if (!response.ok) {
      //   const responseBody = await response.text();
      //   console.log('Error Response Body:', responseBody);
      // }
      
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

  _convertToVestaboardCharacters(message) {
    // console.log('Converting msg: ', message);
    // Split message into lines
    const lines = message.split('\n');
    
    // Create a 6x22 matrix filled with spaces (0 in Vestaboard characters)
    const matrix = Array(6).fill().map(() => Array(22).fill(0));
    
    // Fill in the matrix with the message content, up to 6 lines
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i].padEnd(22, ' ');  // Pad the line to 22 characters
      const chars = Array.from(line.toUpperCase()).slice(0, 22);  // Ensure exactly 22 characters
      
      // Convert each character to its Vestaboard code
      for (let j = 0; j < 22; j++) {
        // console.log(chars[j], this.charMap[chars[j]]);
        matrix[i][j] = this.charMap[chars[j]] || 0;
      }
    }
    
    return matrix;
  }

  async getCurrentBoardContent() {
    try {
      const response = await fetch('https://rw.vestaboard.com', {
        headers: {
          'X-Vestaboard-Read-Write-Key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch board content: ${response.status}`);
      }
      
      const data = await response.json();
      // console.log('Raw Vestaboard response:', data);
      
      // Extract and parse the layout string
      if (!data.currentMessage?.layout) {
        throw new Error('Invalid response format from Vestaboard');
      }
      
      try {
        // Parse the layout string into a matrix
        const matrix = JSON.parse(data.currentMessage.layout);
        if (!Array.isArray(matrix) || !matrix.every(row => Array.isArray(row))) {
          throw new Error('Invalid matrix format');
        }
        return matrix;
      } catch (parseError) {
        console.error('Error parsing layout:', parseError);
        throw new Error('Failed to parse board layout');
      }
    } catch (error) {
      console.error('Error fetching board content:', error);
      throw error;
    }
  }

  async sendMessage(text) {
    try {
        if (!text) {
            throw new Error('Message text is required');
        }

        // const response = await fetch(this.baseUrl, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'X-Vestaboard-Read-Write-Key': this.apiKey
        //     },
        //     body: JSON.stringify({ text })
        // });

        // const data = await response.json();

        // if (!response.ok) {
        //     throw new Error(data.error || 'Failed to send message to Vestaboard');
        // }

        // return data;
    } catch (error) {
        console.error('Error sending message to Vestaboard:', error);
        throw error;
    }
  }
}

export default new BoardService(); 