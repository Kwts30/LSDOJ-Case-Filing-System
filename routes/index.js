// Main routes — root redirect and dashboard
// LSPD / DOJ Case Filing System

const express = require('express');
const router = express.Router();
const { ADMIN_ROLES, FILING_TYPES, FILING_STATUSES } = require('../config/constants');
const { getDatabase, ObjectId } = require('../utils/db');
const { getActor } = require('../utils/accessControl');

// Root: redirect based on role
router.get('/', (req, res) => {
  // All users go to the personal/department dashboard
  return res.redirect('/dashboard');
});

// GET /dashboard — Filing / review dashboard (available to ALL authenticated users)
// This is the department-level view: LSPD officers see their filings,
// DA reviewers see their review workload. Admin users also have access to
// /admin/dashboard separately for administration tasks.
router.get('/dashboard', async (req, res) => {
  try {
    const db = getDatabase();
    const actor = getActor(req);

    // DOJ non-admin users shouldn't have a personal dashboard, send to all filings
    if (actor.department === 'DOJ') {
      return res.redirect('/filings');
    }

    const userId = new ObjectId(actor.id);
    const filingsCol = db.collection('filings');

    // Personal and Departmental stats structures
    const personalStats = { total: 0, pending: 0, completed: 0, action_needed: 0 };
    const deptStats = { total: 0, pending: 0, completed: 0, action_needed: 0 };
    let recentDocuments = [];
    let documentsByType = [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (actor.department === 'LSPD') {
      // --- LSPD DASHBOARD ---
      // Personal: filings submitted by this user
      const myFilings = await filingsCol.find({ submitted_by: userId }).sort({ updated_at: -1 }).toArray();
      personalStats.total = myFilings.length;
      personalStats.pending = myFilings.filter(f => f.status === 'submitted' || f.status === 'under_review').length;
      personalStats.completed = myFilings.filter(f => f.status === 'filed').length;
      personalStats.action_needed = myFilings.filter(f => f.status === 'draft' || f.status === 'needs_revision').length;

      recentDocuments = myFilings.slice(0, 5);

      // Departmental: all filings (as LSPD is the origin of all filings)
      const allFilings = await filingsCol.find({}).project({ status: 1 }).toArray();
      deptStats.total = allFilings.length;
      deptStats.pending = allFilings.filter(f => f.status === 'submitted' || f.status === 'under_review').length;
      deptStats.completed = allFilings.filter(f => f.status === 'filed').length;
      deptStats.action_needed = allFilings.filter(f => f.status === 'needs_revision').length;

      // Group my filings by type for the pie chart list
      const typeCounts = {};
      myFilings.forEach(f => {
        typeCounts[f.filing_type] = (typeCounts[f.filing_type] || 0) + 1;
      });
      documentsByType = Object.keys(typeCounts).map(type => ({ _id: type, count: typeCounts[type] })).sort((a, b) => b.count - a.count);

    } else if (actor.department === 'DA' || actor.department === 'DOJ') {
      // --- DA / DOJ DASHBOARD ---
      // Personal: filings assigned to this reviewer
      const myReviews = await filingsCol.find({ da_reviewer: userId }).sort({ updated_at: -1 }).toArray();
      personalStats.total = myReviews.length;
      personalStats.pending = myReviews.filter(f => f.status === 'under_review').length;
      personalStats.completed = myReviews.filter(f => f.status === 'filed' || f.status === 'dismissed' || f.status === 'needs_revision').length; // completed a review cycle
      personalStats.action_needed = personalStats.pending; 

      recentDocuments = myReviews.slice(0, 5);

      // Departmental: all filings in review phases
      const allReviews = await filingsCol.find({ status: { $in: ['submitted', 'under_review', 'needs_revision', 'filed', 'dismissed'] } }).project({ status: 1 }).toArray();
      deptStats.total = allReviews.length;
      deptStats.pending = allReviews.filter(f => f.status === 'submitted' || f.status === 'under_review').length;
      deptStats.completed = allReviews.filter(f => f.status === 'filed' || f.status === 'dismissed').length;
      deptStats.action_needed = allReviews.filter(f => f.status === 'submitted').length; // Cases waiting to be claimed

      // Group my reviews by type
      const typeCounts = {};
      myReviews.forEach(f => {
        typeCounts[f.filing_type] = (typeCounts[f.filing_type] || 0) + 1;
      });
      documentsByType = Object.keys(typeCounts).map(type => ({ _id: type, count: typeCounts[type] })).sort((a, b) => b.count - a.count);
    }

    res.render('user-dashboard', {
      title: 'Dashboard',
      currentPage: 'dashboard',
      personalStats,
      deptStats,
      recentDocuments,
      documentsByType,
      FILING_TYPES,
      department: actor.department
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { message: 'Failed to load dashboard' });
  }
});

module.exports = router;
