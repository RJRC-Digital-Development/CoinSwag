import * as crypto from 'crypto';
import { MemoryScrubber } from './memory-scrubber';

export interface EncryptedVaultBundle {
  version: 2;
  algorithm: 'aes-256-gcm';
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;        // Hex encoded 16 bytes
  iv: string;          // Hex encoded 12 bytes
  authTag: string;     // Hex encoded 16 bytes
  ciphertext: string;  // Hex encoded ciphertext
  checksum: string;    // HMAC integrity signature
  createdAt: string;
}

export class VaultCipher {
  // OWASP's current PBKDF2-HMAC-SHA256 guidance is 600,000 iterations.
  public static readonly ITERATIONS = 600000;
  public static readonly KEY_LEN = 32; // 256 bits

  /**
   * Encrypts arbitrary vault data with authenticated AES-256-GCM.
   */
  public static encryptVault(data: any, passphrase: string): EncryptedVaultBundle {
    if (!passphrase || passphrase.length < 12) {
      throw new Error('Encryption passphrase must be at least 12 characters long.');
    }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM

    // Derive 256-bit encryption key using PBKDF2 (100,000 iterations)
    const key = crypto.pbkdf2Sync(passphrase, salt, this.ITERATIONS, this.KEY_LEN, 'sha256');

    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const plaintext = Buffer.from(JSON.stringify(data), 'utf-8');

      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Wipe raw plaintext buffer from memory
      MemoryScrubber.zeroize(plaintext);

      // Compute HMAC integrity signature over payload
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(Buffer.concat([salt, iv, authTag, ciphertext]));
      const checksum = hmac.digest('hex');

      return {
        version: 2,
        algorithm: 'aes-256-gcm',
        kdf: 'pbkdf2-sha256',
        iterations: this.ITERATIONS,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        ciphertext: ciphertext.toString('hex'),
        checksum,
        createdAt: new Date().toISOString()
      };
    } finally {
      // Zeroize derived key in RAM
      MemoryScrubber.zeroize(key);
    }
  }

  /**
   * Decrypts and authenticates an encrypted vault bundle.
   * Throws if passphrase is wrong or if any bit of ciphertext / tag has been tampered with.
   */
  public static decryptVault(bundle: EncryptedVaultBundle, passphrase: string): any {
    if (!bundle || bundle.version !== 2 || bundle.algorithm !== 'aes-256-gcm' || bundle.kdf !== 'pbkdf2-sha256' || bundle.iterations !== this.ITERATIONS) {
      throw new Error(`Unsupported cipher algorithm: ${bundle.algorithm}`);
    }

    const salt = Buffer.from(bundle.salt, 'hex');
    const iv = Buffer.from(bundle.iv, 'hex');
    const authTag = Buffer.from(bundle.authTag, 'hex');
    const ciphertext = Buffer.from(bundle.ciphertext, 'hex');

    if (salt.length !== 16 || iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0 || !/^[a-f\d]{64}$/i.test(bundle.checksum)) {
      throw new Error('Invalid vault bundle encoding.');
    }

    const key = crypto.pbkdf2Sync(passphrase, salt, bundle.iterations || this.ITERATIONS, this.KEY_LEN, 'sha256');

    try {
      // Verify HMAC integrity checksum first
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(Buffer.concat([salt, iv, authTag, ciphertext]));
      const calculatedChecksum = hmac.digest('hex');

      // Constant-time comparison for checksum
      const expectedBuf = Buffer.from(bundle.checksum, 'hex');
      const calculatedBuf = Buffer.from(calculatedChecksum, 'hex');
      if (expectedBuf.length !== calculatedBuf.length || !crypto.timingSafeEqual(expectedBuf, calculatedBuf)) {
        throw new Error('Integrity check failed: Vault bundle has been tampered with or corrupted.');
      }

      // Decrypt using AES-256-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const jsonStr = decrypted.toString('utf-8');

      // Zeroize decrypted buffer immediately after parsing
      MemoryScrubber.zeroize(decrypted);

      return JSON.parse(jsonStr);
    } finally {
      MemoryScrubber.zeroize(key);
    }
  }
}
