// Discord Digest manual trigger routes
// LSPD / DOJ Case Filing System
// For admin testing of Discord webhooks

const express = require('express');
const router = express.Router();
const { generateCaseDigest, generateAccountDigest } = require('../utils/discordDigest');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/digest/cases — Trigger case digest
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cases', async (req, res) => {
  try {
    await generateCaseDigest();
    res.json({ success: true, message: 'Case digest triggered' });
  } catch (error) {
    console.error('Manual digest error:', error);
    res.status(500).json({ error: 'Failed to trigger case digest' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/digest/accounts — Trigger accounts digest
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accounts', async (req, res) => {
  try {
    await generateAccountDigest();
    res.json({ success: true, message: 'Account digest triggered' });
  } catch (error) {
    console.error('Manual digest error:', error);
    res.status(500).json({ error: 'Failed to trigger account digest' });
  }
});

module.exports = router;
