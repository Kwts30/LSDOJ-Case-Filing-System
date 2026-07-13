// Public homepage route
// LSPD / DOJ Case Filing System

const express = require('express');
const router = express.Router();

// GET / - Render public landing page
router.get('/', (req, res, next) => {
  // If user is already logged in, let the next middleware (which redirects to dashboard) handle it
  if (req.session && req.session.userId) {
    return next();
  }
  
  res.render('home', {
    title: 'Department of Justice',
    department: 'DOJ' // Renders the DOJ brown header variant
  });
});

module.exports = router;
