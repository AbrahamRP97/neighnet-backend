const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createSignedPass } = require('../controllers/passesController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', createSignedPass);

module.exports = router;
