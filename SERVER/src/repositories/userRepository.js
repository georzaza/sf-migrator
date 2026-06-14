/**
 * User Repository - Database operations for User model
 */

import db from '../../models/index.js';
import logger from '../lib/logger.js';
const { User } = db;
const log = logger.create('userRepository');


async function findByEmail(email) {
    return User.findOne({ where: { email } });
}


async function findByUsername(username) {
    return User.findOne({ where: { username } });
}


async function findById(id) {
    return User.findByPk(id);
}


async function create(userData) {
    return User.create(userData);
}


async function updateLastLogin(id) {
    try {
        const user = await User.findByPk(id);
        if (user) {
            user.lastLogin = Date.now();
            return user.save();
        }
        return null;
    } catch (error) {
        return null;
    }
}

export default {
    findByEmail,
    findByUsername,
    findById,
    create,
    updateLastLogin,
};
