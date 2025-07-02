const express = require('express');
const {
  crearVisitante,
  listarVisitantes,
  actualizarVisitante,
  eliminarVisitante
} = require('../controllers/visitantesController');

const router = express.Router();

router.post('/', crearVisitante);
router.get('/:residente_id', listarVisitantes);
router.put('/:id', actualizarVisitante);
router.delete('/:id', eliminarVisitante);

module.exports = router;