// ================================================================
// EXPORT HELPERS
// ================================================================
function downloadCanvas(canvasEl, filename) {
    const formatSelect = document.getElementById('export-format');
    const format = formatSelect ? formatSelect.value : 'image/png';
    const ext = format.split('/')[1] || 'png';
    
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
    return `${type}_${safeParts.join('_')}.png`;
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

function showLoading() {
    const modal = document.getElementById('loading-modal');
    if (modal) modal.classList.add('show');
}

function hideLoading() {
    const modal = document.getElementById('loading-modal');
    if (modal) modal.classList.remove('show');
}

let generatedCanvas = null;
let quillInstance = null;
let premisesQuill = null;
let propertyQuill = null;
let subpoenaQuill = null;
let chargesQuill = null;

// --------------- Modal Close Handlers ---------------
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-preview-btn')?.addEventListener('click', () => {
        document.getElementById('preview-modal').classList.remove('show');
    });
    document.getElementById('done-button')?.addEventListener('click', () => {
        document.getElementById('success-modal').classList.remove('show');
    });
    document.getElementById('close-error-button')?.addEventListener('click', () => {
        document.getElementById('error-modal').classList.remove('show');
    });
    document.getElementById('cancel-button')?.addEventListener('click', () => {
        document.getElementById('loading-modal').classList.remove('show');
    });

    const quillToolbarOptions = [
        ['bold', 'italic', 'underline'],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'align': [] }]
    ];

    // Initialize Quill Rich Text Editor for DOJ message body
    const container = document.getElementById('editor-container');
    if (container && typeof Quill !== 'undefined') {
        quillInstance = new Quill('#editor-container', {
            theme: 'snow',
            modules: { toolbar: quillToolbarOptions }
        });
        const qlEditor = container.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.fontFamily = "'Times New Roman', Times, serif";
            qlEditor.style.fontSize = "16px";
        }
    }

    // Initialize Quill for Search Warrant Location
    const premisesContainer = document.getElementById('premises-editor-container');
    if (premisesContainer && typeof Quill !== 'undefined') {
        premisesQuill = new Quill('#premises-editor-container', {
            theme: 'snow',
            modules: { toolbar: quillToolbarOptions }
        });
        const qlEditor = premisesContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.fontFamily = "'Times New Roman', Times, serif";
            qlEditor.style.fontSize = "16px";
        }
    }

    // Initialize Quill for Search Warrant Seized Property
    const propertyContainer = document.getElementById('property-editor-container');
    if (propertyContainer && typeof Quill !== 'undefined') {
        propertyQuill = new Quill('#property-editor-container', {
            theme: 'snow',
            modules: { toolbar: quillToolbarOptions }
        });
        const qlEditor = propertyContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.fontFamily = "'Times New Roman', Times, serif";
            qlEditor.style.fontSize = "16px";
        }
    }

    // Initialize Quill for Subpoena Items to Produce
    const subpoenaContainer = document.getElementById('subpoena-editor-container');
    if (subpoenaContainer && typeof Quill !== 'undefined') {
        subpoenaQuill = new Quill('#subpoena-editor-container', {
            theme: 'snow',
            modules: { toolbar: quillToolbarOptions }
        });
        const qlEditor = subpoenaContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.fontFamily = "'Times New Roman', Times, serif";
            qlEditor.style.fontSize = "16px";
        }
    }

    // Initialize Quill for Arrest Warrant Charges Filed
    const chargesContainer = document.getElementById('charges-editor-container');
    if (chargesContainer && typeof Quill !== 'undefined') {
        chargesQuill = new Quill('#charges-editor-container', {
            theme: 'snow',
            modules: { toolbar: quillToolbarOptions }
        });
        const qlEditor = chargesContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.fontFamily = "'Times New Roman', Times, serif";
            qlEditor.style.fontSize = "16px";
        }
    }
});

let currentCertificateType = 'requestforwarrant';
let currentFilename = 'document.png';

document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const section = btn.getAttribute('data-section');
        ['requestforwarrant-section', 'affidavitofcomplaint-section']
            .forEach(id => document.getElementById(id)?.classList.remove('active'));
        const map = {
            requestforwarrant: 'requestforwarrant-section',
            affidavitofcomplaint: 'affidavitofcomplaint-section'
        };
        document.getElementById(map[section])?.classList.add('active');
        currentCertificateType = section;
    });
});

