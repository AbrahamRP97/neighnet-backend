const express = require('express');
const {crearPost, obtenerPosts, eliminarPost} = require('../controllers/postController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create',authMiddleware, crearPost);
router.get('/', obtenerPosts);
router.delete('/:id',authMiddleware, eliminarPost);

module.exports = router;
