/**
 * Model Tests - Verify new models are created correctly
 * NOTE: Requires PostgreSQL running
 */

const { expect } = require('chai');

describe('New Migration Models', function() {
    it('should verify test framework is working', function() {
        expect(true).to.be.true;
    });

    const {
        SfObjectMetadata,
        SfFieldMetadata,
        ObjectMapping,
        FieldMapping,
        MigrationJob,
        sequelize
    } = require('../../models');

    describe('SfObjectMetadata Model', function() {
        it('should be defined', function() {
            expect(SfObjectMetadata).to.exist;
        });

        it('should have correct attributes', function() {
            const attributes = Object.keys(SfObjectMetadata.rawAttributes);
            expect(attributes).to.include('id');
            expect(attributes).to.include('sfOrgId');
            expect(attributes).to.include('objectName');
            expect(attributes).to.include('objectLabel');
            expect(attributes).to.include('isCustom');
            expect(attributes).to.include('recordCount');
            expect(attributes).to.include('lastAnalyzed');
        });
    });

    describe('SfFieldMetadata Model', function() {
        it('should be defined', function() {
            expect(SfFieldMetadata).to.exist;
        });

        it('should have correct attributes', function() {
            const attributes = Object.keys(SfFieldMetadata.rawAttributes);
            expect(attributes).to.include('id');
            expect(attributes).to.include('objectMetadataId');
            expect(attributes).to.include('fieldName');
            expect(attributes).to.include('fieldLabel');
            expect(attributes).to.include('dataType');
            expect(attributes).to.include('isRequired');
            expect(attributes).to.include('isCustom');
        });
    });

    describe('ObjectMapping Model', function() {
        it('should be defined', function() {
            expect(ObjectMapping).to.exist;
        });

        it('should have correct attributes', function() {
            const attributes = Object.keys(ObjectMapping.rawAttributes);
            expect(attributes).to.include('id');
            expect(attributes).to.include('projectId');
            expect(attributes).to.include('sourceObjectId');
            expect(attributes).to.include('targetObjectId');
            expect(attributes).to.include('isActive');
        });
    });

    describe('FieldMapping Model', function() {
        it('should be defined', function() {
            expect(FieldMapping).to.exist;
        });

        it('should have correct attributes', function() {
            const attributes = Object.keys(FieldMapping.rawAttributes);
            expect(attributes).to.include('id');
            expect(attributes).to.include('objectMappingId');
            expect(attributes).to.include('sourceFieldId');
            expect(attributes).to.include('targetFieldId');
            expect(attributes).to.include('mappingType');
            expect(attributes).to.include('transformExpression');
            expect(attributes).to.include('constantValue');
            expect(attributes).to.include('isActive');
        });

        it('should have correct enum values for mappingType', function() {
            const mappingTypeField = FieldMapping.rawAttributes.mappingType;
            expect(mappingTypeField.values).to.include('as-is');
            expect(mappingTypeField.values).to.include('expression');
            expect(mappingTypeField.values).to.include('constant');
        });
    });

    describe('MigrationJob Model', function() {
        it('should be defined', function() {
            expect(MigrationJob).to.exist;
        });

        it('should have correct attributes', function() {
            const attributes = Object.keys(MigrationJob.rawAttributes);
            expect(attributes).to.include('id');
            expect(attributes).to.include('objectMappingId');
            expect(attributes).to.include('status');
            expect(attributes).to.include('recordsTotal');
            expect(attributes).to.include('recordsProcessed');
            expect(attributes).to.include('recordsSuccess');
            expect(attributes).to.include('recordsFailed');
            expect(attributes).to.include('startTime');
            expect(attributes).to.include('endTime');
            expect(attributes).to.include('errorLog');
        });

        it('should have correct enum values for status', function() {
            const statusField = MigrationJob.rawAttributes.status;
            expect(statusField.values).to.include('pending');
            expect(statusField.values).to.include('running');
            expect(statusField.values).to.include('completed');
            expect(statusField.values).to.include('failed');
            expect(statusField.values).to.include('cancelled');
        });
    });

    describe('Model Associations', function() {
        it('should have correct associations defined', function() {
            // Check SfObjectMetadata associations
            const objectAssoc = SfObjectMetadata.associations;
            expect(objectAssoc).to.have.property('fields');
            expect(objectAssoc).to.have.property('sfOrg');

            // Check ObjectMapping associations
            const mappingAssoc = ObjectMapping.associations;
            expect(mappingAssoc).to.have.property('project');
            expect(mappingAssoc).to.have.property('sourceObject');
            expect(mappingAssoc).to.have.property('targetObject');
            expect(mappingAssoc).to.have.property('fieldMappings');
        });
    });
});
