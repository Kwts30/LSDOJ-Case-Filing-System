// Local-only certificate generator & downloader (no backend required)

// Modal elements (some retained for UX)
const loadingModal = document.getElementById('loading-modal');
const successModal = document.getElementById('success-modal');
const cancelButton = document.getElementById('cancel-button');
const doneButton = document.getElementById('done-button');
const errorModal = document.getElementById('error-modal');
const closeErrorButton = document.getElementById('close-error-button');
const errorMessage = document.getElementById('error-message');

function showSuccessModal(msg) {
    if (msg) document.getElementById('success-message').textContent = msg;
    successModal?.classList.add('show');
}
function hideSuccessModal() { successModal?.classList.remove('show'); }
function showErrorModal(msg) { if (msg) errorMessage.textContent = msg; errorModal?.classList.add('show'); }
function hideErrorModal() { errorModal?.classList.remove('show'); }
cancelButton?.addEventListener('click', () => loadingModal?.classList.remove('show'));
doneButton?.addEventListener('click', hideSuccessModal);
closeErrorButton?.addEventListener('click', hideErrorModal);

// Polyfill for canvas.toBlob (older Safari / legacy)
if (!HTMLCanvasElement.prototype.toBlob) {
    HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
        const dataURL = this.toDataURL(type, quality);
        const binStr = atob(dataURL.split(',')[1]);
        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
        cb(new Blob([arr], { type: type || 'image/png' }));
    };
}

// Helpers
function buildFileName(prefix, parts) {
    const cleaned = parts.map(p => (p || '').trim() || 'NA');
    const base = [prefix, ...cleaned].join('_');
    return base.replace(/[^a-zA-Z0-9_\-]+/g, '_') + '.png';
}

function downloadCanvas(canvas, filename) {
    canvas.toBlob(blob => {
        if (!blob) {
            showErrorModal('Could not generate image.');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        if (typeof a.download === 'undefined') {
            // Fallback: open in new tab
            window.open(url, '_blank');
        } else {
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
    }, 'image/png');
}

// Canvas & templates
const birthForm = document.getElementById('birth-certificate-form');
const marriageForm = document.getElementById('marriage-certificate-form');
const businessForm = document.getElementById('business-permit-form');
const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');
const zoomRange = document.getElementById('zoom-range');
const zoomValue = document.getElementById('zoom-value');
const previewContainer = document.getElementById('preview-container');

// Limited Edition tracking
let isLimitedEdition = false;

const TEMPLATE_WIDTH = 2480; // base (portrait A4) internal canvas size
const TEMPLATE_HEIGHT = 3508;
// Business permit is landscape oriented
const BUSINESS_TEMPLATE_WIDTH = 3508; // landscape width (rotated)
const BUSINESS_TEMPLATE_HEIGHT = 2480; // landscape height (rotated)
let PREVIEW_WIDTH = 600;
let PREVIEW_HEIGHT = 850;
let SCALE_X = TEMPLATE_WIDTH / PREVIEW_WIDTH;
let SCALE_Y = TEMPLATE_HEIGHT / PREVIEW_HEIGHT;

canvas.width = TEMPLATE_WIDTH;
canvas.height = TEMPLATE_HEIGHT;

// Will be updated by drawPreview() based on certificate type

const birthImage = new Image();
birthImage.src = 'assets/birthcert.png';
const marriageImage = new Image();
marriageImage.src = 'assets/marriagecert.png';
const businessImage = new Image();
// actual filename has a space: business permit.png
businessImage.src = 'assets/business permit.png';
const businessImageLE = new Image();
// Limited Edition business permit
businessImageLE.src = 'assets/business permitLE.png';
businessImage.onerror = () => { console.warn('business permit template missing, fallback to birthcert'); businessImage.src = 'assets/birthcert.png'; };
businessImageLE.onerror = () => { console.warn('Limited Edition business permit template missing, using regular version'); };

// Zoom handling (scale the preview container only; underlying full-res canvas stays same)
function applyZoom() {
    const z = parseInt(zoomRange?.value || '100', 10);
    if (zoomValue) zoomValue.textContent = z + '%';
    if (previewContainer) {
        const scale = z / 100;
        previewContainer.style.transform = `scale(${scale})`;
        if (!previewContainer.classList.contains('business-wide')) {
            previewContainer.style.width = '600px';
            previewContainer.style.height = '800px';
        }
    }
}
zoomRange?.addEventListener('input', applyZoom);
applyZoom();

let currentCertificateType = 'birth';

document.querySelectorAll('.sidebar-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-menu button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const text = btn.textContent?.trim();
        document.getElementById('birth-certificate-section').style.display = (text === 'Birth Certificate') ? 'block' : 'none';
        document.getElementById('marriage-certificate-section').style.display = (text === 'Marriage Certificate') ? 'block' : 'none';
        document.getElementById('business-permit-section').style.display = (text === 'Business Permit') ? 'block' : 'none';
        currentCertificateType = text === 'Marriage Certificate' ? 'marriage' : text === 'Business Permit' ? 'business' : 'birth';
        drawPreview();
    });
});

