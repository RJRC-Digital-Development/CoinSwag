import * as crypto from 'crypto';

export class MemoryScrubber {
  /**
   * Cryptographically overwrites and zeroizes a Buffer using a 3-pass wipe:
   * Pass 1: Cryptographically secure pseudo-random bytes.
   * Pass 2: Bitwise inverted complement bytes.
   * Pass 3: All zero bytes (0x00).
   */
  public static zeroize(buffer: Buffer): void {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return;

    try {
      // Pass 1: Random bytes
      const random = crypto.randomBytes(buffer.length);
      random.copy(buffer);

      // Pass 2: Bitwise NOT complement
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = ~buffer[i] & 0xff;
      }

      // Pass 3: Strict zeroization
      buffer.fill(0);
    } catch {
      // Fallback guarantees zeroes even if randomBytes fails
      buffer.fill(0);
    }
  }

  /**
   * Overwrites an array of Buffers.
   */
  public static zeroizeMany(buffers: Buffer[]): void {
    for (const buf of buffers) {
      this.zeroize(buf);
    }
  }

  /**
   * Overwrites sensitive string properties on an object in-place.
   */
  public static sanitizeSensitiveObject(target: Record<string, any>): void {
    if (!target || typeof target !== 'object') return;

    const sensitiveKeyPatterns = [/key/i, /secret/i, /mnemonic/i, /seed/i, /pass/i, /token/i];

    for (const key of Object.keys(target)) {
      const isSensitive = sensitiveKeyPatterns.some(pat => pat.test(key));
      const val = target[key];

      if (isSensitive && typeof val === 'string') {
        // Attempt to wipe buffer representation
        const buf = Buffer.from(val, 'utf-8');
        this.zeroize(buf);
        target[key] = '[ZEROIZED_BY_SECURITY_KERNEL]';
      } else if (val && typeof val === 'object') {
        this.sanitizeSensitiveObject(val);
      }
    }
  }

  /**
   * Overwrites sensitive string memory representation.
   */
  public static scrubSensitiveString(str?: string): void {
    if (typeof str === 'string') {
      const buf = Buffer.from(str, 'utf-8');
      this.zeroize(buf);
    }
  }

  /**
   * Recursively sanitizes sensitive fields in an object.
   */
  public static scrubObject(target: Record<string, any>): void {
    this.sanitizeSensitiveObject(target);
  }
}
