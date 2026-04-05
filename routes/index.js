// Main routes - renders the form and templates

const express = require('express');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');

router.get('/', (req, res) => {
  if (req.session?.userRole === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  return res.redirect('/dashboard');
});

// User dashboard with per-user document stats
router.get('/dashboard', async (req, res) => {
  try {
    const db = getDatabase();
    const userId = new ObjectId(req.session.userId);

    const filter = { $or: [{ user_id: userId }, { userId: userId }] };

    const totalDocuments = await db.collection('documents').countDocuments(filter);
    const documentsByType = await db.collection('documents').aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ['$doc_type', '$documentType'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    const recentDocuments = await db.collection('documents')
      .find(filter)
      .sort({ created_at: -1, createdAt: -1 })
      .limit(10)
      .toArray();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const documentsToday = await db.collection('documents').countDocuments({
      ...filter,
      $or: [
        { created_at: { $gte: todayStart } },
        { createdAt: { $gte: todayStart } }
      ]
    });

    res.render('user-dashboard', {
      title: 'My Dashboard - DOJ System',
      currentPage: 'dashboard',
      stats: {
        totalDocuments,
        documentsToday,
        documentTypes: documentsByType.length
      },
      documentsByType,
      recentDocuments
    });
  } catch (error) {
    console.error('User dashboard error:', error);
    res.status(500).render('error', { message: 'Failed to load dashboard' });
  }
});

// Create document page (no dashboard stats)
router.get('/create-document', (req, res) => {
  res.render('index', {
    title: 'Create Document - DOJ System',
    version: '2.0.0',
    currentPage: 'create-document'
  });
});

module.exports = router;
