"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('FieldMappings', 'transform', {
            type: Sequelize.JSONB,
            allowNull: true,
            comment: 'Canonical Layer-1 transform node tree. Null = derived from legacy mappingType columns.',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('FieldMappings', 'transform');
    },
};
