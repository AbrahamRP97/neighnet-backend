const express = require('express');
const { registrarVisita, adjuntarEvidencia, scanSigned } = require('../controllers/visitasController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Autenticación + Rol vigilancia/admin
router.use(authMiddleware);
router.use(requireRole('vigilancia', 'admin'));

// Escaneo de QR: Entrada/Salida con expiración y máximo 2 lecturas
router.post('/scan', registrarVisita);
router.post('/scan-signed', scanSigned);

// Adjuntar evidencia (cedula/placa) a una visita (solo aplica a Entrada)
router.put('/visitas/:id/evidencia', adjuntarEvidencia);

module.exports = router;
