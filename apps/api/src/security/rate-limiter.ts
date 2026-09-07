import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  name?: string;
}

interface ClientRecord {
  timestamps: number[];
}

interface JailRecord {
  bannedUntil: number;
  failureCount: number;
  lastFailureAt: number;
}

export class RateLimiter {
  private records: Map<string, ClientRecord> = new Map();
  private jail: Map<string, JailRecord> = new Map();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Purge stale tracking data every 60 seconds
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Safely extracts and validates the client's IP address.
   */
  public getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    let rawIp: string;

    if (typeof forwarded === 'string') {
      rawIp = forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      rawIp = forwarded[0].trim();
    } else {
      rawIp = req.socket?.remoteAddress || req.ip || '127.0.0.1';
    }

    // Strip IPv6 prefix for localhost if present
    if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }

    // Basic sanitization: alphanumeric, dots, colons
    return rawIp.replace(/[^a-fA-F0-9.:]/g, '');
  }

  /**
   * Registers a failed authentication or security violation for an IP.
   * Jails the IP if failure threshold is reached.
   */
  public recordSecurityFailure(ip: string, maxFailures = 5, jailTimeMs = 3600000): boolean {
    const now = Date.now();
    const existing = this.jail.get(ip) || {
      bannedUntil: 0,
      failureCount: 0,
      lastFailureAt: now
    };

    // Reset failure count if last failure was over 15 minutes ago
    if (now - existing.lastFailureAt > 900000) {
      existing.failureCount = 0;
    }

    existing.failureCount++;
    existing.lastFailureAt = now;

    if (existing.failureCount >= maxFailures) {
      existing.bannedUntil = now + jailTimeMs;
      this.jail.set(ip, existing);
      return true; // Jailed
    }

    this.jail.set(ip, existing);
    return false;
  }

  /**
   * Checks if an IP is currently in the anti-brute-force jail.
   */
  public isJailed(ip: string): { jailed: boolean; remainingSeconds: number } {
    const record = this.jail.get(ip);
    if (!record) return { jailed: false, remainingSeconds: 0 };

    const now = Date.now();
    if (now < record.bannedUntil) {
      const remainingSeconds = Math.ceil((record.bannedUntil - now) / 1000);
      return { jailed: true, remainingSeconds };
    }

    return { jailed: false, remainingSeconds: 0 };
  }

  /**
   * Clears jail status for testing or admin manual release.
   */
  public resetJail(ip?: string): void {
    if (ip) {
      this.jail.delete(ip);
    } else {
      this.jail.clear();
    }
  }

  /**
   * Resets rate limiter memory for testing.
   */
  public resetLimits(): void {
    this.records.clear();
  }

  /**
   * Creates an Express middleware for a specific rate-limit configuration.
   */
  public createMiddleware(options: RateLimitOptions) {
    const { windowMs, maxRequests, message, name = 'rate-limiter' } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = this.getClientIp(req);

      // Check anti-brute-force jail first
      const jailStatus = this.isJailed(ip);
      if (jailStatus.jailed) {
        res.setHeader('Retry-After', jailStatus.remainingSeconds);
        res.status(403).json({
          error: 'IP address temporarily banned due to suspected brute-force activity (Anti-Intrusion Sentinel).',
          retryAfterSeconds: jailStatus.remainingSeconds
        });
        return;
      }

      const key = `${name}:${ip}`;
      const now = Date.now();
      const cutoff = now - windowMs;

      let record = this.records.get(key);
      if (!record) {
        record = { timestamps: [] };
        this.records.set(key, record);
      }

      // Filter timestamps within the sliding window
      record.timestamps = record.timestamps.filter(ts => ts > cutoff);

      if (record.timestamps.length >= maxRequests) {
        const oldest = record.timestamps[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json({
          error: message || 'Rate limit exceeded. Request throttled by Anti-DDoS Sentinel.',
          retryAfterSeconds
        });
        return;
      }

      record.timestamps.push(now);
      next();
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter(ts => ts > now - 3600000);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }

    for (const [ip, jailRecord] of this.jail.entries()) {
      if (now > jailRecord.bannedUntil && now - jailRecord.lastFailureAt > 3600000) {
        this.jail.delete(ip);
      }
    }
  }
}

// Global instance and pre-configured middlewares
export const rateLimiterSentinel = new RateLimiter();

export const globalRateLimit = rateLimiterSentinel.createMiddleware({
  name: 'global',
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Global rate limit exceeded (120 req/min). Slow down.'
});

export const quoteRateLimit = rateLimiterSentinel.createMiddleware({
  name: 'quotes',
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Quote rate limit exceeded (30 req/min).'
});

export const orderRateLimit = rateLimiterSentinel.createMiddleware({
  name: 'orders',
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'Order creation rate limit exceeded (15 req/min).'
});

export const keyVaultRateLimit = rateLimiterSentinel.createMiddleware({
  name: 'keyvault',
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Key Vault download limit exceeded (10 req/15min). Anti-Exfiltration triggered.'
});
