const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const multer = require('multer');
const { getDatabase, ObjectId } = require('../../utils/db');
const GeneratedDocument = require('../../models/GeneratedDocument');
const { getActor, canViewFiling, canReviewFiling } = require('../../utils/accessControl');
const { logActivity } = require('../../middleware/auth');
const { generateDocumentForFiling } = require('../../utils/docGenEngine');

GeneratedDocument.setDB(getDatabase());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function loadAuthorizedDocument(req, res) {
  let docId;
  try {
    docId = new ObjectId(req.params.id);
  } catch {
    res.status(400).json({ error: 'Invalid document identifier' });
    return null;
  }

  const db = getDatabase();
  const doc = await db.collection('generated_documents').findOne({ _id: docId });
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return null;
  }
  const filing = await db.collection('filings').findOne({ filing_number: doc.filing_number });
  if (!canViewFiling(getActor(req), filing)) {
    res.status(403).json({ error: 'You do not have access to this document' });
    return null;
  }
  return { db, doc, filing };
}

async function logDocumentAccess(req, document, action = 'download') {
  const actor = getActor(req);
  await logActivity(new ObjectId(actor.id), action, `${action} document ${document._id} for filing ${document.filing_number}`, 'document', document._id.toString(), req);
}

// POST /api/documents/generate-manual - Generate standalone DOCX document
router.post('/generate-manual', upload.array('evidence_images', 10), async (req, res) => {
  try {
    const actor = getActor(req);
    // Only DA/DOJ or super_admin can generate letters/warrants
    if (actor.department !== 'DA' && actor.department !== 'DOJ' && actor.adminRole !== 'super_admin') {
      return res.status(403).json({ error: 'Manual document generation is restricted to DA users' });
    }
    const PizZip = require('pizzip');
    const Docxtemplater = require('docxtemplater');
    const ImageModule = require('docxtemplater-image-module-free');
    const fs = require('fs');
    const path = require('path');

    const { template, ...data } = req.body;
    let templateName = '';
    if (template === 'requestforwarrant') templateName = 'RequestForWarrantTemplate.docx';
    else if (template === 'affidavitofcomplaint') templateName = 'AffidavitOfComplainteTemplate.docx';
    else return res.status(400).json({ error: 'Invalid template' });

    const templatePath = path.join(__dirname, '../../public/Assets', templateName);
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    const imageOptions = {
      centered: false,
      getImage: function(tagValue) {
        return Buffer.from(tagValue, 'base64');
      },
      getSize: function() {
        return [400, 300];
      }
    };
    const imageModule = new ImageModule(imageOptions);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageModule]
    });

    if (template === 'affidavitofcomplaint') {
      const d = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      data.sworn_day = data.sworn_day || String(d.getDate()).padStart(2, '0');
      data.sworn_month = data.sworn_month || monthNames[d.getMonth()];
      data.sworn_year = data.sworn_year || d.getFullYear().toString();
      data.series_year = data.series_year || d.getFullYear().toString();
    } else if (template === 'requestforwarrant') {
      data.date_approved = data.date_approved || new Date().toDateString();
      data.date_submitted = data.date_submitted || new Date().toDateString();

      if (req.files && req.files.length > 0) {
        data.evidence_images = req.files.map((file, idx) => ({
          image_number: idx + 1,
          image_caption: 'Attached Evidence',
          evidence_image: file.buffer.toString('base64')
        }));
      } else {
        data.evidence_image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        data.evidence_images = [];
      }

      if (data.charges) {
        const chargesList = data.charges.toString().split(',').map(c => c.trim()).filter(Boolean);
        const db = getDatabase();
        const chargesDocs = await db.collection('charges').find({ code: { $in: chargesList.map(c => c.toUpperCase()) } }).toArray();
        const chargesMap = {};
        chargesDocs.forEach(c => {
          chargesMap[c.code] = c.label;
        });
        data.charges = chargesList.map(code => ({
          charge_code: code,
          charge_description: chargesMap[code.toUpperCase()] || code
        }));
      } else {
        data.charges = [];
      }
      data.filing_type = 'Arrest Warrant';
    }

    doc.render(data);
    const buf = doc.getZip().generate({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Generated_${templateName}"`);
    res.send(buf);
  } catch (error) {
    console.error('Manual generation error:', error);
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

// GET /api/documents/:id - Get metadata
router.get('/:id', async (req, res) => {
  try {
    const context = await loadAuthorizedDocument(req, res);
    if (!context) return;
    const { doc } = context;

    res.json({
      id: doc._id,
      filing_number: doc.filing_number,
      version: doc.version,
      page_count: doc.page_count,
      downloads: {
        pdf_url: `/api/documents/${doc._id}/pdf`,
        docx_url: `/api/documents/${doc._id}/docx`,
        zip_url: doc.page_count >= 2 ? `/api/documents/${doc._id}/zip` : null,
        image_urls: Array.from({ length: doc.page_count }, (_, i) => `/api/documents/${doc._id}/pages/${i + 1}`)
      }
    });
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: 'Failed to retrieve metadata' });
  }
});

