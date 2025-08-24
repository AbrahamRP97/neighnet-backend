const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createSignedUrl } = require('../controllers/uploadsController');

const router = express.Router();

// Debe estar autenticado para pedir signed URLs
router.use(authMiddleware);

// POST /api/uploads/signed-url
router.post('/signed-url', createSignedUrl);

module.exports = router;
