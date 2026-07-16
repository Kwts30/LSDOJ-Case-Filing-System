const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');
const GeneratedDocument = require('../models/GeneratedDocument');
const { resolveAttachmentPath } = require('./fileStorage');
const { renderDocxToPdfAndPng } = require('./documentRenderer');

const TEMPLATE_PATHS = {
  warrant_request: path.join(__dirname, '..', 'public', 'Assets', 'RequestForWarrantTemplate.docx'),
  case_filing: path.join(__dirname, '..', 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx')
};

function injectWarrantSignatureTags(docXml) {
  const signatureLine = '_'.repeat(36);
  const escapedLine = signatureLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const paragraphContent = '(?:(?!<\\/w:p>)[\\s\\S])*?';
  const signatureParagraph = new RegExp(
    `<w:p\\b[^>]*>${paragraphContent}<w:t>${escapedLine}<\\/w:t>${paragraphContent}<\\/w:p>`,
    'g'
  );
  let occurrence = 0;
  const rendered = docXml.replace(signatureParagraph, originalParagraph => {
    occurrence += 1;
    // The DOCX template already contains {%officer_signature} and
    // {%doj_signature} immediately above these lines. Remove only the
    // redundant visual placeholders; adding new image tags duplicates signatures.
    return occurrence <= 2 ? '<w:p/>' : originalParagraph;
  });

  if (occurrence < 2) {
    throw new Error('Warrant template must contain officer and DA signature placeholders');
  }
  return rendered;
}

function isSignatureAttachment(att) {
  const category = String(att?.category || '').toLowerCase();
  const originalName = String(att?.original_name || '').toLowerCase();
  return category.includes('signature') || /signature|sig\b/.test(originalName);
}

/**
 * Generate a document from a filing, convert to PDF, extract PNGs, and save to MongoDB
 */
async function generateDocumentForFiling(filing, submitter, reviewer, existingDocId = null) {
  try {
    const templatePath = TEMPLATE_PATHS[filing.filing_type];
    if (!templatePath || !fs.existsSync(templatePath)) {
      throw new Error(`Template not found for filing type: ${filing.filing_type}`);
    }

    // Retrieve attachments from database
    const { getDatabase } = require('./db');
    const db = getDatabase();
    GeneratedDocument.setDB(db);
    const attachments = await db.collection('attachments').find({ filing_number: filing.filing_number }).toArray();
    const chargesDocs = await db.collection('charges').find({ code: { $in: filing.charges || [] } }).toArray();

    // 1. Prepare data mapping
    const data = await mapFilingDataToTemplate(filing, submitter, reviewer, attachments, chargesDocs);

    // 2. Render DOCX using docxtemplater
    const ImageModule = require('docxtemplater-image-module-free');
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Inject signature tags dynamically into word/document.xml in-memory!
    let docXml = zip.file('word/document.xml').asText();
    if (filing.filing_type === 'warrant_request') {
      docXml = injectWarrantSignatureTags(docXml);
    } else if (filing.filing_type === 'case_filing') {
      // Replace all occurrences of 32pt/16pt { in xml with signature tag + br + {
      docXml = docXml.replace(
        /<w:sz w:val="32"\/><w:szCs w:val="32"\/><\/w:rPr><w:t>\{<\/w:t>/g,
        '<w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>{%doj_signature}</w:t></w:r><w:r><w:br/></w:r><w:r><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>{</w:t>'
      );
    }
    zip.file('word/document.xml', docXml);
    
    const imageOptions = {
        centered: false,
        getImage: function(tagValue, tagName) {
            return Buffer.from(tagValue, 'base64');
        },
        getSize: function(img, tagValue, tagName) {
            if (tagName === 'officer_signature' || tagName === 'doj_signature') {
                return [150, 60];
            }
            return [400, 300];
        }
    };
    const imageModule = new ImageModule(imageOptions);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageModule]
    });
    
    doc.render(data);
    let renderedXml = doc.getZip().file('word/document.xml').asText();
    renderedXml = renderedXml.replace(
      /<wp:inline([^>]*?)><wp:extent cx="1428750" cy="571500"\/><wp:effectExtent([^>]*?)\/><wp:docPr([^>]*?)\/>([\s\S]*?)<\/wp:inline>/g,
      '<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="1428750" cy="571500"/><wp:effectExtent$2/><wp:wrapNone/><wp:docPr$3/>$4</wp:anchor>'
    );
    doc.getZip().file('word/document.xml', renderedXml);
    
    const buf = doc.getZip().generate({ type: 'nodebuffer' });

    const docxBase64 = buf.toString('base64');
    let rendered = { rendered: false, reason: null, pdfBase64: null, pages: [] };
    try {
      rendered = await renderDocxToPdfAndPng(buf);
    } catch (renderError) {
      rendered = { rendered: false, reason: renderError.message, pdfBase64: null, pages: [] };
      console.error('Document image rendering skipped:', renderError.message);
    }

    // 5. Save to DB — PDF is stored as base64 in MongoDB (no disk write)
    let genDoc;
    if (existingDocId) {
      await GeneratedDocument.updateDocument(existingDocId, {
        docx_base64: docxBase64,
        pdf_base64: rendered.pdfBase64,
        pages: rendered.pages,
        page_count: rendered.pages.length,
        conversion_status: rendered.rendered ? 'completed' : 'unavailable',
        conversion_error: rendered.reason
      });
      genDoc = { _id: existingDocId, filing_number: filing.filing_number, generated_at: new Date() };
    } else {
      genDoc = await GeneratedDocument.create({
        filing_number: filing.filing_number,
        docx_base64: docxBase64,
        pdf_base64: rendered.pdfBase64,
        pages: rendered.pages,
        page_count: rendered.pages.length,
        conversion_status: rendered.rendered ? 'completed' : 'unavailable',
        conversion_error: rendered.reason
      });
    }

    return genDoc;
  } catch (error) {
    console.error('Document generation error:', error);
    throw error;
  }
}

