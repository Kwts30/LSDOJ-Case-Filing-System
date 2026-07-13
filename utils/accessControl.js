const { ADMIN_ROLES } = require('../config/constants');

function getActor(req) {
  return {
    id: req.session?.userId || req.user?._id || null,
    department: req.session?.department || req.user?.department || null,
    adminRole: req.session?.admin_role || req.user?.admin_role || 'none'
  };
}

function isSuperAdmin(actor) {
  return actor.adminRole === ADMIN_ROLES.SUPER_ADMIN;
}

function sameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function canViewFiling(actor, filing) {
  if (!actor?.id || !filing) return false;
  if (isSuperAdmin(actor)) return true;
  if (sameId(actor.id, filing.submitted_by)) return true;
  return actor.department === 'DA';
}

function canEditFiling(actor, filing) {
  return Boolean(
    actor?.id &&
    filing &&
    !isSuperAdmin(actor) &&
    actor.department === 'LSPD' &&
    sameId(actor.id, filing.submitted_by) &&
    ['draft', 'needs_revision'].includes(filing.status)
  ) || Boolean(isSuperAdmin(actor) && ['draft', 'needs_revision'].includes(filing?.status));
}

function canCreateFiling(actor, schema) {
  return Boolean(actor?.id && schema && (isSuperAdmin(actor) || actor.department === schema.department));
}

function canReviewFiling(actor, filing) {
  if (!actor?.id || !filing) return false;
  if (isSuperAdmin(actor)) return true;
  return actor.department === 'DA' && sameId(actor.id, filing.da_reviewer);
}

function canManageUser(actor, targetUser) {
  if (!actor?.id || !targetUser) return false;
  return isSuperAdmin(actor) || actor.department === targetUser.department;
}

module.exports = {
  getActor,
  isSuperAdmin,
  canViewFiling,
  canEditFiling,
  canCreateFiling,
  canReviewFiling,
  canManageUser
};
