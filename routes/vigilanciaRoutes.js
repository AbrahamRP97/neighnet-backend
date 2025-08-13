const express = require('express');
const { registrarVisita } = require('../controllers/visitasController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/scan', registrarVisita);

module.exports = router;