let isRendering = false;

async function performPreview() {
    if (isRendering) return;
    isRendering = true;
    
    // Show modal before rendering so canvas has layout dimensions
    showPreviewModal();

    showLoading();
    try {
        await drawPreviewCore();
    } catch (err) {
        console.error('Render error:', err);
    } finally {
        hideLoading();
        isRendering = false;
    }
}

// Global cache for downloaded PDF templates
const pdfTemplateCache = {};

async function fetchPdfTemplate(url) {
    if (pdfTemplateCache[url]) return pdfTemplateCache[url].slice(0); // Return a copy
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    pdfTemplateCache[url] = arrayBuffer;
    return arrayBuffer;
}

async function renderPdfToCanvas(pdfBuffer) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();

    const activeFormId = `${currentCertificateType}-form`;
    const formEl = document.getElementById(activeFormId);

    if (formEl) {
        const inputs = formEl.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const fieldName = input.id || input.name;
            
            // Skip the DOJ message field so raw HTML is not populated inside the PDF's text field
            if (currentCertificateType === 'dojletter' && fieldName === 'message') {
                return;
            }

            // Skip Search Warrant rich text fields
            if (currentCertificateType === 'searchwarrant' && (fieldName === 'target_premises_vehicle' || fieldName === 'property_to_be_seized')) {
                return;
            }

            // Skip Subpoena rich text fields
            if (currentCertificateType === 'subpoena' && fieldName === 'documents_to_produce') {
                return;
            }

            // Skip Arrest Warrant rich text fields
            if (currentCertificateType === 'arrestwarrant' && fieldName === 'charges_filed') {
                return;
            }

            try {
                const field = form.getField(fieldName);
                if (field) {
                    if (field instanceof window.PDFLib.PDFTextField) {
                        field.setText(input.value);
                    } else if (field instanceof window.PDFLib.PDFDropdown) {
                        field.select(input.value);
                    } else if (field instanceof window.PDFLib.PDFCheckBox) {
                        if (input.checked) field.check();
                        else field.uncheck();
                    }
                }
            } catch (e) {
                // Field doesn't exist in PDF, ignore
            }
        });
    }

    // Embed standard Times New Roman font and update appearances
    // Since we upgraded pdf.js to 3.11.174, it can now safely render flattened documents
    const timesFont = await pdfDoc.embedFont(window.PDFLib.StandardFonts.TimesRoman);
    form.updateFieldAppearances(timesFont);
    form.flatten();
    
    // Generate modified PDF bytes
    const filledPdfBytes = await pdfDoc.save();

    const loadingTask = pdfjsLib.getDocument({ data: filledPdfBytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const targetScale = 2.0;

    // Collect all page objects and calculate overall canvas dimensions
    const pageViewports = [];
    let totalWidth = 0;
    let totalHeight = 0;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: targetScale });
        pageViewports.push({ page, viewport });
        totalWidth = Math.max(totalWidth, viewport.width);
        totalHeight += viewport.height;
    }

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = totalWidth;
    offscreenCanvas.height = totalHeight;
    
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    // Fill background with white
    offscreenCtx.fillStyle = '#ffffff';
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Draw each page vertically
    let currentY = 0;
    for (let i = 0; i < pageViewports.length; i++) {
        const { page, viewport } = pageViewports[i];
        
        // Render page to temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        const tempRenderContext = {
            canvasContext: tempCtx,
            viewport: viewport
        };
        
        await page.render(tempRenderContext).promise;
        
        // Stitch page canvas onto master offscreen canvas
        offscreenCtx.drawImage(tempCanvas, 0, currentY);
        currentY += viewport.height;
    }

    // Helper function to create/get rich text renderer
    function getRichTextContainer(heightPx) {
        let richTextContainer = document.getElementById('rich-text-renderer');
        if (!richTextContainer) {
            richTextContainer = document.createElement('div');
            richTextContainer.id = 'rich-text-renderer';
            richTextContainer.style.position = 'absolute';
            richTextContainer.style.top = '-9999px';
            richTextContainer.style.left = '-9999px';
            richTextContainer.style.width = '1080px'; // 540 pt * 2.0 scale
            richTextContainer.style.boxSizing = 'border-box';
            richTextContainer.style.fontFamily = "'Times New Roman', Times, serif";
            richTextContainer.style.fontSize = '26px'; // 13pt * 2.0
            richTextContainer.style.lineHeight = '1.4';
            richTextContainer.style.color = 'black';
            richTextContainer.style.background = 'transparent';
            richTextContainer.style.textAlign = 'justify';
            richTextContainer.style.wordBreak = 'break-word';
            richTextContainer.style.overflow = 'hidden';
            richTextContainer.style.whiteSpace = 'normal';
            
            const style = document.createElement('style');
            style.innerHTML = `
                #rich-text-renderer .ql-size-small { font-size: 20px !important; }
                #rich-text-renderer .ql-size-large { font-size: 34px !important; }
                #rich-text-renderer .ql-size-huge { font-size: 46px !important; }
                #rich-text-renderer .ql-align-center { text-align: center !important; }
                #rich-text-renderer .ql-align-right { text-align: right !important; }
                #rich-text-renderer .ql-align-justify { text-align: justify !important; }
                #rich-text-renderer p { margin: 0 0 0.75em 0; }
                #rich-text-renderer ul, #rich-text-renderer ol { margin: 0 0 1em 0; padding-left: 2.5em; }
                #rich-text-renderer li { margin-bottom: 0.25em; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(richTextContainer);
        }
        richTextContainer.style.height = heightPx;
        return richTextContainer;
    }

    // Overlay Rich Text Message for DOJ Letter
    if (currentCertificateType === 'dojletter') {
        const messageHtml = document.getElementById('message').value || '';
        const richTextContainer = getRichTextContainer('698px'); // 349 pt * 2.0
        richTextContainer.innerHTML = messageHtml;
        
        const richTextCanvas = await html2canvas(richTextContainer, {
            backgroundColor: null,
            scale: 1,
            logging: false
        });
        
        offscreenCtx.drawImage(richTextCanvas, 72, 992, 1080, 698);
    }

    // Overlay Rich Text Message for Search Warrant
    if (currentCertificateType === 'searchwarrant') {
        const premisesHtml = document.getElementById('target_premises_vehicle').value || '';
        const propertyHtml = document.getElementById('property_to_be_seized').value || '';

        // 1. Render target premises (X=72, Y=1112, W=1080, H=308)
        const premisesContainer = getRichTextContainer('308px'); // 154 pt * 2.0
        premisesContainer.innerHTML = premisesHtml;
        const premisesCanvas = await html2canvas(premisesContainer, {
            backgroundColor: null,
            scale: 1,
            logging: false
        });
        offscreenCtx.drawImage(premisesCanvas, 72, 1112, 1080, 308);

        // 2. Render property to be seized (X=72, Y=1532, W=1080, H=368)
        const propertyContainer = getRichTextContainer('368px'); // 184 pt * 2.0
        propertyContainer.innerHTML = propertyHtml;
        const propertyCanvas = await html2canvas(propertyContainer, {
            backgroundColor: null,
            scale: 1,
            logging: false
        });
        offscreenCtx.drawImage(propertyCanvas, 72, 1532, 1080, 368);
    }

    // Overlay Rich Text Message for Subpoena
    if (currentCertificateType === 'subpoena') {
        const subpoenaHtml = document.getElementById('documents_to_produce').value || '';
        
        // Render Subpoena documents to produce (X=72, Y=1090, W=1080, H=316)
        const subpoenaContainer = getRichTextContainer('316px'); // 158 pt * 2.0
        subpoenaContainer.innerHTML = subpoenaHtml;
        const subpoenaCanvas = await html2canvas(subpoenaContainer, {
            backgroundColor: null,
            scale: 1,
            logging: false
        });
        offscreenCtx.drawImage(subpoenaCanvas, 72, 1090, 1080, 316);
    }

    // Overlay Rich Text Message for Arrest Warrant
    if (currentCertificateType === 'arrestwarrant') {
        const chargesHtml = document.getElementById('charges_filed').value || '';
        
        // Render Arrest Warrant charges filed (X=72, Y=788, W=1080, H=96)
        const chargesContainer = getRichTextContainer('96px'); // 48 pt * 2.0
        chargesContainer.innerHTML = chargesHtml;
        const chargesCanvas = await html2canvas(chargesContainer, {
            backgroundColor: null,
            scale: 1,
            logging: false
        });
        offscreenCtx.drawImage(chargesCanvas, 72, 788, 1080, 96);
    }
    
    generatedCanvas = offscreenCanvas;
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

// --------------- Forms & Section Switching ---------------
const dojletterForm     = document.getElementById('dojletter-form');
const searchwarrantForm = document.getElementById('searchwarrant-form');
const subpoenaForm      = document.getElementById('subpoena-form');
const arrestwarrantForm = document.getElementById('arrestwarrant-form');

// ================================================================
// FORM SUBMIT HANDLERS
// ================================================================
dojletterForm?.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Copy content of Quill editor into the hidden message field
    const messageInput = document.getElementById('message');
    if (quillInstance && messageInput) {
        messageInput.value = quillInstance.root.innerHTML;
    }
    
    await performPreview();
    currentFilename = buildFileName('doj_letter', [document.getElementById('to_name').value]);
});

searchwarrantForm?.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Copy content of Quill editors into hidden fields
    const premisesInput = document.getElementById('target_premises_vehicle');
    const propertyInput = document.getElementById('property_to_be_seized');
    if (premisesQuill && premisesInput) premisesInput.value = premisesQuill.root.innerHTML;
    if (propertyQuill && propertyInput) propertyInput.value = propertyQuill.root.innerHTML;

    await performPreview();
    currentFilename = buildFileName('search_warrant', [document.getElementById('warrant_no').value]);
});

subpoenaForm?.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Copy content of Quill editor into hidden field
    const subpoenaInput = document.getElementById('documents_to_produce');
    if (subpoenaQuill && subpoenaInput) subpoenaInput.value = subpoenaQuill.root.innerHTML;

    await performPreview();
    currentFilename = buildFileName('subpoena', [document.getElementById('case_no').value]);
});

arrestwarrantForm?.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Copy content of Quill editor into hidden field
    const chargesInput = document.getElementById('charges_filed');
    if (chargesQuill && chargesInput) chargesInput.value = chargesQuill.root.innerHTML;

    await performPreview();
    currentFilename = buildFileName('arrest_warrant', [document.getElementById('criminal_case_no').value]);
});

// ================================================================
// EXPORT TOOLBAR BUTTON HANDLERS (Inside Modal)
// ================================================================
document.getElementById('btn-copy-clipboard')?.addEventListener('click', async () => {
    if (generatedCanvas) copyCanvasToClipboard(generatedCanvas);
    else alert('Canvas is not ready. Please try again.');
});

document.getElementById('btn-download-image')?.addEventListener('click', async () => {
    if (generatedCanvas) {
        downloadCanvas(generatedCanvas, currentFilename);
        document.getElementById('preview-modal').classList.remove('show');
    } else {
        alert('Canvas is not ready. Please try again.');
    }
});

// ================================================================
// INTERCEPT MANUAL DOCUMENT GENERATION FORMS (For loading modal support)
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    const manualForms = [
        document.getElementById('requestforwarrant-manual-form'),
        document.getElementById('affidavitofcomplaint-manual-form')
    ].filter(Boolean);

    manualForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Check form validity before proceeding
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            showLoading();

            const loadingMsg = document.getElementById('loading-message');
            const originalMsg = loadingMsg ? loadingMsg.textContent : 'Please wait while we process your request...';
            if (loadingMsg) {
                loadingMsg.textContent = 'Generating document, please wait...';
            }

            try {
                const formData = new FormData(form);
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    let errText = 'Failed to generate document';
                    try {
                        const errJson = await response.json();
                        errText = errJson.error || errText;
                    } catch {}
                    throw new Error(errText);
                }

                const blob = await response.blob();
                const disposition = response.headers.get('content-disposition');
                let filename = 'document.docx';
                if (disposition && disposition.includes('attachment')) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) { 
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                console.error('[Manual Doc Gen] Error:', err);
                alert('Error generating document: ' + err.message);
            } finally {
                hideLoading();
                if (loadingMsg) {
                    loadingMsg.textContent = originalMsg;
                }
            }
        });
    });
});

// Expose performPreview globally for UI triggers
window.drawPreview = performPreview;
