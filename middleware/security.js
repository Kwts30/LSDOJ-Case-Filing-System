// Security middleware - applies security headers and protections

const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

// Helmet security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'cdnjs.cloudflare.com', 'fonts.gstatic.com', 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Input sanitization validators
const sanitizeInput = (field) => {
  return body(field)
    .trim()
    .escape()
    .maxLength(500)
    .custom(value => {
      // Reject if contains suspicious patterns
      const suspiciousPatterns = /<script|javascript:|onerror|onclick|<iframe|eval|expression/gi;
      if (suspiciousPatterns.test(value)) {
        throw new Error('Invalid characters detected');
      }
      return true;
    });
};

// Validate form submission
const validateFormSubmission = [
  body('formType').isIn(['birth', 'marriage', 'business', 'origland', 'transferland']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Global error handler - don't expose stack traces in production
const errorHandler = (err, req, res, next) => {
  const env = process.env.NODE_ENV || 'development';
  const status = err.status || 500;

  console.error('[Error]', err);

  const response = {
    error: err.message || 'Internal Server Error'
  };

  if (env === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

module.exports = {
  helmetConfig,
  sanitizeInput,
  validateFormSubmission,
  errorHandler
};
