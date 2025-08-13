const express = require('express');
const { crearPost, obtenerPosts, actualizarPost, eliminarPost } = require('../controllers/postController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/create', crearPost);
router.get('/', obtenerPosts);
router.put('/:id', actualizarPost);
router.delete('/:id', eliminarPost);

module.exports = router;
