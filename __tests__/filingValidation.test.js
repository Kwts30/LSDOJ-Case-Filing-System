const { normalizeFilingInput, validateFilingInput } = require('../utils/filingValidation');

describe('filing validation', () => {
  const chargeCodes = ['PC-101', 'PC-102'];

  test('requires warrant charges and a substantive narrative on submission', () => {
    const filing = normalizeFilingInput({
      filing_type: 'warrant_request',
      accused_name: 'Alex Doe',
      narrative: 'Too short'
    });

    const result = validateFilingInput(filing, { department: 'LSPD', chargeCodes });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/charges/);
    expect(result.errors.join(' ')).toMatch(/narrative/);
  });

  test('permits an affidavit filing without charges when its schema allows it', () => {
    const filing = normalizeFilingInput({
      filing_type: 'case_filing',
      accused_name: 'Alex Doe',
      narrative: 'This affidavit describes the relevant facts and circumstances in sufficient detail.'
    });

    expect(validateFilingInput(filing, { department: 'LSPD', chargeCodes }).valid).toBe(true);
  });

  test('rejects filing types outside the actor department', () => {
    const filing = normalizeFilingInput({
      filing_type: 'warrant_request',
      accused_name: 'Alex Doe',
      charges: 'PC-101',
      narrative: 'This narrative is long enough to satisfy the filing validation requirements.'
    });

    const result = validateFilingInput(filing, { department: 'DA', chargeCodes });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('This filing type is not available to your department');
  });
});
