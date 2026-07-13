// User management routes — admin only
// LSPD / DOJ Case Filing System

const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users — List all users
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', usersController.getUsers);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users/:id — View/edit user details
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', usersController.getUser);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /admin/users/:id — Update user
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', usersController.updateUser);

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users — Create new user (admin-created, active immediately)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', usersController.createUser);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/users/:id — Deactivate user (set status to rejected)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', usersController.deactivateUser);

module.exports = router;
