import { Request, Response, NextFunction } from 'express';

/**
 * Applies military-grade HTTP security headers to all responses.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Strip Express identification to prevent server banner fingerprinting
  res.removeHeader('X-Powered-By');

  // Prevent framing, clickjacking, and embedding attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Strict Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' *; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
  );

  // Strict-Transport-Security (HSTS: 2 years, subdomains, preloaded)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Strict Referrer Policy (never leak swap order URLs or query params to third parties)
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Disable all browser hardware device features
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()'
  );

  // Cross-Origin Isolation
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Disable DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Disable caching on all API endpoints to protect sensitive order data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}
