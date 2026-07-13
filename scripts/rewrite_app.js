const fs = require('fs');

const appJsContent = `
// ================================================================
// EXPORT HELPERS (No Changes)
// ================================================================
function openInNewTab(canvasEl) {
    canvasEl.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const win = window.open();
        if (win) {
            win.document.write('<iframe src="' + url + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
        }
    }, 'image/png');
}

function downloadCanvas(canvasEl, filename) {
    const formatSelect = document.getElementById('export-format');
    const format = formatSelect ? formatSelect.value : 'image/png';
    const ext = format.split('/')[1];
    
    // Adjust filename extension based on format
    const finalFilename = filename.replace(/\.[^/.]+$/, "") + '.' + ext;
    
    const link = document.createElement('a');
    link.download = finalFilename;
    link.href = canvasEl.toDataURL(format, 1.0);
    link.click();
}

async function copyCanvasToClipboard(canvasEl) {
    try {
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showSuccessModal('Image copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard.');
    }
}

function buildFileName(type, nameParts) {
    const safeParts = nameParts.map(p => (p || '').replace(/[^a-zA-Z0-9]/g, '_')).filter(Boolean);
    return \`\${type}_\${safeParts.join('_')}.png\`; // .png is default, downloadCanvas will replace it if another format is chosen
}

function showSuccessModal(msg) {
    const modal = document.getElementById('success-modal');
    const msgEl = document.getElementById('success-message');
    if (modal && msgEl) {
        msgEl.textContent = msg;
        modal.classList.add('show');
        setTimeout(() => modal.classList.remove('show'), 3000);
    } else {
        alert(msg);
    }
}

function showPreviewModal() {
    const modal = document.getElementById('preview-modal');
    if (modal) modal.classList.add('show');
}

// --------------- Canvas & Templates ---------------
const dojletterForm     = document.getElementById('dojletter-form');
const searchwarrantForm = document.getElementById('searchwarrant-form');
const subpoenaForm      = document.getElementById('subpoena-form');
const arrestwarrantForm = document.getElementById('arrestwarrant-form');

const canvas  = document.getElementById('preview-canvas');
const ctx     = canvas.getContext('2d');

const PORTRAIT_W  = 2480;
const PORTRAIT_H  = 3508;

// --------------- Section Switching ---------------
let currentCertificateType = 'dojletter';
let currentFilename = 'document.png';

document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const section = btn.getAttribute('data-section');
        ['dojletter-section', 'searchwarrant-section', 'subpoena-section', 'arrestwarrant-section']
            .forEach(id => document.getElementById(id)?.classList.remove('active'));
        const map = {
            dojletter:     'dojletter-section',
            searchwarrant: 'searchwarrant-section',
            subpoena:      'subpoena-section',
            arrestwarrant: 'arrestwarrant-section'
        };
        document.getElementById(map[section])?.classList.add('active');
        currentCertificateType = section;
    });
});

let isRendering = false;

async function performPreview() {
    if (isRendering) return;
    isRendering = true;
    try {
        await drawPreviewCore();
    } catch (err) {
        console.error('Render error:', err);
    } finally {
        isRendering = false;
    }
}

// Global cache for downloaded PDF templates
const pdfTemplateCache = {};

async function fetchPdfTemplate(url) {
    if (pdfTemplateCache[url]) return pdfTemplateCache[url];
    const res = await fetch(url, { method: 'HEAD' }); 
    if (!res.ok) throw new Error('PDF not found');
    const fullRes = await fetch(url);
    const arrayBuffer = await fullRes.arrayBuffer();
    pdfTemplateCache[url] = arrayBuffer;
    return arrayBuffer;
}

async function renderPdfToCanvas(pdfBuffer) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();

    const activeFormId = {
        dojletter: 'dojletter-form',
        searchwarrant: 'searchwarrant-form',
        subpoena: 'subpoena-form',
        arrestwarrant: 'arrestwarrant-form'
    }[currentCertificateType];

    const formEl = document.getElementById(activeFormId);
    if (formEl) {
        const inputs = formEl.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const fieldName = input.id || input.name;
            try {
                const field = form.getField(fieldName);
                if (field) {
                    if (field.constructor.name === 'PDFTextField') {
                        field.setText(input.value);
                    } else if (field.constructor.name === 'PDFDropdown') {
                        field.select(input.value);
                    } else if (field.constructor.name === 'PDFCheckBox') {
                        if (input.checked) field.check();
                        else field.uncheck();
                    }
                }
            } catch (e) {
                // Field doesn't exist in PDF, ignore
            }
        });
    }

    form.flatten();
    const filledPdfBytes = await pdfDoc.save();

    const loadingTask = pdfjsLib.getDocument({ data: filledPdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const targetWidth = PORTRAIT_W;

    let viewport = page.getViewport({ scale: 1.0 });
    const scale = targetWidth / viewport.width;
    viewport = page.getViewport({ scale: scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = { canvasContext: ctx, viewport: viewport };
    await page.render(renderContext).promise;
}

// ================================================================
// DRAW PREVIEW CORE
// ================================================================
async function drawPreviewCore() {
    let pdfUrl = '';
    switch (currentCertificateType) {
        case 'dojletter':     pdfUrl = '/Assets/doj_letter_fillable.pdf'; break;
        case 'searchwarrant': pdfUrl = '/Assets/search_warrant_fillable.pdf'; break;
        case 'subpoena':      pdfUrl = '/Assets/subpoena_fillable.pdf'; break;
        case 'arrestwarrant': pdfUrl = '/Assets/warrant_of_arrest_fillable.pdf'; break;
    }

    try {
        const pdfBytes = await fetchPdfTemplate(pdfUrl);
        if (pdfBytes) {
            await renderPdfToCanvas(pdfBytes);
        }
    } catch (err) {
        console.error('PDF Template missing or failed to render:', err);
    }
}

// ================================================================
// FORM SUBMIT HANDLERS
// ================================================================
dojletterForm?.addEventListener('submit', async e => {
    e.preventDefault();
    await performPreview();
    currentFilename = buildFileName('doj_letter', [document.getElementById('to_name').value]);
    showPreviewModal();
});

searchwarrantForm?.addEventListener('submit', async e => {
    e.preventDefault();
    await performPreview();
    currentFilename = buildFileName('search_warrant', [document.getElementById('warrant_no').value]);
    showPreviewModal();
});

subpoenaForm?.addEventListener('submit', async e => {
    e.preventDefault();
    await performPreview();
    currentFilename = buildFileName('subpoena', [document.getElementById('case_no').value]);
    showPreviewModal();
});

arrestwarrantForm?.addEventListener('submit', async e => {
    e.preventDefault();
    await performPreview();
    currentFilename = buildFileName('arrest_warrant', [document.getElementById('criminal_case_no').value]);
    showPreviewModal();
});

// ================================================================
// EXPORT TOOLBAR BUTTON HANDLERS (Inside Modal)
// ================================================================
document.getElementById('btn-copy-clipboard')?.addEventListener('click', async () => {
    copyCanvasToClipboard(canvas);
});

document.getElementById('btn-download-image')?.addEventListener('click', async () => {
    downloadCanvas(canvas, currentFilename);
    document.getElementById('preview-modal').classList.remove('show');
});

// Expose performPreview globally for UI triggers
window.drawPreview = performPreview;
`;

fs.writeFileSync('public/js/app.js', appJsContent);
console.log('Successfully wrote app.js');
