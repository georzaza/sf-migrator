const path = require('path');

const env = process.env.NODE_ENV || 'development';
require('dotenv').config({
    path: path.resolve(__dirname, `../.env.${env}`),
});

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const requestTracer = require('./middleware/requestTracer');
const logger = require('./lib/logger');
const log = logger.create('server');

const distPath = path.join(__dirname, '..', '..', 'dist');
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-Request-ID'],
}));

app.use(express.json());
app.use(requestTracer);

// Serve built frontend static files (if you build the app into /dist)
// app.use(express.static(distPath));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// SPA fallback: serve index.html for non-API/auth routes so client-side routing works
/*
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
});
*/

app.listen(PORT, () => {
    log.info(`Server is running on http://localhost:${PORT}`);
});
