// Admin dashboard routes — account verification, case oversight, analytics
// LSPD / DOJ Case Filing System

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/dashboard — Department-scoped dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/accounts — Pending account verification queue
// ─────────────────────────────────────────────────────────────────────────────
router.get('/accounts', adminController.getAccounts);

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/accounts/:id/approve — Approve a pending account
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accounts/:id/approve', adminController.approveAccount);

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/accounts/:id/reject — Reject a pending account
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accounts/:id/reject', adminController.rejectAccount);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/audit-log — Append-only audit log viewer
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit-log', adminController.getAuditLog);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics — Performance metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics', adminController.getAnalytics);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/export/report — CSV export
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export/report', adminController.getExportReport);

module.exports = router;
