const { User } = require('../../models');

async function getUserByEmail(email) {
    return await User.findOne({ where: { email } });
}

async function getUserByUsername(username) {
    return await User.findOne({ where: { username } });
}

async function createUser(userData) {
    return await User.create(userData);
}

async function getUserById(id) {
    return await User.findByPk(id);
}

module.exports = {
    getUserByEmail,
    getUserByUsername,
    createUser,
    getUserById
};
