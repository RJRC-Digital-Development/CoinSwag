import crypto from 'crypto';

/**
 * Constant-time comparison utility to prevent timing side-channel attacks.
 */
export class TimingSafeEqual {
  /**
   * Compares two secret strings in constant time.
   * Both inputs are hashed with SHA-256 first so that buffer lengths are strictly
   * identical (32 bytes), avoiding length-leakage before crypto.timingSafeEqual is evaluated.
   */
  public static compare(a?: string | null, b?: string | null): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
    const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();

    return crypto.timingSafeEqual(hashA, hashB);
  }
}
