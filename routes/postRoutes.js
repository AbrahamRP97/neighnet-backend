const express = require('express');
const { crearPost, obtenerPosts, actualizarPost, eliminarPost } = require('../controllers/postController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create', authMiddleware, crearPost);
router.get('/', obtenerPosts);
router.put('/:id', authMiddleware, actualizarPost);
router.delete('/:id', authMiddleware, eliminarPost);

module.exports = router;