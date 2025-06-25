const express = require('express');
const {
  crearPost,
  obtenerPosts,
  eliminarPost,
} = require('../controllers/postController');

const router = express.Router();

router.post('/create', crearPost);
router.get('/', obtenerPosts);
router.delete('/:id', eliminarPost);

module.exports = router;
