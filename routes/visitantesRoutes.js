const express = require('express');
const {
  crearVisitante,
  listarVisitantes,
  actualizarVisitante,
  eliminarVisitante
} = require('../controllers/visitantesController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listarVisitantes);

router.post('/', crearVisitante);

router.put('/:id', actualizarVisitante);
router.delete('/:id', eliminarVisitante);

module.exports = router;
