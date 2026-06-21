"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up() {
        // ObjectMappings table removed. FieldMappings now stores sourceObjectId and targetObjectId directly.
    },

    async down() {
        // No-op
    }
};
