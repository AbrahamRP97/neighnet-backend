const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const vigilanciaRoutes = require('./routes/vigilanciaRoutes');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Rutas de autenticación (registro, login, perfil)
app.use('/api/auth', authRoutes);

// Rutas de publicaciones (crear post, obtener posts, eliminar post)
app.use('/api/posts', postRoutes);

// Rutas de vigilancia (registrar visita)
app.use('/api/vigilancia', vigilanciaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));