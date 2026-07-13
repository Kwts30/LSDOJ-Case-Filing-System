const { canViewFiling, canEditFiling, canReviewFiling, canManageUser } = require('../utils/accessControl');

const filing = {
  submitted_by: 'officer-1',
  da_reviewer: 'da-1',
  status: 'under_review'
};

describe('filing access control', () => {
  test('limits editing to the owner while a filing is editable', () => {
    expect(canEditFiling({ id: 'officer-1', department: 'LSPD', adminRole: 'none' }, { ...filing, status: 'draft' })).toBe(true);
    expect(canEditFiling({ id: 'officer-2', department: 'LSPD', adminRole: 'none' }, { ...filing, status: 'draft' })).toBe(false);
  });

  test('allows DA users to view but only the assigned DA reviewer to decide', () => {
    expect(canViewFiling({ id: 'da-2', department: 'DA', adminRole: 'none' }, filing)).toBe(true);
    expect(canReviewFiling({ id: 'da-2', department: 'DA', adminRole: 'none' }, filing)).toBe(false);
    expect(canReviewFiling({ id: 'da-1', department: 'DA', adminRole: 'none' }, filing)).toBe(true);
  });

  test('prevents department administrators from managing users in another department', () => {
    expect(canManageUser({ id: 'admin-1', department: 'LSPD', adminRole: 'department_admin' }, { department: 'DA' })).toBe(false);
    expect(canManageUser({ id: 'admin-1', department: 'LSPD', adminRole: 'department_admin' }, { department: 'LSPD' })).toBe(true);
  });
});
