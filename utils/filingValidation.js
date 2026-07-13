const { getFilingSchema, ATTACHMENT_CATEGORY_VALUES } = require('../config/filingSchemas');

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCharges(value) {
  const values = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  return [...new Set(values.map(asString).filter(Boolean))];
}

function normalizeFilingInput(body = {}) {
  return {
    filing_type: asString(body.filing_type),
    accused_name: asString(body.accused_name),
    accused_id_number: asString(body.accused_id_number) || null,
    charges: normalizeCharges(body.charges),
    narrative: asString(body.narrative)
  };
}

function validateFilingInput(input, { department, chargeCodes = [], requireComplete = true } = {}) {
  const errors = [];
  const schema = getFilingSchema(input.filing_type);

  if (!schema) {
    return { valid: false, errors: ['Unsupported filing type'], schema: null };
  }
  if (department && schema.department !== department) {
    return { valid: false, errors: ['This filing type is not available to your department'], schema };
  }

  for (const [field, rules] of Object.entries(schema.fields)) {
    const value = input[field];
    const isArray = Array.isArray(value);
    const hasValue = isArray ? value.length > 0 : Boolean(value);

    if (rules.required && !hasValue && (requireComplete || field === 'accused_name')) {
      errors.push(`${field.replace(/_/g, ' ')} is required`);
      continue;
    }
    if (!hasValue) continue;

    if (isArray) {
      if (rules.minItems && value.length < rules.minItems) errors.push(`${field.replace(/_/g, ' ')} requires at least ${rules.minItems} item(s)`);
      if (rules.maxItems && value.length > rules.maxItems) errors.push(`${field.replace(/_/g, ' ')} cannot exceed ${rules.maxItems} item(s)`);
    } else {
      if (rules.minLength && value.length < rules.minLength) errors.push(`${field.replace(/_/g, ' ')} must be at least ${rules.minLength} characters`);
      if (rules.maxLength && value.length > rules.maxLength) errors.push(`${field.replace(/_/g, ' ')} cannot exceed ${rules.maxLength} characters`);
    }
  }

  if (chargeCodes.length > 0) {
    const invalidCharges = input.charges.filter(code => !chargeCodes.includes(code));
    if (invalidCharges.length > 0) errors.push(`Unknown charge code(s): ${invalidCharges.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, schema };
}

function getUploadCategories(value, fileCount) {
  const categories = Array.isArray(value) ? value : (value ? [value] : []);
  const normalized = categories.map(asString);
  if (normalized.length !== fileCount) {
    throw new Error('Every uploaded file must have a category');
  }
  const invalid = normalized.filter(category => !ATTACHMENT_CATEGORY_VALUES.includes(category) && category !== 'officer_signature' && category !== 'da_signature');
  if (invalid.length > 0) {
    throw new Error(`Invalid attachment category: ${invalid[0]}`);
  }
  return normalized;
}

module.exports = {
  normalizeFilingInput,
  normalizeCharges,
  validateFilingInput,
  getUploadCategories
};
