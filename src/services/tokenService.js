import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '../../data/google_tokens.json');

// Ensure data directory exists
await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true }).catch(() => {});

export class TokenService {
  async saveTokens(tokens) {
    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  }

  async getTokens() {
    try {
      const data = await fs.readFile(TOKEN_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateTokens(newTokens) {
    const existingTokens = await this.getTokens();
    const updatedTokens = { ...existingTokens, ...newTokens };
    await this.saveTokens(updatedTokens);
    return updatedTokens;
  }
}

export default new TokenService(); 