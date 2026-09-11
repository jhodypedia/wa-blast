import { validateApiKey } from '../services/apiKeyService.js';

export async function apiKeyAuth(request, response, next) {
  try {
    const rawKey = request.get('x-api-key');
    if (!rawKey) {
      return response.status(401).json({ error: 'A valid x-api-key header is required' });
    }

    const apiKey = await validateApiKey(rawKey);
    if (!apiKey) {
      return response.status(401).json({ error: 'A valid x-api-key header is required' });
    }

    request.apiKey = {
      ...apiKey,
      rate_limit_per_minute: apiKey.rateLimitPerMinute,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}