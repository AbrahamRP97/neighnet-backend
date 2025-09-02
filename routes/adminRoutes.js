const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const {
  buscarResidentes,
  crearVisitanteParaResidente,
  listarVisitasAdmin
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('admin')); // SOLO admin

// Buscar residentes para selector (q = texto a buscar)
router.get('/residentes', buscarResidentes);

// Crear visitante asignándolo a un residente específico
router.post('/visitantes', crearVisitanteParaResidente);

// Listado admin de visitas con evidencia (lo usa AdminVisitsScreen)
router.get('/visitas', listarVisitasAdmin);

module.exports = router;
