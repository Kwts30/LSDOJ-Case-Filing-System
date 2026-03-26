// Main Express server entry point
// Run with: npm start

require('dotenv').config();

const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const { helmetConfig, errorHandler } = require('./middleware/security');
const { rateLimitMiddleware, initializeDb } = require('./middleware/rateLimit');
const { initializeDatabase } = require('./utils/db');
const { initializeAdmin } = require('./utils/initAdmin');
const { authenticateUser, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doj-auto-fillup';

// ===== Initialize Database =====
let dbInitialized = false;

async function startServer() {
  try {
    // Initialize new database system (users, documents, logs)
    await initializeDatabase(MONGODB_URI);
    console.log('✓ Database initialized for authentication system');

    // Initialize admin account if first run
    await initializeAdmin();

    // Initialize rate limiting database
    await initializeDb(MONGODB_URI);
    dbInitialized = true;
    console.log('✓ MongoDB connected for rate limiting');
  } catch (error) {
    console.warn('⚠ MongoDB not available, rate limiting will be skipped:', error.message);
  }

  // ===== Middleware Setup =====

  // Security headers
  app.use(helmetConfig);

  // Compression
  app.use(compression());

  // Logging
  app.use(morgan('combined'));

  // Static files - serve assets without rate limiting
  app.use(express.static(path.join(__dirname, 'public')));

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // Sessions
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 60 * 1000 // 1 hour
    }
  }));

  // Template engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // ===== User Context for EJS =====
  const { setUserContext } = require('./middleware/auth');
  app.use(setUserContext);

  // ===== Rate Limiting Middleware =====
  app.use(rateLimitMiddleware);

  // ===== Routes =====

  // Auth routes (public - no authentication needed)
  app.use('/auth', require('./routes/auth'));

  // Health check (public)
  app.use('/health', require('./routes/health'));

  // Protected routes - require authentication
  app.use('/', authenticateUser, require('./routes/index'));
  app.use('/api', authenticateUser, require('./routes/api'));

  // Admin routes - require authentication + admin role
  app.use('/admin', authenticateUser, requireRole('admin'), require('./routes/admin'));
  app.use('/admin/users', authenticateUser, requireRole('admin'), require('./routes/users'));

  // 404 handler
  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found' });
  });

  // Global error handler
  app.use(errorHandler);

  // ===== Start Server =====
  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   DOJ Auto-Fillup System v2.0.0       ║`);
    console.log(`║   🔐 Authentication: Enabled           ║`);
    console.log(`║   🚀 Server running on port ${PORT}    ║`);
    console.log(`║   📊 Rate Limit: 50 requests/hour      ║`);
    console.log(`║   🗄️  MongoDB: ${dbInitialized ? 'Connected' : 'Offline'}         ║`);
    console.log(`║   🔗 http://localhost:${PORT}           ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n✓ Server shutting down...');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
