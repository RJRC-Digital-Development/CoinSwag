import { Request, Response, NextFunction } from 'express';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;
const MAX_STRING_LENGTH = 10000;

/**
 * Recursively inspects objects for prototype pollution keys and excessive nesting depth.
 */
function scanPayload(obj: any, currentDepth = 0): { valid: boolean; reason?: string } {
  if (currentDepth > MAX_DEPTH) {
    return { valid: false, reason: 'Payload nesting depth exceeded maximum threshold (Anti-DoS Sentinel)' };
  }

  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      if (obj.length > MAX_STRING_LENGTH) {
        return { valid: false, reason: 'Field length exceeds maximum threshold' };
      }
      if (obj.includes('\0')) {
        return { valid: false, reason: 'Null-byte injection detected' };
      }
    }
    return { valid: true };
  }

  // Check array elements
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = scanPayload(obj[i], currentDepth + 1);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  // Check prototype slot integrity
  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype) {
    return { valid: false, reason: 'Prototype pollution vector detected: modified prototype slot' };
  }

  // Check object keys
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return { valid: false, reason: `Prototype pollution vector detected: forbidden key "${key}"` };
    }

    const value = obj[key];
    const result = scanPayload(value, currentDepth + 1);
    if (!result.valid) return result;
  }

  return { valid: true };
}

/**
 * Express middleware to sanitize incoming request bodies, queries, and parameters.
 */
export function inputValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Validate request body
  if (req.body && typeof req.body === 'object') {
    const scanResult = scanPayload(req.body);
    if (!scanResult.valid) {
      res.status(400).json({
        error: 'Malicious payload rejected (Anti-Tampering Sentinel)',
        reason: scanResult.reason
      });
      return;
    }
  }

  // Validate query parameters
  if (req.query && typeof req.query === 'object') {
    const scanResult = scanPayload(req.query);
    if (!scanResult.valid) {
      res.status(400).json({
        error: 'Malicious query string rejected (Anti-Tampering Sentinel)',
        reason: scanResult.reason
      });
      return;
    }
  }

  // Validate route parameters
  if (req.params && typeof req.params === 'object') {
    const scanResult = scanPayload(req.params);
    if (!scanResult.valid) {
      res.status(400).json({
        error: 'Malicious route parameters rejected (Anti-Tampering Sentinel)',
        reason: scanResult.reason
      });
      return;
    }
  }

  next();
}
