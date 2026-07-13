const { ATTACHMENT_TYPES } = require('./constants');

const FILING_SCHEMAS = {
  warrant_request: {
    label: 'Arrest Warrant',
    department: 'LSPD',
    template: 'warrant_request',
    fields: {
      accused_name: { required: true, minLength: 2, maxLength: 160 },
      accused_id_number: { required: false, maxLength: 80 },
      charges: { required: true, minItems: 1, maxItems: 12 },
      narrative: { required: true, minLength: 40, maxLength: 12000 }
    },
    requirements: {
      officerSignature: true,
      evidence: true
    },
    ui: {
      charges: true,
      evidence: true
    }
  },
  case_filing: {
    label: 'Case Filing (Affidavit)',
    department: 'LSPD',
    template: 'case_filing',
    fields: {
      accused_name: { required: true, minLength: 2, maxLength: 160 },
      accused_id_number: { required: false, maxLength: 80 },
      charges: { required: false, minItems: 0, maxItems: 12 },
      narrative: { required: true, minLength: 40, maxLength: 12000 }
    },
    requirements: {
      officerSignature: false,
      evidence: false
    },
    ui: {
      charges: false,
      evidence: false
    }
  }
};

const ATTACHMENT_CATEGORY_VALUES = ATTACHMENT_TYPES.map(type => type.value);

function getFilingSchema(filingType) {
  return FILING_SCHEMAS[filingType] || null;
}

function getFilingTypesForDepartment(department) {
  return Object.entries(FILING_SCHEMAS)
    .filter(([, schema]) => schema.department === department)
    .map(([value, schema]) => ({ value, label: schema.label }));
}

module.exports = {
  FILING_SCHEMAS,
  ATTACHMENT_CATEGORY_VALUES,
  getFilingSchema,
  getFilingTypesForDepartment
};
