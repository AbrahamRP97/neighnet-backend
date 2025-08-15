const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const vigilanciaRoutes = require('./routes/vigilanciaRoutes');
const visitantesRoutes = require('./routes/visitantesRoutes');
const uploadsRoutes = require('./routes/uploadsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(compression());

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/vigilancia', vigilanciaRoutes);
app.use('/api/visitantes', visitantesRoutes);
app.use('/api/uploads', uploadsRoutes);

app.use((req, res, _next) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
