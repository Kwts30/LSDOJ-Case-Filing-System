// MongoDB-backed, fixed-window rate limiting suitable for Vercel instances.
// Each IP/window pair uses one atomic counter rather than one database record
// per request. The IP is hashed before it is persisted.

const crypto = require('crypto');
const { getDatabase } = require('../utils/db');

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function clientIp(req) {
  // `req.ip` is trustworthy only when `trust proxy` is configured for the
  // hosting platform. server.js does this automatically for Vercel.
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 128);
}

function bucketId(namespace, ip, windowStart) {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
  return `${namespace}:${windowStart}:${ipHash}`;
}

function createRateLimitMiddleware({
  namespace,
  max,
  windowMs,
  message = 'Too many requests. Please try again later.'
}) {
  const safeMax = positiveInteger(max, 50, { max: 100000 });
  const safeWindowMs = positiveInteger(windowMs, 60 * 60 * 1000, { min: 1000, max: 24 * 60 * 60 * 1000 });

  return async function mongoRateLimit(req, res, next) {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / safeWindowMs) * safeWindowMs;
      const resetAt = new Date(windowStart + safeWindowMs);
      const counter = await getDatabase().collection('rate_limit_windows').findOneAndUpdate(
        { _id: bucketId(namespace, clientIp(req), windowStart) },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            namespace,
            window_start: new Date(windowStart),
            expires_at: resetAt
          }
        },
        { upsert: true, returnDocument: 'after', includeResultMetadata: false }
      );

      const count = Number(counter?.count || 1);
      const remaining = Math.max(0, safeMax - count);
      const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
      res.set('RateLimit-Limit', String(safeMax));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(Math.ceil(resetAt.getTime() / 1000)));

      if (count > safeMax) {
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'Too Many Requests', message, retryAfter });
      }
      return next();
    } catch (error) {
      // Availability is preferable to failing all requests if the database is
      // temporarily unavailable; Vercel Firewall must remain the outer DDoS layer.
      console.error('Rate limit error:', error.message);
      return next();
    }
  };
}

const rateLimitMiddleware = createRateLimitMiddleware({
  namespace: 'global',
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 50,
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW || 60 * 60 * 1000
});

const authRateLimitMiddleware = createRateLimitMiddleware({
  namespace: 'authentication',
  max: process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 10,
  windowMs: process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  message: 'Too many authentication attempts. Please try again later.'
});

module.exports = { rateLimitMiddleware, authRateLimitMiddleware, createRateLimitMiddleware };
