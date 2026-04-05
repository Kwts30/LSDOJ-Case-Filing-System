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

// Collapse/Expand functionality for form groups
document.querySelectorAll('.form-group-header').forEach(header => {
    header.addEventListener('click', () => {
        const targetId = header.getAttribute('data-toggle');
        const content = document.getElementById(targetId);
        const icon = header.querySelector('.toggle-icon');
        
        if (content) {
            content.classList.toggle('open');
            if (icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        }
    });
});

// Collapse All / Expand All button functionality
document.querySelectorAll('.collapse-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.closest('.form-section');
        if (!section) return;
        
        const contents = section.querySelectorAll('.form-group-content');
        const icons = section.querySelectorAll('.toggle-icon');
        const isCollapsing = btn.textContent.includes('Collapse');
        
        contents.forEach(content => {
            if (isCollapsing) {
                content.classList.remove('open');
            } else {
                content.classList.add('open');
            }
        });
        
        icons.forEach(icon => {
            if (isCollapsing) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        });
        
        // Toggle button text
        const btnIcon = btn.querySelector('i');
        if (isCollapsing) {
            btn.innerHTML = '<i class="fas fa-expand-alt"></i> Expand All';
        } else {
            btn.innerHTML = '<i class="fas fa-compress-alt"></i> Collapse All';
        }
    });
});

// Mobile sidebar toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarClose = document.getElementById('sidebar-close');

function openSidebar() {
    sidebar?.classList.add('active');
    sidebarOverlay?.classList.add('active');
}

function closeSidebar() {
    sidebar?.classList.remove('active');
    sidebarOverlay?.classList.remove('active');
}

mobileMenuBtn?.addEventListener('click', openSidebar);
sidebarClose?.addEventListener('click', closeSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

// Close sidebar when clicking a nav item (mobile)
document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', closeSidebar);
});

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
const origlandForm = document.getElementById('origland-title-form');
const transferlandForm = document.getElementById('transferland-title-form');
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
const origlandImage = new Image();
origlandImage.src = 'assets/origcert_title.jpg';
const transferlandImage = new Image();
transferlandImage.src = 'assets/transfercert_title.jpg';

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

document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const section = btn.getAttribute('data-section');
        
        // Hide all sections
        document.getElementById('birth-certificate-section')?.classList.remove('active');
        document.getElementById('marriage-certificate-section')?.classList.remove('active');
        document.getElementById('business-permit-section')?.classList.remove('active');
        document.getElementById('origland-title-section')?.classList.remove('active');
        document.getElementById('transferland-title-section')?.classList.remove('active');
        
        // Show selected section
        if (section === 'birth') {
            document.getElementById('birth-certificate-section')?.classList.add('active');
            currentCertificateType = 'birth';
        } else if (section === 'marriage') {
            document.getElementById('marriage-certificate-section')?.classList.add('active');
            currentCertificateType = 'marriage';
        } else if (section === 'business') {
            document.getElementById('business-permit-section')?.classList.add('active');
            currentCertificateType = 'business';
        } else if (section === 'origland') {
            document.getElementById('origland-title-section')?.classList.add('active');
            currentCertificateType = 'origland';
        } else if (section === 'transferland') {
            document.getElementById('transferland-title-section')?.classList.add('active');
            currentCertificateType = 'transferland';
        }
        drawPreview();
    });
});

// Live preview
[birthForm, marriageForm, businessForm, origlandForm, transferlandForm].forEach(f => f?.addEventListener('input', drawPreview));
birthImage.onload = () => drawPreview();
marriageImage.onload = () => drawPreview();
businessImage.onload = () => drawPreview();
businessImageLE.onload = () => drawPreview();
origlandImage.onload = () => drawPreview();
transferlandImage.onload = () => drawPreview();

