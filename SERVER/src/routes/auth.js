const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const userRepo = require('../repositories/userRepository');
const validator = require('./validator.js');

const sendResponse = require('../utils/sendResponse.js');
const parseCookies = require('../utils/parseCookies.js');
const logger = require('../lib/logger');
const log = logger.create('authRoutes');

require('dotenv').config({ path: '../.env' });

const SALT_ROUNDS = 10;

// ============================= LOGIN =============================
router.post('/login', async (req, res) => {
    if (
        !req.body || !req.body.userIdentifier || !req.body.password  || !req.headers ||
        !req.headers.action || !req.headers.action.toLowerCase() === 'login')
    {
        return sendResponse(res, 400, false, 'Bad request.');
    }

    const { userIdentifier, password } = req.body;

    try {
        const userByEmail = await userRepo.findByEmail(userIdentifier);
        const userByUsername = await userRepo.findByUsername(userIdentifier);

        if (!userByEmail && !userByUsername) {
            return sendResponse(res, 404, false, 'User not found. Did you forget your credentials?');
        }

        if (userByEmail || userByUsername) {
            const user = userByEmail || userByUsername;
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (isPasswordValid) {

                userRepo.updateLastLogin(user.id); // asynchronous

                const token = jwt.sign(
                    {
                        id: user.id,
                        email: user.email,
                        username: user.username,
                        role: user.role,
                    },
                    process.env.JWT_SECRET, {
                    expiresIn: process.env.JWT_EXPIRATION || '12h'
                })

                res.setHeader(
                    'Set-Cookie',
                    `auth_token=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age='43200'}; ${process.env.NODE_ENV === 'production' ? ' Secure; SameSite=Strict;' : 'SameSite=Lax'}`
                );

                return sendResponse(res, 200, true, 'Login successful', {
                    email: user.email,
                    username: user.username,
                });
            }
            else {
                return sendResponse(res, 401, false, 'Invalid credentials');
            }
        }
    }
    catch (error) {
        log.error('Login failed', error, { userIdentifier });
        return sendResponse(res, 500, false, 'Internal server error');
    }
});


// ============================= REGISTER =============================
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstname, lastname, username } = req.body;
        const existingUserEmail = await userRepo.findByEmail(email);
        const existingUsername = await userRepo.findByUsername(username);
        const validateEmail = validator.validateEmail(email);
        const validateUsername = validator.validateUsername(username);
        const validatePassword = validator.validatePassword(password);
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
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
            return sendResponse(res, 400, false, 'All fields are required.');

        if (existingUserEmail || existingUsername)
            return sendResponse(res, 409, false, 'User already exists');

        if (validateEmail)
            return sendResponse(res, 400, false, validateEmail);

        if (validateUsername)
            return sendResponse(res, 400, false, validateUsername);

        if (validatePassword)
            return sendResponse(res, 400, false, validatePassword);

        try {
            const createdUser = await userRepo.create(newUser);
            return sendResponse(res, 201, true, 'Registration was successful.', {
                email: createdUser.email,
                username: createdUser.username,
            });
        }
        catch (error) {
            log.error('Failed to create user during registration', error, { email });
            return sendResponse(res, 500, false, 'Internal server error');
        }
    }
    catch (error) {
        log.error('Registration request processing failed', error);
        return sendResponse(res, 500, false, 'Internal server error');
    }
});


// ============================= WHOAMI =============================
router.get('/whoami', async (req, res) => {
    if (!req.headers || !req.headers.action || !req.headers.action.toLowerCase() === 'whoami')
        return sendResponse(res, 400, false, 'Bad request.');
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.auth_token;

    if (!token) {
        log.warn('Whoami called without token');
        sendResponse(res, 401, false, 'Unauthorized.');
    }

    try {
        const userData = jwt.verify(token, process.env.JWT_SECRET);
        const fullUser = await userRepo.findById(userData.id);
        if (!fullUser) {
            log.warn('User not found during whoami', { userId: userData.id });
            return sendResponse(res, 404, false, 'User not found. Token validation failed.');
        }
        return sendResponse(res, 200, true, 'User is authenticated.', {
            email: fullUser.email,
            username: fullUser.username,
        });
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            log.warn('Whoami token expired');
            return sendResponse(res, 401, false, 'Unauthorized. Token has expired.');
        }
        log.error('Whoami token verification failed', error);
        return sendResponse(res, 403, false, 'Unauthorized. Invalid token.');
    }
});


// ============================= LOGOUT =============================
router.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'auth_token=; HttpOnly; Path=/; Max-Age=0;');
    return sendResponse(res, 200, true, 'Logout successful');
});


module.exports = router;
