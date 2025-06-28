const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const authRoutes = require('./routes/auth');

require('dotenv').config();

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware CORS, to allow cross-origin requests
app.use(cors ({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // allow requests from VUE frontend only. For Prod, update to actual domain
    credentials: true
}));


// Middleware for error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal server error',
        details: err.message
    });
});

// Additional routes
app.use('/auth', authRoutes);


// ===================== GET Requests =====================
app.get("/", async (req, res) => {
    if (req.headers.action.toLowerCase() === 'ping') {
        res.status(200).json({ msg: 'Welcome to the API' });
    }
    else {
        res.status(400).json({ msg: 'Unknown GET action' });
    }
});


// ===================== POST Requests =====================
app.post("/", async (req, res) => {
    if (req.headers.action.toLowerCase() === 'ping') {
        res.json({ msg: 'pong' });
        res.end();
    }
    else {
        res.send(['Invalid Unknown POST Action']);
        res.end();
    }
});



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
