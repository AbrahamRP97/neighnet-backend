const express = require('express');
const { registrarVisita } = require('../controllers/vigilanciaController');

const router = express.Router();

router.post('/scan', registrarVisita);

module.exports = router;
