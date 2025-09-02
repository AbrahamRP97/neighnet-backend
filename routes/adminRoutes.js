const express = require('express');
const requireRole = require('../middleware/requireRole');
const authMiddleware = require('../middleware/authMiddleware');
const { listVisitsAdmin } = require('../controllers/adminController');

const router = express.Router();

// Autenticado + solo admin
router.use(authMiddleware);
router.use(requireRole('admin'));

// Listado de visitas con filtros y estado de evidencia
router.get('/visitas', listVisitsAdmin);

module.exports = router;
