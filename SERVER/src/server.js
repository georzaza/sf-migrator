require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const requestTracer = require('./middleware/requestTracer');
const logger = require('./lib/logger');
const log = logger.create('server');

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use(requestTracer);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-Request-ID'],
}));

app.use('/auth', authRoutes);
app.use('/', apiRoutes);

app.listen(PORT, () => {
    log.info(`Server is running on http://localhost:${PORT}`);
});