function drawPreview() {
    // Set canvas to full resolution for high-quality output
    // CSS handles the display size, canvas stays at full template resolution
    if (currentCertificateType === 'business') {
        // Business permit is landscape
        canvas.width = BUSINESS_TEMPLATE_WIDTH;
        canvas.height = BUSINESS_TEMPLATE_HEIGHT;
        // Scale factors based on CSS container size (450x315)
        PREVIEW_WIDTH = 450;
        PREVIEW_HEIGHT = 315;
        SCALE_X = BUSINESS_TEMPLATE_WIDTH / PREVIEW_WIDTH;
        SCALE_Y = BUSINESS_TEMPLATE_HEIGHT / PREVIEW_HEIGHT;
    } else {
        // Portrait certificates
        canvas.width = TEMPLATE_WIDTH;
        canvas.height = TEMPLATE_HEIGHT;
        // Scale factors based on CSS container size (350x495)
        PREVIEW_WIDTH = 350;
        PREVIEW_HEIGHT = 495;
        SCALE_X = TEMPLATE_WIDTH / PREVIEW_WIDTH;
        SCALE_Y = TEMPLATE_HEIGHT / PREVIEW_HEIGHT;
    }
    
    // Let CSS handle container sizing - remove any inline styles
    if (previewContainer) {
        previewContainer.style.width = '';
        previewContainer.style.height = '';
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let template;
    if (currentCertificateType === 'marriage') {
        template = marriageImage;
    } else if (currentCertificateType === 'business') {
        template = isLimitedEdition ? businessImageLE : businessImage;
    } else if (currentCertificateType === 'origland') {
        template = origlandImage;
    } else if (currentCertificateType === 'transferland') {
        template = transferlandImage;
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
        // Portrait coordinates scaled for 350x495 preview (from 600x800)
        const fields = [
            { id: 'state_file_num', x: 44, y: 135, placeholder: 'SFN', fontStyle: 'bold', fontSize: '50px' },
            { id: 'local_reg_num', x: 268, y: 135, placeholder: 'LRN', fontStyle: 'bold', fontSize: '50px' },
            { id: 'name_first', x: 47, y: 223, placeholder: 'First Name of Child', fontSize: '50px' },
            { id: 'name_middle', x: 143, y: 223, placeholder: 'Middle Name', fontSize: '50px' },
            { id: 'name_last', x: 236, y: 223, placeholder: 'Last Name', fontSize: '50px' },
            { id: 'sex', x: 47, y: 235, placeholder: 'Sex', fontSize: '50px' },
            { id: 'birth_type', x: 79, y: 235, placeholder: 'Birth Type' },
            { id: 'birth_weight', x: 143, y: 235, placeholder: 'Multiple Child' },
            { id: 'date_birth', x: 236, y: 235, placeholder: 'Birth Date' },
            { id: 'birth_time', x: 291, y: 235, placeholder: 'Time' },
            { id: 'birth_place', x: 47, y: 249, placeholder: 'Facility' },
            { id: 'birth_address', x: 190, y: 249, placeholder: 'Address' },
            { id: 'birth_city', x: 47, y: 262, placeholder: 'City' },
            { id: 'birth_state', x: 190, y: 262, placeholder: 'State' },
            { id: 'mother_name', x: 47, y: 274, placeholder: 'Mother First' },
            { id: 'mother_middle', x: 143, y: 274, placeholder: 'M' },
            { id: 'mother_last', x: 201, y: 274, placeholder: 'Mother Last' },
            { id: 'mother_bop', x: 265, y: 274, placeholder: 'Mother BOP' },
            { id: 'mother_birth', x: 318, y: 274, placeholder: 'DOB', fontSize: '24px' },
            { id: 'father_name', x: 47, y: 286, placeholder: 'Father First' },
            { id: 'father_middle', x: 143, y: 286, placeholder: 'M' },
            { id: 'father_last', x: 201, y: 286, placeholder: 'Father Last' },
            { id: 'father_bop', x: 265, y: 286, placeholder: 'Father BOP' },
            { id: 'father_birth', x: 318, y: 286, placeholder: 'DOB', fontSize: '24px' },
            { id: 'issuer_name', x: 47, y: 299, placeholder: 'Issuer' },
            { id: 'issuer_occupation', x: 143, y: 299, placeholder: 'Occupation' },
            { id: 'issuer_signature', x: 201, y: 299, placeholder: 'Signature', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'registration_date', x: 265, y: 299, placeholder: 'Reg Date' }
        ];
        renderFields(fields);
    } else if (currentCertificateType === 'marriage') {
        // Portrait coordinates scaled for 350x495 preview (from 600x800)
        const fields = [
            { id: 'marriage_state_file_num', x: 44, y: 142, placeholder: 'SFN', fontStyle: 'bold' },
            { id: 'marriage_local_reg_num', x: 268, y: 142, placeholder: 'LRN', fontStyle: 'bold' },
            { id: 'groom_first', x: 54, y: 203, placeholder: 'Groom First' },
            { id: 'groom_middle', x: 128, y: 203, placeholder: 'M' },
            { id: 'groom_last', x: 203, y: 203, placeholder: 'Groom Last' },
            { id: 'groom_dob', x: 275, y: 203, placeholder: 'DOB' },
            { id: 'groom_address', x: 54, y: 216, placeholder: 'Address' },
            { id: 'groom_city', x: 154, y: 216, placeholder: 'City' },
            { id: 'groom_birthplace', x: 218, y: 216, placeholder: 'Birth State' },
            { id: 'groom_marriages', x: 275, y: 216, placeholder: '#Mar' },
            { id: 'groom_occupation', x: 54, y: 229, placeholder: 'Occupation' },
            { id: 'groom_business', x: 154, y: 229, placeholder: 'Business' },
            { id: 'groom_education', x: 254, y: 229, placeholder: 'Edu' },
            { id: 'groom_parent1', x: 54, y: 241, placeholder: 'Parent1' },
            { id: 'groom_parent1_birthplace', x: 146, y: 241, placeholder: 'Birthplace' },
            { id: 'groom_parent2', x: 192, y: 241, placeholder: 'Parent2' },
            { id: 'groom_parent2_birthplace', x: 282, y: 241, placeholder: 'Birthplace' },
            { id: 'bride_first', x: 54, y: 254, placeholder: 'Bride First' },
            { id: 'bride_middle', x: 128, y: 254, placeholder: 'M' },
            { id: 'bride_last', x: 203, y: 254, placeholder: 'Bride Last' },
            { id: 'bride_dob', x: 275, y: 254, placeholder: 'DOB' },
            { id: 'bride_address', x: 54, y: 266, placeholder: 'Address' },
            { id: 'bride_city', x: 154, y: 266, placeholder: 'City' },
            { id: 'bride_birthplace', x: 218, y: 266, placeholder: 'Birth State' },
            { id: 'bride_marriages', x: 275, y: 266, placeholder: '#Mar' },
            { id: 'bride_occupation', x: 54, y: 278, placeholder: 'Occupation' },
            { id: 'bride_business', x: 154, y: 278, placeholder: 'Business' },
            { id: 'bride_education', x: 254, y: 278, placeholder: 'Edu' },
            { id: 'bride_parent1', x: 54, y: 292, placeholder: 'Parent1' },
            { id: 'bride_parent1_birthplace', x: 146, y: 292, placeholder: 'Birthplace' },
            { id: 'bride_parent2', x: 192, y: 292, placeholder: 'Parent2' },
            { id: 'bride_parent2_birthplace', x: 282, y: 292, placeholder: 'Birthplace' },
            { id: 'groom_signature', x: 57, y: 317, placeholder: 'Groom Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'bride_signature', x: 195, y: 317, placeholder: 'Bride Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'marriage_date', x: 54, y: 330, placeholder: 'Date' },
            { id: 'marriage_place', x: 150, y: 330, placeholder: 'Place' },
            { id: 'marriage_city', x: 238, y: 330, placeholder: 'City' },
            { id: 'marriage_state', x: 284, y: 330, placeholder: 'State' },
            { id: 'officiant_name', x: 54, y: 344, placeholder: 'Officiant' },
            { id: 'officiant_occupation', x: 198, y: 344, placeholder: 'Occ' },
            { id: 'witness1_signature', x: 58, y: 356, placeholder: 'W1 Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'witness1_name', x: 192, y: 356, placeholder: 'W1 Name' },
            { id: 'witness2_signature', x: 58, y: 370, placeholder: 'W2 Sig', fontFamily: 'Segoe Script', fontStyle: 'italic bold' },
            { id: 'witness2_name', x: 192, y: 370, placeholder: 'W2 Name' }
        ];
        renderFields(fields);
    } else if (currentCertificateType === 'business') {
        // Landscape coordinates for business permit (scaled for 450x315 preview)
        // Center the Business Name text horizontally while keeping other fields normal
        // Other fields remain left-aligned via renderFields
        const fields = [
            // Top metadata (left side of landscape)
            { id: 'date_issued', x: 101, y: 18, placeholder: 'Date Issued', fontSize: '50px' },
            { id: 'date_expiration', x: 108, y: 230, placeholder: 'Date Expiration', fontSize: '70px' },
            { id: 'classification', x: 101, y: 28, placeholder: 'Classification', fontSize: '50px' },
            { id: 'business_id_number', x: 101, y: 38, placeholder: 'Business ID #', fontSize: '50px' },
            // Top metadata (right side of landscape)
            { id: 'permit_number', x: 338, y: 18, placeholder: 'Permit No', fontSize: '50px' },
            { id: 'permit_year', x: 338, y: 28, placeholder: 'Year', fontSize: '50px' },
        ];

        // Draw centered Business Name manually
        (function drawCenteredBusinessName() {
            const field = {
            id: 'business_name',
            placeholder: 'Business Name',
            fontSize: '120px',
            fontStyle: 'bold',
            fontFamily: 'times-new-roman',
            y: 189 // scaled preview-space y (420 * 0.45)
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
    } else if (currentCertificateType === 'origland') {
        // Original Land Title fields
        const fields = [
            { id: 'orig_full_name', x: 150, y: 350, placeholder: 'Full Name', fontSize: '48px' },
            { id: 'orig_full_address', x: 150, y: 400, placeholder: 'Full Address', fontSize: '48px' },
            { id: 'orig_land_title_number', x: 150, y: 450, placeholder: 'Land Title Number', fontSize: '48px' },
            { id: 'orig_issue_month', x: 150, y: 500, placeholder: 'Month', fontSize: '48px' },
            { id: 'orig_issue_day', x: 300, y: 500, placeholder: 'Day', fontSize: '48px' },
            { id: 'orig_issue_year', x: 400, y: 500, placeholder: 'Year', fontSize: '48px' }
        ];
        renderFields(fields);
    } else if (currentCertificateType === 'transferland') {
        // Transfer Land Title fields
        const fields = [
            { id: 'trans_full_name', x: 150, y: 350, placeholder: 'Full Name', fontSize: '48px' },
            { id: 'trans_full_address', x: 150, y: 400, placeholder: 'Full Address', fontSize: '48px' },
            { id: 'trans_land_title_number', x: 150, y: 450, placeholder: 'Land Title Number', fontSize: '48px' },
            { id: 'trans_orig_land_title_number', x: 150, y: 500, placeholder: 'Original Title Number', fontSize: '48px' },
            { id: 'trans_issue_month', x: 150, y: 550, placeholder: 'Month', fontSize: '48px' },
            { id: 'trans_issue_day', x: 300, y: 550, placeholder: 'Day', fontSize: '48px' },
            { id: 'trans_issue_year', x: 400, y: 550, placeholder: 'Year', fontSize: '48px' }
        ];
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
    return randomNumber === 1; // Exactly 1 in 1 thousand chance
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
    
    // Roll for Limited Edition chance (1 in 1 thousand)
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

origlandForm?.addEventListener('submit', e => {
    e.preventDefault();
    drawPreview();
    const fullName = document.getElementById('orig_full_name').value;
    const titleNum = document.getElementById('orig_land_title_number').value;
    const name = buildFileName('original_land_title', [fullName, titleNum]);
    downloadCanvas(canvas, name);
    showSuccessModal('Original Land Title image downloaded.');
});

transferlandForm?.addEventListener('submit', e => {
    e.preventDefault();
    drawPreview();
    const fullName = document.getElementById('trans_full_name').value;
    const titleNum = document.getElementById('trans_land_title_number').value;
    const name = buildFileName('transfer_land_title', [fullName, titleNum]);
    downloadCanvas(canvas, name);
    showSuccessModal('Transfer Land Title image downloaded.');
});

// Initial draw
drawPreview();
