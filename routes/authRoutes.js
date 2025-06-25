const express = require('express');
const { registrarUsuario, loginUsuario, actualizarUsuario, obtenerUsuario, eliminarUsuario } = require('../controllers/authController');
const { log } = require('console');

const router = express.Router();

router.post('/register', registrarUsuario);
router.post('/login', loginUsuario);
router.put('/update/:id', actualizarUsuario);
router.get('/:id', obtenerUsuario);
router.delete('/delete/:id', eliminarUsuario);

module.exports = router;
