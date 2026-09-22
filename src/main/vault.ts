import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { type Repository } from '../persistence/database';
export class Vault {
  constructor(private repo: Repository) {}
  put(id: string, value: string) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('Windows credential encryption unavailable');
    this.repo.set('credential:' + id, safeStorage.encryptString(value).toString('base64'));
  }
  get(id: string): string | undefined {
    const v = this.repo.get<string | undefined>('credential:' + id, undefined);
    if (!v) return undefined;
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('Windows credential encryption unavailable');
    return safeStorage.decryptString(Buffer.from(v, 'base64'));
  }
  token(id: string) {
    let token = this.get(id);
    if (!token) {
      token = randomBytes(32).toString('hex');
      this.put(id, token);
    }
    return token;
  }
}
