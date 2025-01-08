import fs from 'fs/promises';
import { encrypt, decrypt } from '../utils/encryption.js';

class TokenService {
  constructor() {
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    this.tokenPath = './data/encrypted_tokens';
  }

  async saveTokens(tokens) {
    const encrypted = encrypt(JSON.stringify(tokens), this.encryptionKey);
    await fs.writeFile(this.tokenPath, encrypted);
  }

  async getTokens() {
    try {
      const encrypted = await fs.readFile(this.tokenPath, 'utf8');
      return JSON.parse(decrypt(encrypted, this.encryptionKey));
    } catch (error) {
      return null;
    }
  }
}

export default new TokenService(); 