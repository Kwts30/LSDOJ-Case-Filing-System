// Main routes - renders the form and templates

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'DOJ Auto-Fillup System',
    version: '2.0.0'
  });
});

module.exports = router;
