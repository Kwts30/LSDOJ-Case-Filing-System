// API routes — system status and reference data
// LSPD / DOJ Case Filing System

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../utils/db');
const { DEPARTMENTS, POSITIONS, FILING_STATUSES, CHARGE_CATEGORIES } = require('../config/constants');
const { getActor, isSuperAdmin } = require('../utils/accessControl');

// GET /api/status — System status
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    system: 'Department of Justice Case Filing System',
    timestamp: new Date().toISOString()
  });
});

// GET /api/charges — List all charge codes (for dynamic form population)
router.get('/charges', async (req, res) => {
  try {
    const db = getDatabase();
    const category = req.query.category || null;
    const filter = category ? { category } : {};
    const charges = await db.collection('charges').find(filter).sort({ code: 1 }).toArray();
    res.json({ charges });
  } catch (error) {
    console.error('Charges API error:', error);
    res.status(500).json({ error: 'Failed to load charges' });
  }
});

// GET /api/departments — List departments
router.get('/departments', async (req, res) => {
  try {
    const db = getDatabase();
    const departments = await db.collection('departments').find().sort({ code: 1 }).toArray();
    res.json({ departments });
  } catch (error) {
    res.json({ departments: DEPARTMENTS.map(d => ({ code: d })) });
  }
});

// GET /api/positions — List positions for a department
router.get('/positions/:department', (req, res) => {
  const dept = req.params.department.toUpperCase();
  const positions = POSITIONS[dept] || [];
  res.json({ department: dept, positions });
});

// GET /api/filing-stats — Filing statistics (for dashboard widgets)
router.get('/filing-stats', async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.department !== 'DA' && !isSuperAdmin(actor)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const db = getDatabase();
    const stats = await db.collection('filings').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    res.json({ stats });
  } catch (error) {
    console.error('Filing stats API error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Mount documents API
router.use('/documents', require('./api/documents'));

module.exports = router;
