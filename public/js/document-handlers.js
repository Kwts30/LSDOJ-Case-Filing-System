// =========================================
// Document Handlers - Validation only
// =========================================

/**
 * DOJ Official Letter Handler
 */
const DojLetterHandler = {
    formType: 'dojletter',
    formId: 'dojletter-form',

    getForm() {
        return document.getElementById(this.formId);
    },

    validate(data) {
        const required = ['date', 'reference_no', 'to_name', 'from_name', 'subject', 'message'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Search Warrant Handler
 */
const SearchWarrantHandler = {
    formType: 'searchwarrant',
    formId: 'searchwarrant-form',

    getForm() {
        return document.getElementById(this.formId);
    },

    validate(data) {
        const required = ['warrant_no', 'case_no', 'affiant_name', 'target_name', 'target_premises_vehicle', 'property_to_be_seized', 'execute_within_days', 'return_within_days'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Subpoena Handler
 */
const SubpoenaHandler = {
    formType: 'subpoena',
    formId: 'subpoena-form',

    getForm() {
        return document.getElementById(this.formId);
    },

    validate(data) {
        const required = ['case_no', 'to_name', 'to_address', 'appear_before', 'location', 'appear_date', 'appear_time'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Warrant of Arrest Handler
 */
const ArrestWarrantHandler = {
    formType: 'arrestwarrant',
    formId: 'arrestwarrant-form',

    getForm() {
        return document.getElementById(this.formId);
    },

    validate(data) {
        const required = ['criminal_case_no', 'subject_name', 'charges_filed', 'affidavit_name', 'affidavit_date', 'validity_days'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Handler Registry
 */
const DocumentHandlers = {
    dojletter: DojLetterHandler,
    searchwarrant: SearchWarrantHandler,
    subpoena: SubpoenaHandler,
    arrestwarrant: ArrestWarrantHandler,

    getHandler(formType) {
        return this[formType] || null;
    },

    supportsType(formType) {
        return !!this[formType];
    }
};

// Export (Node.js compatibility)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DocumentHandlers };
}
