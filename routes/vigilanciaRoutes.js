const express = require('express');
const { registrarVisita } = require('../controllers/visitasController');

const router = express.Router();

router.post('/scan', registrarVisita);

module.exports = router;
