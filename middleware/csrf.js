const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokensMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function csrfProtection(req, res, next) {
  if (!req.session) return next(new Error('Session middleware must run before CSRF protection'));
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();
  // Bearer tokens are not automatically attached by a browser, so they are not
  // susceptible to the cookie-based cross-site request attack this middleware prevents.
  if (req.get('authorization')?.startsWith('Bearer ')) return next();
  const suppliedToken = req.get('x-csrf-token') || req.body?._csrf;
  if (!tokensMatch(req.session.csrfToken, suppliedToken)) {
    if (req.path.startsWith('/api') || req.xhr || req.accepts(['json', 'html']) === 'json') {
      return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }
    return res.status(403).render('error', { message: 'Your form expired. Refresh the page and try again.' });
  }
  return next();
}

module.exports = { csrfProtection };
