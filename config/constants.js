// Application constants - canvas dimensions, field coordinates, etc.

const CERTIFICATES = {
  birth: {
    name: 'Birth Certificate',
    templateWidth: 2480,
    templateHeight: 3508,
    previewWidth: 350,
    previewHeight: 495
  },
  marriage: {
    name: 'Marriage Certificate',
    templateWidth: 2480,
    templateHeight: 3508,
    previewWidth: 350,
    previewHeight: 495
  },
  business: {
    name: 'Business Permit',
    templateWidth: 3508,
    templateHeight: 2480,
    previewWidth: 450,
    previewHeight: 315,
    landscape: true
  },
  origland: {
    name: 'Original Land Title',
    templateWidth: 2480,
    templateHeight: 3508,
    previewWidth: 350,
    previewHeight: 495
  },
  transferland: {
    name: 'Transfer Land Title',
    templateWidth: 2480,
    templateHeight: 3508,
    previewWidth: 350,
    previewHeight: 495
  }
};

const FIELD_VALIDATIONS = {
  birth: {
    required: [
      'state_file_num', 'local_reg_num', 'name_first', 'name_last',
      'sex', 'date_birth', 'birth_place', 'birth_city', 'birth_state',
      'mother_name', 'mother_last', 'mother_bop', 'mother_birth',
      'father_name', 'father_last', 'father_bop', 'father_birth',
      'issuer_name', 'issuer_signature', 'registration_date'
    ],
    maxLength: 100
  },
  marriage: {
    required: [
      'marriage_state_file_num', 'marriage_local_reg_num',
      'groom_first', 'groom_middle', 'groom_last', 'groom_dob',
      'bride_first', 'bride_middle', 'bride_last', 'bride_dob',
      'groom_signature', 'bride_signature', 'marriage_date',
      'marriage_place', 'marriage_city', 'marriage_state'
    ],
    maxLength: 100
  },
  business: {
    required: [
      'date_issued', 'date_expiration', 'classification',
      'business_id_number', 'business_name'
    ],
    maxLength: 100
  },
  origland: {
    required: [
      'orig_full_name', 'orig_full_address', 'orig_land_title_number',
      'orig_issue_month', 'orig_issue_day', 'orig_issue_year'
    ],
    maxLength: 100
  },
  transferland: {
    required: [
      'trans_full_name', 'trans_full_address', 'trans_land_title_number',
      'trans_orig_land_title_number', 'trans_issue_month',
      'trans_issue_day', 'trans_issue_year'
    ],
    maxLength: 100
  }
};

module.exports = {
  CERTIFICATES,
  FIELD_VALIDATIONS
};
