const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const vigilanciaRoutes = require('./routes/vigilanciaRoutes');
const visitantesRoutes = require('./routes/visitantesRoutes');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/posts', postRoutes);

app.use('/api/vigilancia', vigilanciaRoutes);

app.use('/api/visitantes', visitantesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));