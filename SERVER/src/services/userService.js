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

// keeping the function as asynchronous as lastLogin is not being used currently.
function setUserLastLogin(id) {
    getUserById(id)
    .then(user => {
        if (user) {
            user.lastLogin = Date.now();
            try {
                return user.save();
            }
            catch (error) {
                console.error('Error saving last login:', error);
            }
        }
        return null;
    })
    .catch(err => {
        console.error('Error updating last login:', err);
        return null;
    });
}

module.exports = {
    getUserByEmail,
    getUserByUsername,
    createUser,
    getUserById,
    setUserLastLogin,
};
