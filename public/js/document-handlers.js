// =========================================
// Document Handlers - Type-specific logic
// =========================================

/**
 * Birth Certificate Handler
 */
const BirthCertificateHandler = {
    formType: 'birth',
    formId: 'birth-certificate-form',
    
    getForm() {
        return document.getElementById(this.formId);
    },
    
    generatePreview(data) {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw certificate template
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Title
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CERTIFICATE OF LIVE BIRTH', canvas.width / 2, 50);
        
        // Child name
        ctx.font = '16px Arial';
        const childName = `${data.name_first || ''} ${data.name_last || ''}`.trim();
        ctx.fillText(childName || '[Name]', canvas.width / 2, 120);
        
        // Birth date
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Date: ${data.date_birth || ''}`, 50, 200);
        
        // Registration number
        ctx.fillText(`Registry No: ${data.state_file_num || ''}`, 50, 220);
    },
    
    validate(data) {
        const required = ['state_file_num', 'local_reg_num', 'name_first', 'name_last', 'date_birth'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Marriage Certificate Handler
 */
const MarriageCertificateHandler = {
    formType: 'marriage',
    formId: 'marriage-certificate-form',
    
    getForm() {
        return document.getElementById(this.formId);
    },
    
    generatePreview(data) {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CERTIFICATE OF MARRIAGE', canvas.width / 2, 50);
        
        ctx.font = '16px Arial';
        const groomName = `${data.groom_first || ''} ${data.groom_last || ''}`.trim();
        const brideName = `${data.bride_first || ''} ${data.bride_last || ''}`.trim();
        ctx.fillText(`${groomName || '[Groom]'} & ${brideName || '[Bride]'}`, canvas.width / 2, 120);
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Date: ${data.marriage_date || ''}`, 50, 200);
    },
    
    validate(data) {
        const required = ['groom_first', 'groom_last', 'bride_first', 'bride_last'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Business Permit Handler
 */
const BusinessPermitHandler = {
    formType: 'business',
    formId: 'business-permit-form',
    
    getForm() {
        return document.getElementById(this.formId);
    },
    
    generatePreview(data) {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BUSINESS PERMIT', canvas.width / 2, 50);
        
        ctx.font = '14px Arial';
        ctx.fillText(data.business_name || '[Business Name]', canvas.width / 2, 120);
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Type: ${data.business_type || ''}`, 50, 180);
        ctx.fillText(`Owner: ${data.owner_name || ''}`, 50, 200);
    },
    
    validate(data) {
        const required = ['business_name', 'owner_name'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Land Title (Original) Handler
 */
const LandTitleOrigHandler = {
    formType: 'origland',
    formId: 'origland-form',
    
    getForm() {
        return document.getElementById(this.formId);
    },
    
    generatePreview(data) {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ORIGINAL CERTIFICATE OF TITLE', canvas.width / 2, 50);
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Title No: ${data.title_number || ''}`, 50, 100);
        ctx.fillText(`Owner: ${data.owner_name || ''}`, 50, 130);
        ctx.fillText(`Area: ${data.property_area || ''} sq m`, 50, 160);
    },
    
    validate(data) {
        const required = ['title_number', 'owner_name'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Land Title (Transfer) Handler
 */
const LandTitleTransferHandler = {
    formType: 'transferland',
    formId: 'transferland-form',
    
    getForm() {
        return document.getElementById(this.formId);
    },
    
    generatePreview(data) {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TRANSFER CERTIFICATE OF TITLE', canvas.width / 2, 50);
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Original Title: ${data.orig_title_number || ''}`, 50, 100);
        ctx.fillText(`From: ${data.orig_owner_name || ''}`, 50, 130);
        ctx.fillText(`To: ${data.new_owner_name || ''}`, 50, 160);
        ctx.fillText(`Date: ${data.transfer_date || ''}`, 50, 190);
    },
    
    validate(data) {
        const required = ['orig_title_number', 'orig_owner_name', 'new_owner_name'];
        return required.every(field => data[field] && data[field].toString().trim());
    }
};

/**
 * Handler Registry - Get handler by document type
 */
const DocumentHandlers = {
    birth: BirthCertificateHandler,
    marriage: MarriageCertificateHandler,
    business: BusinessPermitHandler,
    origland: LandTitleOrigHandler,
    transferland: LandTitleTransferHandler,
    
    getHandler(formType) {
        return this[formType] || null;
    },
    
    supportsType(formType) {
        return !!this[formType];
    },
    
    previewOnInput(formType) {
        const handler = this.getHandler(formType);
        if (!handler) return;
        
        const form = handler.getForm();
        if (!form) return;
        
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                const formData = collectFormData(form);
                handler.generatePreview(formData);
            });
        });
    }
};

/**
 * Global helper to collect form data (requires form-utils.js)
 */
function collectFormData(form) {
    if (typeof window.collectFormData === 'function') {
        return window.collectFormData(form);
    }
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
        data[key] = value;
    }
    return data;
}

// Export handlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DocumentHandlers };
}
