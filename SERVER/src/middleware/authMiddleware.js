const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');
const sendResponse = require('../utils/sendResponse');
const parseCookies = require('../utils/parseCookies');
const logger = require('../lib/logger');
const log = logger.create('authMiddleware');

async function authMiddleware(req, res, next) {
    if (!req.headers || !req.get('action')) {
        return sendResponse(res, 400, false, 'Bad request: Missing required headers.');
    }
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.auth_token;

    if (!token) {
        log.warn('No token provided in cookies');
        return sendResponse(res, 401, false, 'Unauthorized.');
    }

    try {
        const userData = jwt.verify(token, process.env.JWT_SECRET);
        const fullUser = await userRepo.findById(userData.id);
        if (!fullUser) {
            log.warn('User not found during token validation', { userId: userData.id });
            return sendResponse(res, 404, false, 'User not found. Token validation failed.');
        }

        req.user = fullUser;
        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            log.warn('Token has expired');
            return sendResponse(res, 401, false, 'Unauthorized. Token has expired.');
        }
        log.error('Token verification failed', error);
        return sendResponse(res, 403, false, 'Unauthorized. Invalid token.');
    }
}

module.exports = authMiddleware;
