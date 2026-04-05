// API routes - receive form data and generate certificates

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { CERTIFICATES, FIELD_VALIDATIONS } = require('../config/constants');
const { getDatabase, ObjectId } = require('../utils/db');
const { logActivity } = require('../middleware/auth');

// POST /api/generate - validate and accept form data
router.post('/generate', [
  body('formType').isIn(['birth', 'marriage', 'business', 'origland', 'transferland']),
  body('*').trim().escape().isLength({ max: 500 })
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { formType } = req.body;
    const validation = FIELD_VALIDATIONS[formType];

    if (!validation) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    // Check required fields
    const missingFields = validation.required.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields,
        message: `Please fill in: ${missingFields.join(', ')}`
      });
    }

    // Log document generation
    try {
      const db = getDatabase();
      const documentRecord = {
        doc_type: formType,
        issuer_name: req.body.issuer_name || req.body.issuer_signature || 'Unknown',
        client_name: req.session?.username || 'Unknown',
        user_id: new ObjectId(req.session?.userId),
        form_data: req.body,
        created_at: new Date(),
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('user-agent'),
        file_size: 0
      };

      await db.collection('documents').insertOne(documentRecord);

      // Log activity
      await logActivity(
        new ObjectId(req.session?.userId),
        'generate_document',
        `Generated ${formType} certificate`
      );
    } catch (logError) {
      console.error('Document logging error:', logError);
      // Don't fail the request if logging fails
    }

    // All validations passed - return success
    // Client-side canvas generation handles the actual rendering
    res.json({
      success: true,
      message: 'Form validated successfully',
      formType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'An error occurred during validation' });
  }
});

// GET /api/health - status check
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    availableFormats: Object.keys(CERTIFICATES)
  });
});

module.exports = router;