// GET /api/documents/:id/pdf - Serve PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const context = await loadAuthorizedDocument(req, res);
    if (!context) return;
    const pdfStorageKey = context.doc.pdf_storage_key;
    if (!pdfStorageKey) {
      return res.status(404).send('PDF not available. Please regenerate the document.');
    }

    const { resolveStorageKey } = require('../../utils/fileStorage');
    const filePath = resolveStorageKey(pdfStorageKey);
    if (!filePath || !require('fs').existsSync(filePath)) {
      return res.status(404).send('PDF file not found on server.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document_${req.params.id}.pdf"`);
    await logDocumentAccess(req, context.doc, 'download');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve PDF error:', error);
    res.status(500).send('Error serving PDF');
  }
});

// GET /api/documents/:id/docx - Serve DOCX
router.get('/:id/docx', async (req, res) => {
  try {
    const context = await loadAuthorizedDocument(req, res);
    if (!context) return;
    const base64Str = context.doc.docx_base64;
    if (!base64Str) return res.status(404).send('Not found');

    const buffer = Buffer.from(base64Str, 'base64');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="document_${req.params.id}.docx"`);
    await logDocumentAccess(req, context.doc);
    res.send(buffer);
  } catch (error) {
    console.error('Serve DOCX error:', error);
    res.status(500).send('Error serving DOCX');
  }
});

// GET /api/documents/:id/pages/:pageNumber - Serve PNG page
router.get('/:id/pages/:pageNumber', async (req, res) => {
  try {
    const context = await loadAuthorizedDocument(req, res);
    if (!context) return;
    const pageNumber = parseInt(req.params.pageNumber, 10);
    const pages = context.doc.pages;
    if (!pages || !pages.length) return res.status(404).send('Not found');

    const page = pages.find(p => p.page_number === pageNumber);
    if (!page) return res.status(404).send('Page not found');

    const buffer = Buffer.from(page.png_base64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="document_${req.params.id}_page_${pageNumber}.png"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="page_${pageNumber}.png"`);
    }
    await logDocumentAccess(req, context.doc, 'view');
    res.send(buffer);
  } catch (error) {
    console.error('Serve page error:', error);
    res.status(500).send('Error serving page');
  }
});

// GET /api/documents/:id/zip - Stream ZIP of PNGs and manifest
router.get('/:id/zip', async (req, res) => {
  try {
    const context = await loadAuthorizedDocument(req, res);
    if (!context) return;
    const { doc } = context;
    const pages = doc.pages;
    if (!pages || pages.length < 2) return res.status(400).send('Document does not have multiple pages');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="filing_${doc.filing_number}_images.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const manifest = {
      filing_number: doc.filing_number,
      timestamp: doc.generated_at,
      page_count: doc.page_count,
      pages: []
    };

    pages.forEach(p => {
      const buffer = Buffer.from(p.png_base64, 'base64');
      const filename = `page_${p.page_number}.png`;
      const checksum = require('crypto').createHash('sha256').update(buffer).digest('hex');

      archive.append(buffer, { name: filename });
      manifest.pages.push({ page_number: p.page_number, filename, checksum });
    });

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await logDocumentAccess(req, doc);
    await archive.finalize();
  } catch (error) {
    console.error('ZIP streaming error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error generating ZIP');
    }
  }
});

// POST /api/documents/:id/regenerate - Regenerate by cloning the stored generated record
router.post('/:id/regenerate', async (req, res) => {
  try {
    const context = await loadAuthorizedDocument(req, res);
    if (!context) return;
    const actor = getActor(req);
    if (!canReviewFiling(actor, context.filing)) {
      return res.status(403).json({ error: 'Only the assigned DA reviewer may regenerate this document' });
    }

    const [submitter, reviewer] = await Promise.all([
      context.db.collection('users').findOne({ _id: context.filing.submitted_by }),
      context.filing.da_reviewer ? context.db.collection('users').findOne({ _id: context.filing.da_reviewer }) : null
    ]);
    const regenerated = await generateDocumentForFiling(context.filing, submitter, reviewer);
    await logDocumentAccess(req, regenerated, 'generate');

    res.json({
      success: true,
      message: 'Document regenerated from the current filing data',
      document_id: regenerated._id
    });
  } catch (error) {
    console.error('Regenerate document error:', error);
    res.status(500).json({ error: 'Failed to regenerate document: ' + error.message });
  }
});

module.exports = router;
