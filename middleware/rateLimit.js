// Rate limiting middleware with MongoDB tracking
// Tracks both IP address and session to limit requests to 50 per hour

const { getDatabase } = require('../utils/db');

async function rateLimitMiddleware(req, res, next) {
  try {
    const db = getDatabase();
    const rateLimitCollection = db.collection('rate_limit');
    const ip = req.ip || req.connection.remoteAddress;
    const sessionId = req.sessionID || req.cookies?.sessionId || 'anonymous';

    // Combine IP and session for unique identifier
    const identifier = `${ip}:${sessionId}`;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000); // 1 hour in ms

    // Count requests from this IP+Session in the last hour
    const requestCount = await rateLimitCollection.countDocuments({
      identifier,
      created_at: { $gte: oneHourAgo }
    });

    const limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '50', 10);

    if (requestCount >= limit) {
      res.set('Retry-After', '3600');
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${limit} requests per hour allowed.`,
        retryAfter: 3600
      });
    }

    // Record this request
    await rateLimitCollection.insertOne({
      identifier,
      ip,
      sessionId,
      created_at: now,
      endpoint: req.path,
      method: req.method
    });

    // Store remaining requests count in response headers
    const remaining = limit - requestCount - 1;
    res.set('X-RateLimit-Limit', limit.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, remaining).toString());
    res.set('X-RateLimit-Reset', new Date(now.getTime() + 3600000).toISOString());

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // Don't block requests if rate limiting fails
    next();
  }
}

module.exports = { rateLimitMiddleware };
