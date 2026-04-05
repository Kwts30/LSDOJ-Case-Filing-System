# Modular Form System - Documentation

## Overview
The system has been refactored into a clean, modular component-based architecture for better maintainability and organization.

## Directory Structure

```
views/
├── partials/
│   ├── components/
│   │   ├── form-field.ejs        # Reusable form input component
│   │   ├── form-group.ejs        # Collapsible form section component
│   │   └── form-wrapper.ejs      # Document form template wrapper
│   └── forms/
│       ├── birth-new.ejs         # Birth certificate (using components)
│       ├── marriage-new.ejs      # Marriage certificate (using components)
│       ├── business-new.ejs      # Business permit (using components)
│       ├── origland-new.ejs      # Land title original (using components)
│       └── transferland-new.ejs  # Land title transfer (using components)

public/js/
├── form-utils.js         # Form utilities (validation, data collection, submission)
├── document-handlers.js  # Document-type specific logic (preview, validation)
└── app.js               # Main app initialization
```

## Components

### 1. form-field.ejs
Reusable form input component that renders text, select, textarea, etc.

**Usage:**
```ejs
<%- include('partials/components/form-field', {
    label: 'First Name',
    id: 'name_first',
    name: 'name_first',
    type: 'text',
    placeholder: 'Enter first name',
    required: true
}) %>
```

**Parameters:**
- `label` - Field label text
- `id` - HTML element ID
- `name` - Form field name
- `type` - Input type (text, email, date, select, textarea, etc.)
- `placeholder` - Placeholder text
- `required` - Boolean for required attribute
- `options` - Array of options for select fields
- `fullWidth` - Boolean to span full grid width

### 2. form-group.ejs
Collapsible form section that groups related fields.

**Usage:**
```ejs
<%- include('partials/components/form-group', {
    title: 'Child Information',
    icon: 'child_care',
    id: 'child-info',
    fields: [
        { label: 'First Name', id: 'name_first', ... },
        { label: 'Last Name', id: 'name_last', ... }
    ]
}) %>
```

**Parameters:**
- `title` - Section title
- `icon` - Material icon name
- `id` - Section ID (for toggle functionality)
- `fields` - Array of form-field objects

### 3. form-wrapper.ejs
Complete form template that wraps all sections with title and submit button.

**Usage:**
```ejs
<%- include('partials/components/form-wrapper', {
    documentType: 'birth',
    icon: 'note_add',
    title: 'Birth Certificate',
    formId: 'birth-certificate-form',
    sections: [
        {
            title: 'Certificate Numbers',
            icon: 'numbers',
            id: 'cert-numbers',
            fields: [...]
        }
    ]
}) %>
```

**Parameters:**
- `documentType` - Document type identifier (birth, marriage, business, etc.)
- `icon` - Material icon for the form header
- `title` - Form title
- `formId` - Form HTML ID
- `sections` - Array of form-group objects

## JavaScript Modules

### 1. form-utils.js
Generic form handling utilities.

**Functions:**

```javascript
// Initialize all form group collapse/expand functionality
initializeFormGroups()

// Initialize collapse all buttons
initializeCollapseButtons()

// Collect form data into an object
collectFormData(form)  // Returns: {fieldName: value, ...}

// Validate form data
validateFormData(data)  // Returns: boolean

// Submit form via API
submitForm(formType, formData)  // Returns: Promise

// Clear all form fields
clearForm(form)

// Highlight error fields
highlightErrors(form, errorFields)
```

### 2. document-handlers.js
Document-type specific logic.

**Handlers:**

```javascript
// Birth Certificate
BirthCertificateHandler.generatePreview(data)
BirthCertificateHandler.validate(data)

// Marriage Certificate
MarriageCertificateHandler.generatePreview(data)
MarriageCertificateHandler.validate(data)

// Business Permit
BusinessPermitHandler.generatePreview(data)
BusinessPermitHandler.validate(data)

// Get handler by type
DocumentHandlers.getHandler('birth')  // Returns handler or null
DocumentHandlers.supportsType('birth')  // Returns: boolean
```

## Workflow Example

### Adding a New Document Type

1. **Create form configuration:**
```ejs
<!-- views/partials/forms/mynewdoc-new.ejs -->
<%- include('../../components/form-wrapper', {
    documentType: 'mynewdoc',
    icon: 'description',
    title: 'My New Document',
    formId: 'mynewdoc-form',
    sections: [
        {
            title: 'Section 1',
            icon: 'info',
            id: 'section1',
            fields: [...]
        }
    ]
}) %>
```

2. **Add handler in document-handlers.js:**
```javascript
const MyNewDocHandler = {
    formType: 'mynewdoc',
    
    generatePreview(data) {
        // Draw preview on canvas
    },
    
    validate(data) {
        // Custom validation logic
        return true;
    }
};

DocumentHandlers.mynewdoc = MyNewDocHandler;
```

3. **Include in index.ejs:**
```ejs
<%- include('partials/forms/mynewdoc-new') %>
```

## Benefits of Modular System

✅ **DRY Principle** - No duplicate form code
✅ **Maintainability** - Changes in one place affect all forms
✅ **Scalability** - Easy to add new document types
✅ **Reusability** - Components can be used in different pages/contexts
✅ **Organization** - Clear separation of concerns
✅ **Testing** - Individual components easier to test
✅ **Flexibility** - Mix and match fields/sections as needed

## Migration from Old System

Old files remain for reference:
- `views/partials/forms/birth.ejs` (old)
- `views/partials/forms/marriage.ejs` (old)
- etc.

New files use the `-new` suffix:
- `views/partials/forms/birth-new.ejs` (new modular)
- `views/partials/forms/marriage-new.ejs` (new modular)
- etc.

Once testing is complete, old files can be removed and `-new` files renamed.

## Asset Icons

All forms use Material Design Icons. Common icons:
- `note_add` - Document
- `child_care` - Child
- `people` - People
- `person` - Individual
- `location_on` - Location
- `badge` - Certificate
- `business` - Business
- `store` - Store
- `landscape` - Land
- `swap_horiz` - Transfer
- `favorite` - Love/Marriage
- `event` - Date/Event

See full list: https://fonts.google.com/icons

## Future Enhancements

- [ ] Add form validation schemas (JSON Schema)
- [ ] Create form builder UI
- [ ] Add field dependencies/conditional rendering
- [ ] Create form analytics/tracking
- [ ] Add form versioning system
- [ ] Create form templates library
