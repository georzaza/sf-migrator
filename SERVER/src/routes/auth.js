const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
    if (!req.body || !req.body.email || !req.body.password || !req.headers || !req.headers.action || !req.headers.action.toLowerCase() === 'login') {
        return res.status(400).json({ success: false, message: 'Wrong request.' });
    }

    const { email, password } = req.body;
    // todo
    if (email === 'georzaza@gmail.com' && password === 'georzaza') {
        res.status(200).json({ success: true, message: 'Login successful' });
    }
    else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

router.post('/register', (req, res) => {
    const { email, password } = req.body;
    res.status(200).json({ success: true, message: 'Registration was successful.' });
    // todo send 201 if created.

    // todo check db
    res.status(409).json({ success: false, message: 'User already exists' });
});

module.exports = router;
