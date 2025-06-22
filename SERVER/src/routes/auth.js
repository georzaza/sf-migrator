const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const userService = require('../services/userService');
const validator = require('./validator.js');

const saltRounds = 10;

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


router.post('/register', async (req, res) => {
    try {
        const { email, password, firstname, lastname, username } = req.body;
        const existingUserEmail = await userService.getUserByEmail(email);
        const existingUsername = await userService.getUserByUsername(username);
        const validateEmail = validator.validateEmail(email);
        const validateUsername = validator.validateUsername(username);
        const validatePassword = validator.validatePassword(password);
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = {
            email: email,
            password: hashedPassword,
            firstname: firstname,
            lastname: lastname,
            username: username,
            role: 'user',
            isActive: true,
            emailVerified: false,
            lastLogin: null,
            resetPasswordToken: null,
            resetPasswordExpires: null
        };

        if (!email || !password || !firstname || !lastname || !username)
            return res.status(400).json({ success: false, message: 'All fields are required.' });

        if (existingUserEmail || existingUsername)
            return res.status(409).json({ success: false, message: 'User already exists' });

        if (validateEmail)
            return res.status(400).json({ success: false, message: validateEmail });

        if (validateUsername)
            return res.status(400).json({ success: false, message: validateUsername });

        console.log('validatePassword', validatePassword);
        if (validatePassword)
            return res.status(400).json({ success: false, message: validatePassword });

        try {
            const createdUser = await userService.createUser(newUser);
            res.status(201).json({
                success: true,
                message: 'Registration was successful.',
                data: {
                    email: createdUser.email,
                    username: createdUser.username,
                }
            });
        }
        catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
    catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
