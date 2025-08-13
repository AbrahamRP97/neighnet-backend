const express = require('express');
const { createSignedUrl } = require('../controllers/uploadsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

// Firmar subida (p. ej., a Supabase S3)
router.post('/signed-url', createSignedUrl);

module.exports = router;
