"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('SfObjectMetadata', 'extractFilter', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Raw SOQL WHERE clause appended at extraction time. Per source object.',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('SfObjectMetadata', 'extractFilter');
    },
};
