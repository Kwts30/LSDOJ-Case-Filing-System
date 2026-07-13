const { getDatabase, ObjectId } = require('../utils/db');
const { logActivity } = require('../middleware/auth');
const { stringify } = require('csv-stringify/sync');
const { ADMIN_ROLES, ESCALATION_THRESHOLD_HOURS, STATUS_DISPLAY, ACCOUNT_STATUS_DISPLAY } = require('../config/constants');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safe DB operations
// ─────────────────────────────────────────────────────────────────────────────
function safeCount(db, collName, query = {}) {
  try { return db.collection(collName).countDocuments(query); }
  catch { return Promise.resolve(0); }
}

async function safeAggregate(db, collName, pipeline) {
  try { return await db.collection(collName).aggregate(pipeline).toArray(); }
  catch { return []; }
}

function isSuperAdminRequest(req) {
  return req.session?.admin_role === ADMIN_ROLES.SUPER_ADMIN;
}

function requireSuperAdmin(req, res) {
  if (isSuperAdminRequest(req)) return true;
  res.status(403).render('error', { message: 'Super administrator access is required' });
  return false;
}

exports.getDashboard = async (req, res) => {
  try {
    const db = getDatabase();
    const adminRole = req.session.admin_role;
    const adminDept = req.session.department;
    const isSuperAdmin = adminRole === ADMIN_ROLES.SUPER_ADMIN;
    let filingScope = {};
    let auditScope = {};
    if (!isSuperAdmin && adminDept === 'LSPD') {
      const departmentUsers = await db.collection('users').find({ department: adminDept }, { projection: { _id: 1 } }).toArray();
      const userIds = departmentUsers.map(user => user._id);
      filingScope = { submitted_by: { $in: userIds } };
      auditScope = { actor: { $in: userIds } };
    }

    // ── Pending account signups ──
    const pendingFilter = { account_status: 'pending' };
    if (!isSuperAdmin) {
      pendingFilter.department = adminDept;
    }
    const allPendingAccounts = await db.collection('users')
      .find(pendingFilter)
      .sort({ created_at: 1 })
      .toArray();

    // ── Pending case reviews (DA admin / super admin only) ──
    let pendingCases = [];
    if (isSuperAdmin || adminDept === 'DA') {
      pendingCases = await db.collection('filings')
        .find({ status: { $in: ['submitted', 'under_review'] } })
        .sort({ created_at: 1 })
        .toArray();
    }

    // ── Escalated items ──
    const cutoff = new Date(Date.now() - ESCALATION_THRESHOLD_HOURS * 60 * 60 * 1000);
    const escalatedCases = pendingCases.filter(c => c.updated_at < cutoff || c.created_at < cutoff);

    // ── Stats ──
    const [totalUsers, totalCases, caseStatusCounts, recentActivity] = await Promise.all([
      safeCount(db, 'users', isSuperAdmin ? {} : { department: adminDept }),
      safeCount(db, 'filings', filingScope),
      safeAggregate(db, 'filings', [
        { $match: filingScope },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      db.collection('audit_logs')
        .find(auditScope)
        .sort({ timestamp: -1 })
        .limit(15)
        .toArray()
    ]);

    // Resolve actor names for recent activity
    const actorIds = [...new Set(recentActivity.map(a => a.actor.toString()))];
    const actors = await db.collection('users')
      .find({ _id: { $in: actorIds.map(id => new ObjectId(id)) } })
      .toArray();
    const actorMap = {};
    actors.forEach(a => { actorMap[a._id.toString()] = a; });

    // Resolve submitter names for pending cases
    const submitterIds = [...new Set(pendingCases.map(c => c.submitted_by.toString()))];
    const submitters = await db.collection('users')
      .find({ _id: { $in: submitterIds.map(id => new ObjectId(id)) } })
      .toArray();
    const submitterMap = {};
    submitters.forEach(s => { submitterMap[s._id.toString()] = s; });

    // Average turnaround
    const recentFiled = await db.collection('filings')
      .find({ ...filingScope, status: { $in: ['filed', 'dismissed'] } })
      .sort({ updated_at: -1 })
      .limit(20)
      .toArray();
    let avgTurnaround = 0;
    if (recentFiled.length > 0) {
      const totalMs = recentFiled.reduce((sum, c) => sum + (c.updated_at.getTime() - (c.attested_at || c.created_at).getTime()), 0);
      avgTurnaround = Math.round(totalMs / recentFiled.length / (1000 * 60 * 60));
    }

    // Oldest pending
    const allPending = [...allPendingAccounts, ...pendingCases];
    let oldestPending = null;
    if (allPending.length > 0) {
      allPending.sort((a, b) => (a.created_at || a.createdAt) - (b.created_at || b.createdAt));
      const oldest = allPending[0];
      const ageHours = Math.round((Date.now() - oldest.created_at.getTime()) / (1000 * 60 * 60));
      oldestPending = { item: oldest, ageHours };
    }

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Department of Justice Case Filing System',
      currentPage: 'admin-dashboard',
      pendingLSPD: allPendingAccounts,
      pendingDOJ: [], // Maintain variable name compatibility in dashboard.ejs
      pendingCases,
      escalatedCases,
      recentActivity,
      actorMap,
      submitterMap,
      stats: {
        totalUsers,
        totalCases,
        pendingAccounts: allPendingAccounts.length,
        pendingReviews: pendingCases.length,
        escalatedCount: escalatedCases.length,
        avgTurnaroundHours: avgTurnaround,
        oldestPending
      },
      caseStatusCounts,
      isSuperAdmin,
      adminDept,
      STATUS_DISPLAY,
      ACCOUNT_STATUS_DISPLAY
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { message: 'Failed to load dashboard' });
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const db = getDatabase();
    const isSuperAdmin = req.session.admin_role === ADMIN_ROLES.SUPER_ADMIN;
    const adminDept = req.session.department;

    const filter = { account_status: 'pending' };
    if (!isSuperAdmin) {
      filter.department = adminDept;
    }

    const pending = await db.collection('users')
      .find(filter)
      .sort({ created_at: 1 })
      .toArray();

    res.render('admin/verification-queue', {
      title: 'Account Verification - Admin',
      currentPage: 'admin-accounts',
      pending,
      isSuperAdmin,
      adminDept,
      ACCOUNT_STATUS_DISPLAY
    });
  } catch (error) {
    console.error('Verification queue error:', error);
    res.status(500).render('error', { message: 'Failed to load verification queue' });
  }
};

exports.approveAccount = async (req, res) => {
  try {
    const db = getDatabase();
    const targetUser = await db.collection('users').findOne({
      _id: new ObjectId(req.params.id),
      account_status: 'pending'
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Pending account not found' });
    }

    // Department admin can only approve their own department
    const isSuperAdmin = req.session.admin_role === ADMIN_ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && targetUser.department !== req.session.department) {
      return res.status(403).json({ error: 'You can only approve accounts in your department' });
    }

    await db.collection('users').updateOne(
      { _id: targetUser._id },
      {
        $set: {
          account_status: 'active',
          verified_by: new ObjectId(req.session.userId),
          rejection_reason: null
        },
        $currentDate: { updated_at: true }
      }
    );

    await logActivity(
      new ObjectId(req.session.userId), 'approve',
      `Approved account for ${targetUser.username} (${targetUser.department} - ${targetUser.position})`,
      'account', targetUser._id.toString(), req
    );

    res.json({ success: true, message: `Account ${targetUser.username} approved` });
  } catch (error) {
    console.error('Account approval error:', error);
    res.status(500).json({ error: 'Failed to approve account' });
  }
};

exports.rejectAccount = async (req, res) => {
  try {
    const db = getDatabase();
    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const targetUser = await db.collection('users').findOne({
      _id: new ObjectId(req.params.id),
      account_status: 'pending'
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Pending account not found' });
    }

    const isSuperAdmin = req.session.admin_role === ADMIN_ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && targetUser.department !== req.session.department) {
      return res.status(403).json({ error: 'You can only reject accounts in your department' });
    }

    // Mark account as rejected instead of deleting it
    await db.collection('users').updateOne(
      { _id: targetUser._id },
      {
        $set: {
          account_status: 'rejected',
          rejection_reason: rejection_reason,
          verified_by: new ObjectId(req.session.userId)
        },
        $currentDate: { updated_at: true }
      }
    );

    await logActivity(
      new ObjectId(req.session.userId), 'deny',
      `Rejected account for ${targetUser.username}: ${rejection_reason}`,
      'account', targetUser._id.toString(), req
    );

    res.json({ success: true, message: `Account ${targetUser.username} rejected` });
  } catch (error) {
    console.error('Account rejection error:', error);
    res.status(500).json({ error: 'Failed to reject account' });
  }
};

exports.getAuditLog = async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const db = getDatabase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.target_type) filter.target_type = req.query.target_type;

    const [total, logs] = await Promise.all([
      safeCount(db, 'audit_logs', filter),
      db.collection('audit_logs')
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
    ]);

    // Resolve actor names
    const actorIds = [...new Set(logs.map(l => l.actor.toString()))];
    const actors = await db.collection('users')
      .find({ _id: { $in: actorIds.map(id => new ObjectId(id)) } })
      .toArray();
    const actorMap = {};
    actors.forEach(a => { actorMap[a._id.toString()] = a; });

    res.render('admin/activity-logs', {
      title: 'Audit Log - Admin',
      currentPage: 'admin-logs',
      logs,
      actorMap,
      page,
      pages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).render('error', { message: 'Failed to load audit log' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const db = getDatabase();

    const [
      casesByStatus,
      casesByOfficer,
      reviewsByReviewer,
      totalCases,
      totalUsers,
      activeUsers,
      recentLogins
    ] = await Promise.all([
      safeAggregate(db, 'filings', [
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      safeAggregate(db, 'filings', [
        { $group: { _id: '$submitted_by', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      safeAggregate(db, 'filings', [
        { $match: { da_reviewer: { $ne: null } } },
        { $group: { _id: '$da_reviewer', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      safeCount(db, 'filings'),
      safeCount(db, 'users'),
      safeCount(db, 'users', { account_status: 'active' }),
      safeCount(db, 'audit_logs', { action: 'login' })
    ]);

    // Resolve user names for officer/reviewer stats
    const allUserIds = [
      ...casesByOfficer.map(c => c._id),
      ...reviewsByReviewer.map(r => r._id)
    ].filter(Boolean);

    const userDocs = await db.collection('users')
      .find({ _id: { $in: allUserIds.map(id => new ObjectId(id)) } })
      .toArray();
    const userMap = {};
    userDocs.forEach(u => { userMap[u._id.toString()] = u; });

    res.render('admin/analytics', {
      title: 'Analytics - Admin',
      currentPage: 'admin-analytics',
      casesByStatus,
      casesByOfficer,
      reviewsByReviewer,
      userMap,
      stats: { totalCases, totalUsers, activeUsers, recentLogins },
      STATUS_DISPLAY
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('error', { message: 'Failed to load analytics' });
  }
};

exports.getExportReport = async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const db = getDatabase();
    const type = req.query.type || 'cases';
    let csvData, filename;

    if (type === 'cases' || type === 'filings') {
      const filings = await db.collection('filings').find().sort({ created_at: -1 }).toArray();
      csvData = stringify(filings.map(f => ({
        'Filing Number': f.filing_number,
        'Status': f.status,
        'Accused Name': f.accused_name,
        'Charges': (f.charges || []).join(', '),
        'Created': f.created_at ? new Date(f.created_at).toLocaleString() : '',
        'Updated': f.updated_at ? new Date(f.updated_at).toLocaleString() : ''
      })), { header: true });
      filename = 'filings-report.csv';

    } else if (type === 'users') {
      const users = await db.collection('users').find().sort({ created_at: -1 }).toArray();
      csvData = stringify(users.map(u => ({
        'Username': u.username,
        'Name': u.name,
        'Department': u.department,
        'Position': u.position,
        'Status': u.account_status,
        'Admin Role': u.admin_role,
        'Last Login': u.last_login ? new Date(u.last_login).toLocaleString() : 'Never',
        'Created': u.created_at ? new Date(u.created_at).toLocaleString() : ''
      })), { header: true });
      filename = 'users-report.csv';

    } else if (type === 'audit') {
      const logs = await db.collection('audit_logs').find().sort({ timestamp: -1 }).limit(5000).toArray();
      csvData = stringify(logs.map(l => ({
        'Actor': l.actor?.toString() || '',
        'Action': l.action,
        'Target Type': l.target_type,
        'Target ID': l.target_id || '',
        'Details': l.details,
        'Timestamp': l.timestamp ? new Date(l.timestamp).toLocaleString() : ''
      })), { header: true });
      filename = 'audit-report.csv';

    } else {
      return res.status(400).json({ error: 'Invalid report type. Use: filings, users, audit' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};
