const express = require('express');
const { createSignedUrl } = require('../controllers/uploadsController');
/** Para proteger la ruta con JWT:
const authMiddleware = require('../middleware/authMiddleware');*/

const router = express.Router();

// router.post('/signed-url', authMiddleware, createSignedUrl);
router.post('/signed-url', createSignedUrl);

module.exports = router;
