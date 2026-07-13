// Main Express server entry point
// LSPD / DA Filing System
// Run with: npm start

require('dotenv').config();

const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const { helmetConfig, errorHandler } = require('./middleware/security');
const { initializeDatabase } = require('./utils/db');
const { createSessionStore } = require('./utils/mongoSessionStore');
const { csrfProtection } = require('./middleware/csrf');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { sessionSecret, validateProductionConfiguration } = require('./config/runtime');
const { initializeAdmin } = require('./utils/initAdmin');
const { authenticateUser, requireRole, requireDepartment, requireAdminRole, setUserContext } = require('./middleware/auth');
const { ADMIN_ROLES } = require('./config/constants');
const cron = require('node-cron');
const { generateCaseDigest, generateAccountDigest } = require('./utils/discordDigest');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
  let db;
  try {
    validateProductionConfiguration();
    // ===== Initialize Database =====
    db = await initializeDatabase(MONGODB_URI);
    
    console.log('  Database initialized');

    // Initialize admin account and seed reference data
    await initializeAdmin();
    console.log('  Admin and reference data initialized');

  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }

  // ===== Middleware Setup =====

  // Security headers
  app.use(helmetConfig);

  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
  }

  // Compression
  app.use(compression());

  // Logging
  app.use(morgan('combined'));

  // Static files
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/Assets', express.static(path.join(__dirname, 'public', 'Assets')));

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // Sessions
  app.use(session({
    name: process.env.SESSION_COOKIE_NAME || 'filing.sid',
    secret: sessionSecret,
    store: createSessionStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.SESSION_SAME_SITE || 'lax',
      maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10)
    }
  }));

  app.use(rateLimitMiddleware);
  app.use(csrfProtection);

  // Template engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // User context for EJS templates
  app.use(setUserContext);

  // ===== Routes =====

  // Public routes (no authentication)
  app.use('/auth', require('./routes/auth'));
  app.use('/health', require('./routes/health'));

  // Protected files are served only after filing-level authorization.
  app.use('/files', authenticateUser, require('./routes/files'));

  // Public: homepage
  app.use('/', require('./routes/public'));

  // Protected: root redirect and dashboard
  app.use('/', authenticateUser, require('./routes/index'));

  // Protected: LSPD filing (any authenticated user can view, but filing is LSPD)
  app.use('/filings', authenticateUser, require('./routes/filings'));

  // Protected: DA review queue (DA department only)
  app.use('/da-review', authenticateUser, requireDepartment('DA'), require('./routes/da_review'));

  // Protected: API routes
  app.use('/api', authenticateUser, require('./routes/api'));

  // Admin routes (department_admin or super_admin)
  app.use('/admin',
    authenticateUser,
    requireAdminRole(ADMIN_ROLES.DEPARTMENT_ADMIN, ADMIN_ROLES.SUPER_ADMIN),
    require('./routes/admin')
  );
  app.use('/admin/users',
    authenticateUser,
    requireAdminRole(ADMIN_ROLES.DEPARTMENT_ADMIN, ADMIN_ROLES.SUPER_ADMIN),
    require('./routes/users')
  );

  // Protected: Manual discord digest routes (super admin only)
  app.use('/api/digest',
    authenticateUser,
    requireAdminRole(ADMIN_ROLES.SUPER_ADMIN),
    require('./routes/digest')
  );

  // 404 handler
  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found' });
  });

  // Global error handler
  app.use(errorHandler);

  // ===== Start Server =====
  app.listen(PORT, () => {
    console.log(`\n  Department of Justice Case Filing System v3.0.0`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  http://localhost:${PORT}\n`);
  });

  // ===== Scheduled Jobs =====
  const cronOptions = process.env.CRON_TIMEZONE ? { timezone: process.env.CRON_TIMEZONE } : undefined;

  // Case Digest: Run every day at 18:00 (6 PM)
  cron.schedule('0 18 * * *', () => {
    console.log('Running scheduled Case Digest...');
    generateCaseDigest();
  }, cronOptions);

  // Account Digest: Run every hour during the day (8 AM - 8 PM)
  cron.schedule('0 8-20 * * *', () => {
    console.log('Running scheduled Account Digest...');
    generateAccountDigest();
  }, cronOptions);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nServer shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nServer shutting down...');
  process.exit(0);
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
