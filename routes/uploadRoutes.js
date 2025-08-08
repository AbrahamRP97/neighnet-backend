const express = require('express');
const { createSignedUrl } = require('../controllers/uploadsController');
/**  para forzar autenticación para pedir URLs firmadas en caso de que se implemente autenticación:
const authMiddleware = require('../middleware/authMiddleware');*/

const router = express.Router();

// POST /api/uploads/signed-url
// router.post('/signed-url', authMiddleware, createSignedUrl);
router.post('/signed-url', createSignedUrl);

module.exports = router;