const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

function requireProductionValue(name) {
  const value = process.env[name];
  if (isProduction && !value) {
    throw new Error(`${name} must be configured in production`);
  }
  return value;
}

const sessionSecret = requireProductionValue('SESSION_SECRET') || crypto.randomBytes(48).toString('hex');
const jwtSecret = requireProductionValue('JWT_SECRET') || crypto.randomBytes(48).toString('hex');

function validateProductionConfiguration() {
  if (!isProduction) return;
  ['MONGODB_URI', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_NAME'].forEach(requireProductionValue);
}

module.exports = {
  isProduction,
  sessionSecret,
  jwtSecret,
  validateProductionConfiguration
};
