const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());
const apiRoutes = express.Router();

const PORT = 3000;



// Error handler middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Internal server error', 
        details: err.message 
    });
});


app.get("/", async (req, res) => {
    if (req.headers.action.toLowerCase() === 'ping') {
        res.status(200).json({ msg: 'Welcome to the API' });
    }
    else {
        res.status(400).json({ msg: 'Unknown GET action' });
    }
});



//POST requests
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


app.listen(3000, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});