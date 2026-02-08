/**
 * Metadata Service Tests
 *
 * Tests for metadata storage and retrieval
 * NOTE: Requires PostgreSQL to be running for full tests
 */

const { expect } = require('chai');
// beforeAll is globally available in vitest

describe('Metadata Service', function() {

    describe('Basic service structure', function() {
        const metadataService = require('../../src/services/metadataService');

        it('should export required functions', function() {
            expect(metadataService).to.have.property('analyzeAndSaveOrg');
            expect(metadataService).to.have.property('saveObjectMetadata');
            expect(metadataService).to.have.property('saveFieldMetadata');
            expect(metadataService).to.have.property('getObjectsForOrg');
            expect(metadataService).to.have.property('getFieldsForObject');
            expect(metadataService).to.have.property('refreshMetadata');
            expect(metadataService).to.have.property('deleteOrgMetadata');
            expect(metadataService).to.have.property('getMetadataStats');
        });

        it('should have functions that are callable', function() {
            expect(metadataService.analyzeAndSaveOrg).to.be.a('function');
            expect(metadataService.saveObjectMetadata).to.be.a('function');
            expect(metadataService.getObjectsForOrg).to.be.a('function');
        });
    });

    describe('Object Metadata Storage', function() {
        const metadataService = require('../../src/services/metadataService');
        const { SfObjectMetadata, SfFieldMetadata, SfOrg, User, Project } = require('../../models');

        let testOrg;

        before(async function() {
            // Create test user, project, and org
            const user = await User.create({
                email: 'test@example.com',
                password: 'hashedpassword',
                firstname: 'Test',
                lastname: 'User',
                username: 'testuser'
            });

            const project = await Project.create({
                name: 'Test Project',
                userId: user.id
            });

            testOrg = await SfOrg.create({
                name: 'Test Org',
                projectId: project.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });
        });

        it('should save object metadata', async function() {
            const metadata = {
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                recordCount: 1000,
                fields: [
                    {
                        fieldName: 'Name',
                        fieldLabel: 'Account Name',
                        dataType: 'string',
                        length: 255,
                        isRequired: true,
                        isCustom: false
                    }
                ]
            };

            const saved = await metadataService.saveObjectMetadata(testOrg.id, metadata);

            expect(saved).to.exist;
            expect(saved.objectName).to.equal('Account');
            expect(saved.fields).to.be.an('array');
            expect(saved.fields).to.have.lengthOf(1);
        });

        it('should retrieve objects for org', async function() {
            const objects = await metadataService.getObjectsForOrg(testOrg.id, { includeFields: true });

            expect(objects).to.be.an('array');
            expect(objects.length).to.be.greaterThan(0);
            expect(objects[0]).to.have.property('objectName');
            expect(objects[0]).to.have.property('fields');
        });

        it('should get metadata statistics', async function() {
            const stats = await metadataService.getMetadataStats(testOrg.id);

            expect(stats).to.have.property('totalObjects');
            expect(stats).to.have.property('customObjects');
            expect(stats).to.have.property('standardObjects');
            expect(stats).to.have.property('totalFields');
            expect(stats).to.have.property('lastAnalyzed');
        });
    });
});
