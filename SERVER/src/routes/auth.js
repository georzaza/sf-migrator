const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    // todo
    if (email === 'georzaza@gmail.com' && password === 'georzaza') {
        res.status(200).json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

router.post('/register', (req, res) => {
    const { email, password } = req.body;
    // todo
    res.status(201).json({ success: false, message: 'Need to implement that in server' });
});

module.exports = router;
