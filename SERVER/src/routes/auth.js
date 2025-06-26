const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const userService = require('../services/userService');
const validator = require('./validator.js');

const saltRounds = 10;

router.post('/login', async (req, res) => {
    if (!req.body || !req.body.userIdentifier || !req.body.password || !req.headers || !req.headers.action || !req.headers.action.toLowerCase() === 'login') {
        return res.status(400).json({ success: false, message: 'Bad request.' });
    }

    const { userIdentifier, password } = req.body;

    try {
        const userByEmail = await userService.getUserByEmail(userIdentifier);
        const userByUsername = await userService.getUserByUsername(userIdentifier);

        if (!userByEmail && !userByUsername) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (userByEmail || userByUsername) {
            const user = userByEmail || userByUsername;
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (isPasswordValid)
                return res.status(200).json({ success: true, message: 'Login successful', data: { email: user.email, username: user.username } });
            else
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    }
    catch (error) {
        console.error(`Login | Error while fetching user ${userIdentifier} | Is the DB up and running? `, error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
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
