import { rateLimit } from 'express-rate-limit';

export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: (request) => request.apiKey.rate_limit_per_minute,
  keyGenerator: (request) => String(request.apiKey.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'API key rate limit exceeded' },
});