// Application constants — LSPD / DA Filing System
// Enums, reference values, and configuration

const DEPARTMENTS = ['LSPD', 'DA', 'DOJ'];

// Position lists per department
// Used for signup dropdown and validation
const POSITIONS = {
  LSPD: [
    'Cadet',
    'Officer',
    'Senior Officer',
    'Corporal',
    'Detective',
    'Sergeant',
    'Lieutenant',
    'Captain',
    'Commander',
    'Assistant Chief',
    'Chief of Police'
  ],
  DA: [
    'Prosecution Attorney',
    'Assistant District Attorney',
    'Deputy District Attorney',
    'District Attorney'
  ],
  DOJ: [
    'Paralegal',
    'Judge',
    'Associate Justice',
    'Chief of Justice'
  ]
};

// Filing Types per Department
const FILING_TYPES = {
  LSPD: [
    { value: 'warrant_request', label: 'Arrest Warrant' },
    { value: 'case_filing', label: 'Case Filing (Affidavit)' }
  ],
  DA: [
    { value: 'communication_letter', label: 'Communication Letter to LSPD' },
    { value: 'issued_warrants', label: 'Issued Warrants' }
  ],
  DOJ: [
    { value: 'communication_letter', label: 'Communication Letter to LSPD' },
    { value: 'issued_warrants', label: 'Issued Warrants' }
  ]
};

// Filing lifecycle statuses
const FILING_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  NEEDS_REVISION: 'needs_revision',
  FILED: 'filed',
  DISMISSED: 'dismissed'
};

// Account verification statuses
const ACCOUNT_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected'
};

// Admin role levels
const ADMIN_ROLES = {
  NONE: 'none',
  DEPARTMENT_ADMIN: 'department_admin',
  SUPER_ADMIN: 'super_admin'
};

// Structured revision/denial reasons
const REVISION_REASONS = {
  MISSING_EVIDENCE: 'missing_evidence',
  WRONG_CHARGE_CODE: 'wrong_charge_code',
  INSUFFICIENT_NARRATIVE: 'insufficient_narrative',
  OTHER: 'other'
};

// Revision reason labels (for UI display)
const REVISION_REASON_LABELS = {
  missing_evidence: 'Missing Evidence',
  wrong_charge_code: 'Wrong Charge Code',
  insufficient_narrative: 'Insufficient Narrative',
  other: 'Other'
};

// Filing status display config (label, color token)
const STATUS_DISPLAY = {
  draft: { label: 'Draft', color: 'status-draft', icon: 'edit_note' },
  submitted: { label: 'Submitted', color: 'status-submitted', icon: 'send' },
  under_review: { label: 'Under Review', color: 'status-review', icon: 'rate_review' },
  needs_revision: { label: 'Needs Revision', color: 'status-revision', icon: 'assignment_return' },
  filed: { label: 'Filed', color: 'status-filed', icon: 'task_alt' },
  dismissed: { label: 'Dismissed', color: 'status-closed', icon: 'cancel' }
};

// Account status display config
const ACCOUNT_STATUS_DISPLAY = {
  pending: { label: 'Pending Verification', color: 'status-pending', icon: 'hourglass_empty' },
  active: { label: 'Active', color: 'status-active', icon: 'check_circle' },
  rejected: { label: 'Rejected', color: 'status-rejected', icon: 'cancel' }
};

// Charge categories
const CHARGE_CATEGORIES = ['felony', 'misdemeanor', 'infraction'];

// Attachment types
const ATTACHMENT_TYPES = [
  { value: 'evidence_photo', label: 'Evidence Photo' },
  { value: 'witness_statement', label: 'Witness Statement' },
  { value: 'body_cam', label: 'Body Camera Footage' },
  { value: 'dash_cam', label: 'Dash Camera Footage' },
  { value: 'surveillance', label: 'Surveillance Footage' },
  { value: 'forensic_report', label: 'Forensic Report' },
  { value: 'medical_report', label: 'Medical Report' },
  { value: 'other', label: 'Other' }
];

// Audit log action types
const AUDIT_ACTIONS = [
  'view', 'download', 'approve', 'deny', 'edit',
  'login', 'logout', 'signup', 'submit', 'claim',
  'generate', 'create', 'delete', 'revise', 'dismiss'
];

// Audit log target types
const AUDIT_TARGET_TYPES = ['filing', 'document', 'account', 'system'];

// Escalation threshold (configurable via env)
const ESCALATION_THRESHOLD_HOURS = parseInt(process.env.ESCALATION_THRESHOLD_HOURS || '48', 10);

// File upload limits
const UPLOAD_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'video/mp4', 'video/webm',
    'text/plain'
  ],
  maxFilesPerCase: 20
};

// Admin positions that have department_admin privileges by default
const ADMIN_POSITIONS = {
  LSPD: ['Chief of Police', 'Assistant Chief'],
  DA: ['District Attorney'],
  DOJ: ['Associate Justice', 'Chief of Justice']
};

module.exports = {
  DEPARTMENTS,
  POSITIONS,
  FILING_STATUSES,
  ACCOUNT_STATUSES,
  ADMIN_ROLES,
  REVISION_REASONS,
  REVISION_REASON_LABELS,
  STATUS_DISPLAY,
  ACCOUNT_STATUS_DISPLAY,
  CHARGE_CATEGORIES,
  ATTACHMENT_TYPES,
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  ESCALATION_THRESHOLD_HOURS,
  UPLOAD_LIMITS,
  ADMIN_POSITIONS,
  FILING_TYPES
};
