const minimumLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10);

function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < minimumLength) {
    return `Password must be at least ${minimumLength} characters long`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain uppercase, lowercase, and numeric characters';
  }
  return null;
}

module.exports = { minimumLength, validatePasswordPolicy };