// Live preview
[birthForm, marriageForm, businessForm].forEach(f => f?.addEventListener('input', drawPreview));
birthImage.onload = () => drawPreview();
marriageImage.onload = () => drawPreview();
businessImage.onload = () => drawPreview();
businessImageLE.onload = () => drawPreview();

function drawPreview() {
    // dynamic preview scaling (business permit landscape toggle)
    if (currentCertificateType === 'business') {
        // Use scaled down business permit dimensions for preview
        PREVIEW_WIDTH = 1000; // Reduced from original for better viewing
        PREVIEW_HEIGHT = 700; // Reduced proportionally for landscape
        // Set canvas to landscape dimensions for business permit
        canvas.width = BUSINESS_TEMPLATE_WIDTH;
        canvas.height = BUSINESS_TEMPLATE_HEIGHT;
        SCALE_X = BUSINESS_TEMPLATE_WIDTH / PREVIEW_WIDTH; // Scale for preview
        SCALE_Y = BUSINESS_TEMPLATE_HEIGHT / PREVIEW_HEIGHT; // Scale for preview
    } else {
        PREVIEW_WIDTH = 600;
        PREVIEW_HEIGHT = 800;
        canvas.width = TEMPLATE_WIDTH;
        canvas.height = TEMPLATE_HEIGHT;
        SCALE_X = TEMPLATE_WIDTH / PREVIEW_WIDTH;
        SCALE_Y = TEMPLATE_HEIGHT / PREVIEW_HEIGHT;
    }
    
    if (previewContainer && !previewContainer.classList.contains('business-wide')) {
        // ensure default size for non-business after switching back
        previewContainer.style.width = PREVIEW_WIDTH + 'px';
        previewContainer.style.height = PREVIEW_HEIGHT + 'px';
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let template;
    if (currentCertificateType === 'marriage') {
        template = marriageImage;
    } else if (currentCertificateType === 'business') {
        template = isLimitedEdition ? businessImageLE : businessImage;
    } else {
        template = birthImage;
    }
    
    if (currentCertificateType === 'business') {
        // Draw business permit in landscape format
        ctx.drawImage(template, 0, 0, BUSINESS_TEMPLATE_WIDTH, BUSINESS_TEMPLATE_HEIGHT);
    } else {
        // Draw other certificates in portrait format
        ctx.drawImage(template, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
    }
    
    // Adjust container width for business permit
    if (previewContainer) {
        if (currentCertificateType === 'business') previewContainer.classList.add('business-wide');
        else previewContainer.classList.remove('business-wide');
    }

    if (currentCertificateType === 'birth') {
        const fields = [
            { id: 'state_file_num', x: 75, y: 218, placeholder: 'SFN', fontStyle: 'bold', fontSize: '50px' },
            { id: 'local_reg_num', x: 460, y: 218, placeholder: 'LRN', fontStyle: 'bold', fontSize: '50px' },
            { id: 'name_first', x: 80, y: 360, placeholder: 'First Name of Child', fontSize: '50px' },
            { id: 'name_middle', x: 245, y: 360, placeholder: 'Middle Name', fontSize: '50px' },
            { id: 'name_last', x: 405, y: 360, placeholder: 'Last Name', fontSize: '50px' },
            { id: 'sex', x: 80, y: 380, placeholder: 'Sex', fontSize: '50px' },
            { id: 'birth_type', x: 135, y: 380, placeholder: 'Birth Type' },
            { id: 'birth_weight', x: 245, y: 380, placeholder: 'Multiple Child' },
            { id: 'date_birth', x: 405, y: 380, placeholder: 'Birth Date' },
            { id: 'birth_time', x: 499, y: 380, placeholder: 'Time' },
            { id: 'birth_place', x: 80, y: 402, placeholder: 'Facility' },
            { id: 'birth_address', x: 325, y: 402, placeholder: 'Address' },
            { id: 'birth_city', x: 80, y: 423, placeholder: 'City' },
            { id: 'birth_state', x: 325, y: 423, placeholder: 'State' },
            { id: 'mother_name', x: 80, y: 443, placeholder: 'Mother First' },
            { id: 'mother_middle', x: 245, y: 443, placeholder: 'M' },
            { id: 'mother_last', x: 345, y: 443, placeholder: 'Mother Last' },
            { id: 'mother_bop', x: 455, y: 443, placeholder: 'Mother BOP' },
            { id: 'mother_birth', x: 545, y: 443, placeholder: 'DOB', fontSize: '24px' },
            { id: 'father_name', x: 80, y: 462, placeholder: 'Father First' },
            { id: 'father_middle', x: 245, y: 462, placeholder: 'M' },
            { id: 'father_last', x: 345, y: 462, placeholder: 'Father Last' },
            { id: 'father_bop', x: 455, y: 462, placeholder: 'Father BOP' },
            { id: 'father_birth', x: 545, y: 462, placeholder: 'DOB', fontSize: '24px' },
            { id: 'issuer_name', x: 80, y: 483, placeholder: 'Issuer' },
            { id: 'issuer_occupation', x: 245, y: 483, placeholder: 'Occupation' },
            { id: 'issuer_signature', x: 345, y: 483, placeholder: 'Signature', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'registration_date', x: 455, y: 483, placeholder: 'Reg Date' }
        ];
        renderFields(fields);
    } else if (currentCertificateType === 'marriage') {
        const fields = [
            { id: 'marriage_state_file_num', x: 75, y: 229, placeholder: 'SFN', fontStyle: 'bold' },
            { id: 'marriage_local_reg_num', x: 460, y: 229, placeholder: 'LRN', fontStyle: 'bold' },
            { id: 'groom_first', x: 93, y: 328, placeholder: 'Groom First' },
            { id: 'groom_middle', x: 220, y: 328, placeholder: 'M' },
            { id: 'groom_last', x: 348, y: 328, placeholder: 'Groom Last' },
            { id: 'groom_dob', x: 472, y: 328, placeholder: 'DOB' },
            { id: 'groom_address', x: 93, y: 349, placeholder: 'Address' },
            { id: 'groom_city', x: 265, y: 349, placeholder: 'City' },
            { id: 'groom_birthplace', x: 374, y: 349, placeholder: 'Birth State' },
            { id: 'groom_marriages', x: 471, y: 349, placeholder: '#Mar' },
            { id: 'groom_occupation', x: 93, y: 370, placeholder: 'Occupation' },
            { id: 'groom_business', x: 265, y: 370, placeholder: 'Business' },
            { id: 'groom_education', x: 435, y: 370, placeholder: 'Edu' },
            { id: 'groom_parent1', x: 93, y: 390, placeholder: 'Parent1' },
            { id: 'groom_parent1_birthplace', x: 250, y: 390, placeholder: 'Birthplace' },
            { id: 'groom_parent2', x: 330, y: 390, placeholder: 'Parent2' },
            { id: 'groom_parent2_birthplace', x: 483, y: 390, placeholder: 'Birthplace' },
            { id: 'bride_first', x: 93, y: 410, placeholder: 'Bride First' },
            { id: 'bride_middle', x: 220, y: 410, placeholder: 'M' },
            { id: 'bride_last', x: 348, y: 410, placeholder: 'Bride Last' },
            { id: 'bride_dob', x: 472, y: 410, placeholder: 'DOB' },
            { id: 'bride_address', x: 93, y: 430, placeholder: 'Address' },
            { id: 'bride_city', x: 265, y: 430, placeholder: 'City' },
            { id: 'bride_birthplace', x: 374, y: 430, placeholder: 'Birth State' },
            { id: 'bride_marriages', x: 471, y: 430, placeholder: '#Mar' },
            { id: 'bride_occupation', x: 93, y: 450, placeholder: 'Occupation' },
            { id: 'bride_business', x: 265, y: 450, placeholder: 'Business' },
            { id: 'bride_education', x: 435, y: 450, placeholder: 'Edu' },
            { id: 'bride_parent1', x: 93, y: 472, placeholder: 'Parent1' },
            { id: 'bride_parent1_birthplace', x: 250, y: 472, placeholder: 'Birthplace' },
            { id: 'bride_parent2', x: 330, y: 472, placeholder: 'Parent2' },
            { id: 'bride_parent2_birthplace', x: 483, y: 472, placeholder: 'Birthplace' },
            { id: 'groom_signature', x: 98, y: 513, placeholder: 'Groom Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'bride_signature', x: 335, y: 513, placeholder: 'Bride Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'marriage_date', x: 93, y: 533, placeholder: 'Date' },
            { id: 'marriage_place', x: 257, y: 533, placeholder: 'Place' },
            { id: 'marriage_city', x: 408, y: 533, placeholder: 'City' },
            { id: 'marriage_state', x: 487, y: 533, placeholder: 'State' },
            { id: 'officiant_name', x: 93, y: 556, placeholder: 'Officiant' },
            { id: 'officiant_occupation', x: 339, y: 556, placeholder: 'Occ' },
            { id: 'witness1_signature', x: 100, y: 576, placeholder: 'W1 Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'witness1_name', x: 330, y: 576, placeholder: 'W1 Name' },
            { id: 'witness2_signature', x: 100, y: 598, placeholder: 'W2 Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'witness2_name', x: 330, y: 598, placeholder: 'W2 Name' }
        ];
        renderFields(fields);
    } else if (currentCertificateType === 'business') {
        // Landscape coordinates for business permit
        // Center the Business Name text horizontally while keeping other fields normal
        // Other fields remain left-aligned via renderFields
        const fields = [
            // Top metadata (left side of landscape)
            { id: 'date_issued', x: 225, y: 39, placeholder: 'Date Issued', fontSize: '50px' },
            { id: 'date_expiration', x: 240, y: 510, placeholder: 'Date Expiration', fontSize: '70px' },
            { id: 'classification', x: 225, y: 62, placeholder: 'Classification', fontSize: '50px' },
            { id: 'business_id_number', x: 225, y: 85, placeholder: 'Business ID #', fontSize: '50px' },
            // Top metadata (right side of landscape)
            { id: 'permit_number', x: 750, y: 39, placeholder: 'Permit No', fontSize: '50px' },
            { id: 'permit_year', x: 750, y: 62, placeholder: 'Year', fontSize: '50px' },
        ];

        // Draw centered Business Name manually
        (function drawCenteredBusinessName() {
            const field = {
            id: 'business_name',
            placeholder: 'Business Name',
            fontSize: '120px',
            fontStyle: 'bold',
            fontFamily: 'times-new-roman',
            y: 420 // original preview-space y
            };
            const value = document.getElementById(field.id)?.value || field.placeholder;
            const font = `${field.fontStyle ? field.fontStyle + ' ' : ''}${field.fontSize} ${field.fontFamily}`;
            const prevAlign = ctx.textAlign;
            const prevBaseline = ctx.textBaseline;
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const centerX = canvas.width / 2;
            ctx.fillText(value, centerX, field.y * SCALE_Y);
            ctx.textAlign = prevAlign;
            ctx.textBaseline = prevBaseline;
        })();
        renderFields(fields);
    }
}

function renderFields(fields) {
    fields.forEach(f => {
        let value = document.getElementById(f.id)?.value || f.placeholder;
        let font = '';
        if (f.fontStyle) font += f.fontStyle + ' ';
    font += (f.fontSize || '48px') + ' ';
        font += (f.fontFamily || 'times-new-roman');
        ctx.font = font;
        ctx.fillText(value, f.x * SCALE_X, f.y * SCALE_Y);
    });
}

// Limited Edition chance checker (1 in 1 thousand)
function checkLimitedEditionChance() {
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    return randomNumber === 1; // Exactly 1 in 1 million chance
}

// Submit handlers (download only)
birthForm?.addEventListener('submit', e => {
    e.preventDefault();
    drawPreview();
    const first = document.getElementById('name_first').value;
    const last = document.getElementById('name_last').value;
    const name = buildFileName('birth_certificate', [first, last]);
    downloadCanvas(canvas, name);
    showSuccessModal('Birth certificate image downloaded.');
});

marriageForm?.addEventListener('submit', e => {
    e.preventDefault();
    drawPreview();
    const groom = document.getElementById('groom_last').value;
    const bride = document.getElementById('bride_last').value;
    const name = buildFileName('marriage_certificate', [groom, 'and', bride]);
    downloadCanvas(canvas, name);
    showSuccessModal('Marriage certificate image downloaded.');
});

businessForm?.addEventListener('submit', e => {
    e.preventDefault();
    
    // Roll for Limited Edition chance (1 in 10 million)
    const isLE = checkLimitedEditionChance();
    isLimitedEdition = isLE;
    
    drawPreview();
    const business = document.getElementById('business_name').value;
    
    let filename, message;
    if (isLE) {
        filename = buildFileName('business_permit_LIMITED_EDITION', [business]);
        message = '🎉 CONGRATULATIONS! You got the LIMITED EDITION Business Permit! (1 in 1 thousand chance!) 🎉';
    } else {
        filename = buildFileName('business_permit', [business]);
        message = 'Business permit image downloaded.';
    }
    
    downloadCanvas(canvas, filename);
    showSuccessModal(message);
    
    // Reset limited edition flag after download
    setTimeout(() => {
        isLimitedEdition = false;
        drawPreview();
    }, 3000);
});

// Initial draw
drawPreview();
