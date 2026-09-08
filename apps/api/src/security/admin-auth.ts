import { Request, Response, NextFunction } from 'express';
import { TimingSafeEqual } from './timing-safe';

/**
 * Admin / Operator Authentication Middleware.
 * Protects privileged administrative routes (circuit breaker trip/reset, fee sweep, janitor purge)
 * with constant-time comparison against ADMIN_API_KEY / OPERATOR_SECRET.
 */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY || process.env.OPERATOR_SECRET;

  // In production, if an ADMIN_API_KEY is configured, strictly enforce it
  if (adminKey) {
    const authHeader = req.headers['authorization'];
    const xApiKey = req.headers['x-admin-key'] as string;
    let token = xApiKey;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token || !TimingSafeEqual.compare(token, adminKey)) {
      res.status(401).json({
        error: 'Unauthorized: Valid Admin API Key required for operator controls',
        code: 'ADMIN_AUTH_REQUIRED'
      });
      return;
    }
  }

  next();
}