async function getAttachmentBase64(att) {
  const BLANK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  if (!att) return BLANK_PNG;

  try {
    // New path: file is stored in GridFS
    if (att.gridfs_id) {
      const { getDatabase } = require('./db');
      const { GridFSBucket, ObjectId } = require('mongodb');
      const db = getDatabase();
      const bucket = new GridFSBucket(db, { bucketName: 'attachments' });
      const chunks = [];
      await new Promise((resolve, reject) => {
        const stream = bucket.openDownloadStream(new ObjectId(att.gridfs_id));
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const buffer = Buffer.concat(chunks);
      // Returns raw buffer (no resolution limit)
      return buffer.toString('base64');
    }

    // Legacy path: file is on local disk
    if (!att.file_url) return BLANK_PNG;
    const absPath = resolveAttachmentPath(att);
    if (!absPath || !fs.existsSync(absPath)) return BLANK_PNG;

    return fs.readFileSync(absPath, 'base64');
  } catch (error) {
    console.error('Failed to read attachment:', error);
    return BLANK_PNG;
  }
}

/**
 * Maps the filing model to the exact tags used in the docxtemplater templates
 */
async function mapFilingDataToTemplate(filing, submitter, reviewer, attachments, chargesDocs) {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  
  const chargesMap = {};
  (chargesDocs || []).forEach(c => {
    chargesMap[c.code] = c.label;
  });
  const mappedCharges = (filing.charges || []).map(code => ({
    charge_code: code,
    charge_description: chargesMap[code] || code
  }));

  const submitterName = submitter ? submitter.name : 'Unknown';
  const reviewerName = reviewer ? reviewer.name : 'Pending';

  const imageAttachments = (attachments || []).filter(att =>
    !isSignatureAttachment(att) && (
      att.category === 'image' ||
      att.category === 'evidence_photo' ||
      (att.original_name && /\.(png|jpg|jpeg|gif)$/i.test(att.original_name))
    )
  );

  const mappedImages = [];
  for (let idx = 0; idx < imageAttachments.length; idx++) {
    const att = imageAttachments[idx];
    let base64Data = '';
    if (att.file_buffer) {
      base64Data = att.file_buffer.toString('base64');
    } else {
      base64Data = await getAttachmentBase64(att);
    }
    mappedImages.push({
      image_number: idx + 1,
      image_caption: att.original_name || `Evidence ${idx + 1}`,
      evidence_image: base64Data
    });
  }

  const officerSigAtt = (attachments || []).find(a => a.category === 'officer_signature');
  const daSigAtt = (attachments || []).find(a => a.category === 'da_signature');

  if (filing.filing_type === 'warrant_request') {
    return {
      filing_number: filing.filing_number,
      department: 'LSPD',
      officer_name: submitterName,
      badge_number: submitter ? submitter.badge_number || submitter.username : '',
      date_submitted: filing.created_at ? filing.created_at.toDateString() : '',
      filing_type: 'Arrest Warrant',
      accused_name: filing.accused_name,
      accused_id_number: filing.accused_id_number || 'N/A',
      charges: mappedCharges,
      narrative: filing.narrative,
      '%evidence_image': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 
      evidence_images: mappedImages,
      evidence_links: 'See Attached',
      doj_name: reviewerName,
      doj_position: reviewer ? reviewer.position : '',
      date_approved: d.toDateString(),
      officer_signature: await getAttachmentBase64(officerSigAtt),
      doj_signature: await getAttachmentBase64(daSigAtt)
    };
  } else if (filing.filing_type === 'case_filing') {
    return {
      filing_number: filing.filing_number,
      case_reference: filing.filing_number,
      accused_name: filing.accused_name,
      doj_name: reviewerName,
      doj_postition: reviewer ? reviewer.position : '', // Typo in template
      doj_position: reviewer ? reviewer.position : '',
      affidavit_statement: filing.narrative,
      sworn_day: day,
      sworn_month: month,
      sworn_year: year.toString(),
      notarization_venue: 'Los Santos',
      document_no: '1',
      serial_no: filing.filing_number.split('-').pop() || '1',
      page_no: '1',
      series_year: year.toString(),
      bar_id: reviewer ? reviewer.bar_id || 'N/A' : 'N/A',
      doj_signature: await getAttachmentBase64(daSigAtt)
    };
  }
  return {};
}

module.exports = {
  generateDocumentForFiling,
  injectWarrantSignatureTags
};
