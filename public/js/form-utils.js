// =========================================
// Form Utilities - Modular form functions  
// =========================================

/**
 * Initialize form collapse/expand functionality for all forms
 */
function initializeFormGroups() {
    const headers = document.querySelectorAll('.form-group-header');
    
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const contentId = this.getAttribute('data-toggle');
            const content = document.getElementById(contentId);
            const icon = this.querySelector('.toggle-icon');
            
            if (content && icon) {
                content.classList.toggle('open');
                // Rotate icon
                if (icon.textContent.includes('chevron')) {
                    icon.style.transform = content.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
                } else {
                    icon.style.transform = content.classList.contains('open') ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            }
        });
    });
}

/**
 * Initialize collapse all buttons for all document types
 */
function initializeCollapseButtons() {
    const collapseButtons = document.querySelectorAll('.collapse-all-btn');
    
    collapseButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            const section = document.getElementById(`${target}-section`) || 
                           document.getElementById(`${target}-certificate-section`);
            
            if (section) {
                const contents = section.querySelectorAll('.form-group-content');
                const icons = section.querySelectorAll('.toggle-icon');
                const isExpanded = this.classList.contains('expanded');
                
                contents.forEach(content => {
                    if (isExpanded) {
                        content.classList.remove('open');
                    } else {
                        content.classList.add('open');
                    }
                });
                
                icons.forEach(icon => {
                    if (icon.textContent.includes('chevron')) {
                        icon.style.transform = isExpanded ? 'rotate(-90deg)' : 'rotate(0deg)';
                    } else {
                        icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                });
                
                this.classList.toggle('expanded');
            }
        });
    });
}

/**
 * Collect form data into an object from a specific form or all forms
 * @param {HTMLFormElement|null} form - The form to collect data from (null = collection from all forms)
 * @returns {Object} Form data grouped by form type
 */
function collectFormData(form) {
    if (form) {
        const formData = new FormData(form);
        const data = {};
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    } else {
        // Collect from all visible forms
        const allForms = document.querySelectorAll('form[id$="-form"]');
        const allData = {};
        allForms.forEach(f => {
            const formData = new FormData(f);
            for (const [key, value] of formData.entries()) {
                allData[key] = value;
            }
        });
        return allData;
    }
}

/**
 * Validate form data - check for required fields
 * @param {Object} data - Form data to validate
 * @param {string[]} requiredFields - Array of required field names (optional)
 * @returns {Object} {valid: boolean, errors: string[]}
 */
function validateFormData(data, requiredFields = null) {
    const errors = [];
    
    if (requiredFields) {
        // Validate specific required fields
        requiredFields.forEach(field => {
            if (!data[field] || data[field].trim() === '') {
                errors.push(`Field "${field}" is required`);
            }
        });
    } else {
        // Check all fields in the data object
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null || value.toString().trim() === '') {
                errors.push(`Field "${key}" is empty`);
            }
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Get the active document form
 * @returns {HTMLFormElement|null} The active form or null
 */
function getActiveForm() {
    const activeSection = document.querySelector('.form-section.active');
    if (activeSection) {
        return activeSection.querySelector('form');
    }
    return null;
}

/**
 * Get form type from form element
 * @param {HTMLFormElement} form - The form element
 * @returns {string} Form type (birth, marriage, business, origland, transferland)
 */
function getFormType(form) {
    const id = form.id || '';
    if (id.includes('birth')) return 'birth';
    if (id.includes('marriage')) return 'marriage';
    if (id.includes('business')) return 'business';
    if (id.includes('origland')) return 'origland';
    if (id.includes('transferland')) return 'transferland';
    return 'unknown';
}

/**
 * Submit form via API
 * @param {string} formType - Document type (birth, marriage, etc.)
 * @param {Object} formData - Form data to submit
 */
async function submitForm(formType, formData) {
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                formType: formType,
                ...formData
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}: Failed to generate document`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error submitting form:', error);
        throw error;
    }
}

/**
 * Clear all form fields in a specific form
 * @param {HTMLFormElement} form - The form to clear
 */
function clearForm(form) {
    form.reset();
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.classList.remove('error');
    });
}

/**
 * Highlight form error fields
 * @param {HTMLFormElement} form - The form
 * @param {string[]} errorFields - Array of field names with errors
 */
function highlightErrors(form, errorFields) {
    // Clear previous errors
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    
    errorFields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field) {
            field.classList.add('error');
            field.style.borderColor = '#dc2626';
            field.style.backgroundColor = '#fef2f2';
        }
    });
}

/**
 * Initialize all form listeners
 * NOTE: The submit handler here is for FUTURE backend submission only.
 * It is guarded by a data-attribute so it does NOT fire when app.js
 * has already registered a canvas-download handler on the same form.
 */
function initializeAllForms() {
    initializeFormGroups();
    initializeCollapseButtons();

    // Only attach backend submit listener to forms that opt-in with
    // data-backend-submit="true" — prevents conflict with app.js canvas handlers.
    document.querySelectorAll('form[id$="-form"][data-backend-submit="true"]').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formType = getFormType(this);
            const formData = collectFormData(this);

            console.log(`[form-utils] Submitting ${formType} form to backend:`, formData);

            try {
                const result = await submitForm(formType, formData);
                console.log('[form-utils] Form submitted successfully:', result);
            } catch (error) {
                console.error('[form-utils] Form submission failed:', error);
            }
        });
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAllForms);
} else {
    initializeAllForms();
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeFormGroups,
        initializeCollapseButtons,
        collectFormData,
        validateFormData,
        getActiveForm,
        getFormType,
        submitForm,
        clearForm,
        highlightErrors,
        initializeAllForms
    };
}
