// Admin dashboard routes - analytics, reports, monitoring

const express = require('express');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');
const { stringify } = require('csv-stringify/sync');

// GET /admin/dashboard - Main dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const db = getDatabase();

    // Get stats
    const totalUsers = await db.collection('users').countDocuments();
    const activeUsers = await db.collection('users').countDocuments({ is_active: true });
    const totalDocuments = await db.collection('documents').countDocuments();
    const totalLogs = await db.collection('audit_logs').countDocuments();

    // Get documents by type
    const documentsByType = await db.collection('documents').aggregate([
      { $group: { _id: '$doc_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get recent documents
    const recentDocuments = await db.collection('documents')
      .find()
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    // Get recent activity
    const recentActivity = await db.collection('audit_logs')
      .find()
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        activeUsers,
        totalDocuments,
        totalLogs
      },
      documentsByType,
      recentDocuments,
      recentActivity,
      user: req.session
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { message: 'Failed to load dashboard' });
  }
});

// GET /admin/documents - List all generated documents
router.get('/documents', async (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const documents = await db.collection('documents')
      .find()
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('documents').countDocuments();
    const pages = Math.ceil(total / limit);

    res.render('admin/documents', {
      title: 'Generated Documents',
      documents,
      page,
      pages,
      total,
      user: req.session
    });
  } catch (error) {
    console.error('Documents list error:', error);
    res.status(500).render('error', { message: 'Failed to load documents' });
  }
});

// GET /admin/reports - Generate reports
router.get('/reports', async (req, res) => {
  try {
    const db = getDatabase();

    // Documents by type
    const docsByType = await db.collection('documents').aggregate([
      { $group: { _id: '$doc_type', count: { $sum: 1 } } }
    ]).toArray();

    // Documents by user
    const docsByUser = await db.collection('documents').aggregate([
      { $group: { _id: '$user_id', count: { $sum: 1 }, client_name: { $first: '$client_name' } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Documents by date (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const docsByDate = await db.collection('documents').aggregate([
      { $match: { created_at: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    res.render('admin/reports', {
      title: 'Reports',
      reports: {
        byType: docsByType,
        byUser: docsByUser,
        byDate: docsByDate
      },
      user: req.session
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).render('error', { message: 'Failed to generate reports' });
  }
});

// GET /admin/activity-logs - View activity logs
router.get('/activity-logs', async (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const logs = await db.collection('activity_logs')
      .find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('activity_logs').countDocuments();
    const pages = Math.ceil(total / limit);

    res.render('admin/activity-logs', {
      title: 'Activity Logs',
      logs,
      page,
      pages,
      total,
      user: req.session
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).render('error', { message: 'Failed to load activity logs' });
  }
});

// GET /admin/analytics - User statistics
router.get('/analytics', async (req, res) => {
  try {
    const db = getDatabase();

    // User activity
    const userActivity = await db.collection('audit_logs').aggregate([
      { $group: { _id: '$user_id', actions: { $sum: 1 } } },
      { $sort: { actions: -1 } }
    ]).toArray();

    // Login activity
    const logins = await db.collection('audit_logs')
      .countDocuments({ action: 'login' });

    // Document generation activity
    const documentCreations = await db.collection('audit_logs')
      .countDocuments({ action: 'generate_document' });

    res.render('admin/analytics', {
      title: 'User Analytics',
      analytics: {
        userActivity,
        logins,
        documentCreations
      },
      user: req.session
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('error', { message: 'Failed to load analytics' });
  }
});

// GET /admin/export/report - Export report as CSV
router.get('/export/report', async (req, res) => {
  try {
    const db = getDatabase();
    const type = req.query.type || 'documents'; // documents, activity, users

    if (type === 'documents') {
      const documents = await db.collection('documents').find().toArray();

      const csv = stringify(documents.map(doc => ({
        Type: doc.doc_type,
        'Issuer Name': doc.issuer_name,
        'Client Name': doc.client_name,
        'Created At': doc.created_at,
        'User ID': doc.user_id
      })), {
        header: true
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="documents-report.csv"');
      res.send(csv);
    } else if (type === 'activity') {
      const logs = await db.collection('audit_logs').find().toArray();

      const csv = stringify(logs.map(log => ({
        'User ID': log.user_id,
        Action: log.action,
        Details: log.details,
        Result: log.result,
        Timestamp: log.timestamp
      })), {
        header: true
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="activity-report.csv"');
      res.send(csv);
    } else if (type === 'users') {
      const users = await db.collection('users').find().toArray();

      const csv = stringify(users.map(user => ({
        Username: user.username,
        Email: user.email,
        Role: user.role,
        Active: user.is_active,
        'Last Login': user.last_login,
        'Created At': user.created_at
      })), {
        header: true
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users-report.csv"');
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Invalid report type' });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

module.exports = router;
