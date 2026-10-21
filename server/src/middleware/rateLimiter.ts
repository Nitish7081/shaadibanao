import { Request, Response, NextFunction } from 'express';

interface RateLimitStoreEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitStoreEntry>();

// Clean up expired entries every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitOptions {
  windowMs: number;    // Time window in ms (e.g. 15 * 60 * 1000 = 15 minutes)
  maxRequests: number; // Max requests allowed per window
  message?: string;
  skipInTest?: boolean;
}

/**
 * Lightweight, zero-dependency sliding window rate limiter
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const { windowMs, maxRequests, message, skipInTest = true } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting during test runs if configured
    if (skipInTest && (process.env.NODE_ENV === 'test' || process.env.SKIP_RATE_LIMIT === 'true')) {
      return next();
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${req.baseUrl || ''}:${req.path}:${clientIp}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      return next();
    }

    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (entry.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        },
      });
      return;
    }

    next();
  };
};

// Standard rate limiters for production
export const sensitiveEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,           // 30 requests per 15 min per IP
  message: 'Too many authentication or upload attempts from this IP. Please wait 15 minutes.',
});

export const apiGeneralLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 300,          // 300 requests per 15 min per IP
  message: 'API rate limit exceeded. Please slow down requests.',
});
