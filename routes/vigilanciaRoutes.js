const express = require('express');
const { registrarVisita } = require('../controllers/visitasController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Autenticación + Rol vigilancia/admin
router.use(authMiddleware);
router.use(requireRole('vigilancia', 'admin'));

// Escaneo de QR: Entrada/Salida con expiración y máximo 2 lecturas
router.post('/scan', registrarVisita);

module.exports = router;
