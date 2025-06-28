const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const sendResponse = require('../utils/sendResponse');
const parseCookies = require('../utils/parseCookies');

// Auth middleware for JWT validation (similar to "whoami" endpoint under /src/routes/auth.js)
async function authMiddleware(req, res, next) {
    if (!req.headers || !req.headers.action || !req.headers.action.toLowerCase() === 'whoami')
        return sendResponse(res, 400, false, 'Bad request.');
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.auth_token;

    if (!token) {
        console.error('SERVER | Auth Middleware | No token provided in cookies.');
        sendResponse(res, 401, false, 'Unauthorized.');
    }

    try {
        const userData = jwt.verify(token, process.env.JWT_SECRET);
        const fullUser = await userService.getUserById(userData.id);
        if (!fullUser) {
            console.error(`SERVER | Auth Middleware | User with ID ${userData.id} not found.`);
            return sendResponse(res, 404, false, 'User not found. Token validation failed.');
        }

        // appends the user to the request
        req.user = fullUser;
        return next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            console.error('SERVER | Auth Middleware | Token has expired.');
            return sendResponse(res, 401, false, 'Unauthorized. Token has expired.');
        }
        console.error('SERVER | Auth Middleware | Error while verifying token:', error);
        return sendResponse(res, 403, false, 'Unauthorized. Invalid token.');
    }
}

module.exports = authMiddleware;
