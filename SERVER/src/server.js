import path from 'path';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) });

import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import oauthRoutes from './routes/oauth.js';
import requestTracer from './middleware/requestTracer.js';
import logger from './lib/logger.js';
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
app.use('/', oauthRoutes); // OAuth2 routes: /oauth2/auth and /oauth2/callback

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
