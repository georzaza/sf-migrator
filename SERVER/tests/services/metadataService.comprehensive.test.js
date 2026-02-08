/**
 * Comprehensive Metadata Service Tests
 *
 * Tests for metadata storage and retrieval operations
 * Includes both unit tests and integration tests with real Salesforce data
 */

const { expect } = require('chai');
const sinon = require('sinon');
const metadataService = require('../../src/services/metadataService');
const salesforceService = require('../../src/services/salesforceService');
const { User, Project, SfOrg, SfObjectMetadata, SfFieldMetadata } = require('../../models');
const { realOrgs, getOrCreateTestOrg } = require('../fixtures/realOrgs');

describe('Metadata Service - Comprehensive Tests', function() {
    this.timeout(60000); // Increase timeout for live API calls

    describe('Module exports', function() {
        it('should export all required functions', function() {
            expect(metadataService).to.have.property('analyzeAndSaveOrg');
            expect(metadataService).to.have.property('saveObjectMetadata');
            expect(metadataService).to.have.property('saveFieldMetadata');
            expect(metadataService).to.have.property('getObjectsForOrg');
            expect(metadataService).to.have.property('getFieldsForObject');
            expect(metadataService).to.have.property('refreshMetadata');
            expect(metadataService).to.have.property('deleteOrgMetadata');
            expect(metadataService).to.have.property('getMetadataStats');
        });

        it('should have all functions callable', function() {
            expect(metadataService.analyzeAndSaveOrg).to.be.a('function');
            expect(metadataService.saveObjectMetadata).to.be.a('function');
            expect(metadataService.saveFieldMetadata).to.be.a('function');
            expect(metadataService.getObjectsForOrg).to.be.a('function');
            expect(metadataService.getFieldsForObject).to.be.a('function');
            expect(metadataService.refreshMetadata).to.be.a('function');
            expect(metadataService.deleteOrgMetadata).to.be.a('function');
            expect(metadataService.getMetadataStats).to.be.a('function');
        });
    });

    describe('Save Object Metadata (Unit)', function() {
        let testUser, testProject, testOrg;

        beforeEach(async function() {
            testUser = await User.create({
                email: 'metadata-test@example.com',
                password: 'hashedpassword',
                firstname: 'Metadata',
                lastname: 'Test',
                username: 'metadatatest'
            });

            testProject = await Project.create({
                name: 'Metadata Test Project',
                userId: testUser.id
            });

            testOrg = await SfOrg.create({
                name: 'Test Metadata Org',
                projectId: testProject.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });
        });

        it('should save object metadata without fields', async function() {
            const metadata = {
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                recordCount: 100
            };

            const saved = await metadataService.saveObjectMetadata(testOrg.id, metadata);

            expect(saved).to.exist;
            expect(saved.objectName).to.equal('Account');
            expect(saved.objectLabel).to.equal('Account');
            expect(saved.isCustom).to.be.false;
            expect(saved.recordCount).to.equal(100);
            expect(saved.sfOrgId).to.equal(testOrg.id);
        });

        it('should save object metadata with fields', async function() {
            const metadata = {
                objectName: 'Contact',
                objectLabel: 'Contact',
                isCustom: false,
                recordCount: 500,
                fields: [
                    {
                        fieldName: 'FirstName',
                        fieldLabel: 'First Name',
                        dataType: 'string',
                        length: 40,
                        isRequired: false,
                        isCustom: false
                    },
                    {
                        fieldName: 'LastName',
                        fieldLabel: 'Last Name',
                        dataType: 'string',
                        length: 80,
                        isRequired: true,
                        isCustom: false
                    },
                    {
                        fieldName: 'Email',
                        fieldLabel: 'Email',
                        dataType: 'email',
                        length: 80,
                        isRequired: false,
                        isCustom: false
                    }
                ]
            };

            const saved = await metadataService.saveObjectMetadata(testOrg.id, metadata);

            expect(saved).to.exist;
            expect(saved.objectName).to.equal('Contact');
            expect(saved.fields).to.be.an('array');
            expect(saved.fields).to.have.lengthOf(3);

            const lastNameField = saved.fields.find(f => f.fieldName === 'LastName');
            expect(lastNameField).to.exist;
            expect(lastNameField.isRequired).to.be.true;
        });

        it('should update existing object metadata', async function() {
            const metadata1 = {
                objectName: 'Opportunity',
                objectLabel: 'Opportunity',
                isCustom: false,
                recordCount: 50
            };

            const saved1 = await metadataService.saveObjectMetadata(testOrg.id, metadata1);
            expect(saved1.recordCount).to.equal(50);

            // Update with new data
            const metadata2 = {
                objectName: 'Opportunity',
                objectLabel: 'Opportunity',
                isCustom: false,
                recordCount: 75
            };

            const saved2 = await metadataService.saveObjectMetadata(testOrg.id, metadata2);
            expect(saved2.id).to.equal(saved1.id);
            expect(saved2.recordCount).to.equal(75);
        });

        it('should save custom object metadata', async function() {
            const metadata = {
                objectName: 'CustomObject__c',
                objectLabel: 'Custom Object',
                isCustom: true,
                recordCount: 25,
                fields: [
                    {
                        fieldName: 'CustomField__c',
                        fieldLabel: 'Custom Field',
                        dataType: 'string',
                        length: 255,
                        isRequired: false,
                        isCustom: true
                    }
                ]
            };

            const saved = await metadataService.saveObjectMetadata(testOrg.id, metadata);

            expect(saved.isCustom).to.be.true;
            expect(saved.fields[0].isCustom).to.be.true;
        });

        it('should save field with picklist values', async function() {
            const metadata = {
                objectName: 'Lead',
                objectLabel: 'Lead',
                isCustom: false,
                fields: [
                    {
                        fieldName: 'Status',
                        fieldLabel: 'Lead Status',
                        dataType: 'picklist',
                        isRequired: true,
                        isCustom: false,
                        picklistValues: [
                            { label: 'Open - Not Contacted', value: 'Open - Not Contacted' },
                            { label: 'Working - Contacted', value: 'Working - Contacted' },
                            { label: 'Closed - Converted', value: 'Closed - Converted' }
                        ]
                    }
                ]
            };

            const saved = await metadataService.saveObjectMetadata(testOrg.id, metadata);
            const statusField = saved.fields.find(f => f.fieldName === 'Status');

            expect(statusField.picklistValues).to.be.an('array');
            expect(statusField.picklistValues).to.have.lengthOf(3);
            expect(statusField.picklistValues[0]).to.deep.include({ label: 'Open - Not Contacted' });
        });

        it('should update fields when re-saving object', async function() {
            const metadata1 = {
                objectName: 'Case',
                objectLabel: 'Case',
                isCustom: false,
                fields: [
                    {
                        fieldName: 'Subject',
                        fieldLabel: 'Subject',
                        dataType: 'string',
                        length: 255,
                        isRequired: false,
                        isCustom: false
                    }
                ]
            };

            await metadataService.saveObjectMetadata(testOrg.id, metadata1);

            // Add more fields
            const metadata2 = {
                objectName: 'Case',
                objectLabel: 'Case',
                isCustom: false,
                fields: [
                    {
                        fieldName: 'Subject',
                        fieldLabel: 'Subject',
                        dataType: 'string',
                        length: 255,
                        isRequired: false,
                        isCustom: false
                    },
                    {
                        fieldName: 'Description',
                        fieldLabel: 'Description',
                        dataType: 'textarea',
                        length: 32000,
                        isRequired: false,
                        isCustom: false
                    }
                ]
            };

            const saved = await metadataService.saveObjectMetadata(testOrg.id, metadata2);
            expect(saved.fields).to.have.lengthOf(2);
        });
    });

    describe('Get Objects for Org (Unit)', function() {
        let testUser, testProject, testOrg;

        beforeEach(async function() {
            testUser = await User.create({
                email: 'get-objects@example.com',
                password: 'hashedpassword',
                firstname: 'Get',
                lastname: 'Objects',
                username: 'getobjects'
            });

            testProject = await Project.create({
                name: 'Get Objects Test',
                userId: testUser.id
            });

            testOrg = await SfOrg.create({
                name: 'Get Objects Org',
                projectId: testProject.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            // Create some test objects
            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                fields: [
                    { fieldName: 'Name', fieldLabel: 'Name', dataType: 'string', isRequired: true, isCustom: false }
                ]
            });

            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Contact',
                objectLabel: 'Contact',
                isCustom: false,
                fields: [
                    { fieldName: 'LastName', fieldLabel: 'Last Name', dataType: 'string', isRequired: true, isCustom: false }
                ]
            });
        });

        it('should retrieve objects without fields', async function() {
            const objects = await metadataService.getObjectsForOrg(testOrg.id, { includeFields: false });

            expect(objects).to.be.an('array');
            expect(objects).to.have.lengthOf(2);
            expect(objects[0]).to.have.property('objectName');
            expect(objects[0]).to.not.have.property('fields');
        });

        it('should retrieve objects with fields', async function() {
            const objects = await metadataService.getObjectsForOrg(testOrg.id, { includeFields: true });

            expect(objects).to.be.an('array');
            expect(objects).to.have.lengthOf(2);
            expect(objects[0]).to.have.property('fields');
            expect(objects[0].fields).to.be.an('array');
        });

        it('should return empty array for org with no objects', async function() {
            const emptyOrg = await SfOrg.create({
                name: 'Empty Org',
                projectId: testProject.id,
                loginURL: 'https://empty.salesforce.com',
                connectionType: 'Credentials',
                username: 'empty@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            const objects = await metadataService.getObjectsForOrg(emptyOrg.id);

            expect(objects).to.be.an('array');
            expect(objects).to.have.lengthOf(0);
        });

        it('should return objects in alphabetical order', async function() {
            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Zebra__c',
                objectLabel: 'Zebra',
                isCustom: true
            });

            const objects = await metadataService.getObjectsForOrg(testOrg.id);

            expect(objects[0].objectName).to.equal('Account');
            expect(objects[1].objectName).to.equal('Contact');
            expect(objects[2].objectName).to.equal('Zebra__c');
        });
    });

    describe('Get Fields for Object (Unit)', function() {
        let testOrg, testObject;

        beforeEach(async function() {
            const testUser = await User.create({
                email: 'get-fields@example.com',
                password: 'hashedpassword',
                firstname: 'Get',
                lastname: 'Fields',
                username: 'getfields'
            });

            const testProject = await Project.create({
                name: 'Get Fields Test',
                userId: testUser.id
            });

            testOrg = await SfOrg.create({
                name: 'Get Fields Org',
                projectId: testProject.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            testObject = await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                fields: [
                    { fieldName: 'Id', fieldLabel: 'Account ID', dataType: 'id', isRequired: true, isCustom: false },
                    { fieldName: 'Name', fieldLabel: 'Account Name', dataType: 'string', length: 255, isRequired: true, isCustom: false },
                    { fieldName: 'Phone', fieldLabel: 'Phone', dataType: 'phone', isRequired: false, isCustom: false }
                ]
            });
        });

        it('should retrieve fields for object', async function() {
            const fields = await metadataService.getFieldsForObject(testObject.id);

            expect(fields).to.be.an('array');
            expect(fields).to.have.lengthOf(3);
            expect(fields[0]).to.have.property('fieldName');
            expect(fields[0]).to.have.property('fieldLabel');
            expect(fields[0]).to.have.property('dataType');
        });

        it('should return fields in alphabetical order', async function() {
            const fields = await metadataService.getFieldsForObject(testObject.id);

            expect(fields[0].fieldName).to.equal('Id');
            expect(fields[1].fieldName).to.equal('Name');
            expect(fields[2].fieldName).to.equal('Phone');
        });

        it('should return empty array for object with no fields', async function() {
            const emptyObject = await SfObjectMetadata.create({
                sfOrgId: testOrg.id,
                objectName: 'EmptyObject',
                objectLabel: 'Empty Object',
                isCustom: false
            });

            const fields = await metadataService.getFieldsForObject(emptyObject.id);

            expect(fields).to.be.an('array');
            expect(fields).to.have.lengthOf(0);
        });
    });

    describe('Metadata Statistics (Unit)', function() {
        let testOrg;

        beforeEach(async function() {
            const testUser = await User.create({
                email: 'stats@example.com',
                password: 'hashedpassword',
                firstname: 'Stats',
                lastname: 'Test',
                username: 'statstest'
            });

            const testProject = await Project.create({
                name: 'Stats Test Project',
                userId: testUser.id
            });

            testOrg = await SfOrg.create({
                name: 'Stats Test Org',
                projectId: testProject.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            // Create standard objects
            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                recordCount: 1000,
                fields: [
                    { fieldName: 'Name', fieldLabel: 'Name', dataType: 'string', isRequired: true, isCustom: false },
                    { fieldName: 'Phone', fieldLabel: 'Phone', dataType: 'phone', isRequired: false, isCustom: false }
                ]
            });

            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Contact',
                objectLabel: 'Contact',
                isCustom: false,
                recordCount: 5000,
                fields: [
                    { fieldName: 'FirstName', fieldLabel: 'First Name', dataType: 'string', isRequired: false, isCustom: false },
                    { fieldName: 'LastName', fieldLabel: 'Last Name', dataType: 'string', isRequired: true, isCustom: false },
                    { fieldName: 'Email', fieldLabel: 'Email', dataType: 'email', isRequired: false, isCustom: false }
                ]
            });

            // Create custom object
            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'CustomObject__c',
                objectLabel: 'Custom Object',
                isCustom: true,
                recordCount: 50,
                fields: [
                    { fieldName: 'CustomField__c', fieldLabel: 'Custom Field', dataType: 'string', isRequired: false, isCustom: true }
                ]
            });
        });

        it('should calculate correct statistics', async function() {
            const stats = await metadataService.getMetadataStats(testOrg.id);

            expect(stats).to.have.property('totalObjects', 3);
            expect(stats).to.have.property('customObjects', 1);
            expect(stats).to.have.property('standardObjects', 2);
            expect(stats).to.have.property('totalFields', 6);
            expect(stats).to.have.property('totalRecords', 6050);
            expect(stats).to.have.property('lastAnalyzed');
        });

        it('should handle org with no metadata', async function() {
            const emptyOrg = await SfOrg.create({
                name: 'Empty Stats Org',
                projectId: testOrg.projectId,
                loginURL: 'https://empty.salesforce.com',
                connectionType: 'Credentials',
                username: 'empty@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            const stats = await metadataService.getMetadataStats(emptyOrg.id);

            expect(stats.totalObjects).to.equal(0);
            expect(stats.customObjects).to.equal(0);
            expect(stats.standardObjects).to.equal(0);
            expect(stats.totalFields).to.equal(0);
            expect(stats.totalRecords).to.equal(0);
            expect(stats.lastAnalyzed).to.be.null;
        });
    });

    describe('Delete Org Metadata (Unit)', function() {
        let testOrg;

        beforeEach(async function() {
            const testUser = await User.create({
                email: 'delete@example.com',
                password: 'hashedpassword',
                firstname: 'Delete',
                lastname: 'Test',
                username: 'deletetest'
            });

            const testProject = await Project.create({
                name: 'Delete Test Project',
                userId: testUser.id
            });

            testOrg = await SfOrg.create({
                name: 'Delete Test Org',
                projectId: testProject.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            // Create objects with fields
            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                fields: [{ fieldName: 'Name', fieldLabel: 'Name', dataType: 'string', isRequired: true, isCustom: false }]
            });

            await metadataService.saveObjectMetadata(testOrg.id, {
                objectName: 'Contact',
                objectLabel: 'Contact',
                isCustom: false,
                fields: [{ fieldName: 'LastName', fieldLabel: 'Last Name', dataType: 'string', isRequired: true, isCustom: false }]
            });
        });

        it('should delete all metadata for org', async function() {
            const beforeObjects = await metadataService.getObjectsForOrg(testOrg.id);
            expect(beforeObjects).to.have.lengthOf(2);

            const result = await metadataService.deleteOrgMetadata(testOrg.id);

            expect(result.success).to.be.true;
            expect(result.deletedObjects).to.equal(2);

            const afterObjects = await metadataService.getObjectsForOrg(testOrg.id);
            expect(afterObjects).to.have.lengthOf(0);
        });

        it('should handle deleting from empty org', async function() {
            const emptyOrg = await SfOrg.create({
                name: 'Empty Delete Org',
                projectId: testOrg.projectId,
                loginURL: 'https://empty.salesforce.com',
                connectionType: 'Credentials',
                username: 'empty@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            const result = await metadataService.deleteOrgMetadata(emptyOrg.id);

            expect(result.success).to.be.true;
            expect(result.deletedObjects).to.equal(0);
        });
    });

    describe('Analyze and Save Org (Mocked)', function() {
        let sandbox, testOrg;

        beforeEach(async function() {
            sandbox = sinon.createSandbox();

            const testUser = await User.create({
                email: 'analyze@example.com',
                password: 'hashedpassword',
                firstname: 'Analyze',
                lastname: 'Test',
                username: 'analyzetest'
            });

            const testProject = await Project.create({
                name: 'Analyze Test Project',
                userId: testUser.id
            });

            testOrg = await SfOrg.create({
                name: 'Analyze Test Org',
                projectId: testProject.id,
                loginURL: 'https://test.salesforce.com',
                connectionType: 'Credentials',
                username: 'test@sf.com',
                password: 'password',
                securityToken: 'token'
            });
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should analyze org and save all metadata', async function() {
            // Mock salesforceService.analyzeOrg
            sandbox.stub(salesforceService, 'analyzeOrg').resolves([
                { objectName: 'Account', objectLabel: 'Account', isCustom: false },
                { objectName: 'Contact', objectLabel: 'Contact', isCustom: false }
            ]);

            // Mock salesforceService.getObjectMetadata
            sandbox.stub(salesforceService, 'getObjectMetadata')
                .onFirstCall().resolves({
                    objectName: 'Account',
                    objectLabel: 'Account',
                    isCustom: false,
                    fields: [
                        { fieldName: 'Name', fieldLabel: 'Account Name', dataType: 'string', length: 255, isRequired: true, isCustom: false }
                    ]
                })
                .onSecondCall().resolves({
                    objectName: 'Contact',
                    objectLabel: 'Contact',
                    isCustom: false,
                    fields: [
                        { fieldName: 'LastName', fieldLabel: 'Last Name', dataType: 'string', length: 80, isRequired: true, isCustom: false }
                    ]
                });

            const result = await metadataService.analyzeAndSaveOrg(testOrg.id);

            expect(result.success).to.be.true;
            expect(result.objectsAnalyzed).to.equal(2);
            expect(result.totalFields).to.equal(2);

            // Verify data was saved
            const savedObjects = await metadataService.getObjectsForOrg(testOrg.id, { includeFields: true });
            expect(savedObjects).to.have.lengthOf(2);
        });

        it('should analyze org with record counts', async function() {
            sandbox.stub(salesforceService, 'analyzeOrg').resolves([
                { objectName: 'Account', objectLabel: 'Account', isCustom: false }
            ]);

            sandbox.stub(salesforceService, 'getObjectMetadata').resolves({
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                fields: []
            });

            sandbox.stub(salesforceService, 'getRecordCount').resolves(1234);

            const result = await metadataService.analyzeAndSaveOrg(testOrg.id, { includeRecordCounts: true });

            expect(result.success).to.be.true;

            const savedObjects = await metadataService.getObjectsForOrg(testOrg.id);
            expect(savedObjects[0].recordCount).to.equal(1234);
        });

        it('should analyze only specified objects', async function() {
            sandbox.stub(salesforceService, 'analyzeOrg').resolves([
                { objectName: 'Account', objectLabel: 'Account', isCustom: false },
                { objectName: 'Contact', objectLabel: 'Contact', isCustom: false },
                { objectName: 'Lead', objectLabel: 'Lead', isCustom: false }
            ]);

            sandbox.stub(salesforceService, 'getObjectMetadata').resolves({
                objectName: 'Account',
                objectLabel: 'Account',
                isCustom: false,
                fields: []
            });

            const result = await metadataService.analyzeAndSaveOrg(testOrg.id, {
                objectsToAnalyze: ['Account']
            });

            expect(result.objectsAnalyzed).to.equal(1);
        });
    });

    describe('Live Integration Tests with Real Orgs', function() {
        let testUser, testProject, testOrg1, testOrg2;

        before(async function() {
            testUser = await User.create({
                email: 'metadata-live@example.com',
                password: 'hashedpassword',
                firstname: 'Metadata',
                lastname: 'Live',
                username: 'metadatalive'
            });

            testProject = await Project.create({
                name: 'Metadata Live Test Project',
                userId: testUser.id
            });

            testOrg1 = await getOrCreateTestOrg(SfOrg, 'superbadgeFormulas', testProject.id);
            testOrg2 = await getOrCreateTestOrg(SfOrg, 'superbadgeApexWebServices', testProject.id);
        });

        it('should analyze and save real org metadata', async function() {
            // Clean any existing metadata first
            await metadataService.deleteOrgMetadata(testOrg1.id);

            const result = await metadataService.analyzeAndSaveOrg(testOrg1.id, {
                objectsToAnalyze: ['Account', 'Contact']
            });

            expect(result.success).to.be.true;
            expect(result.objectsAnalyzed).to.equal(2);
            expect(result.totalFields).to.be.greaterThan(0);
        });

        it('should retrieve saved metadata from database', async function() {
            const objects = await metadataService.getObjectsForOrg(testOrg1.id, { includeFields: true });

            expect(objects).to.be.an('array');
            expect(objects.length).to.be.greaterThan(0);

            const accountObj = objects.find(obj => obj.objectName === 'Account');
            if (accountObj) {
                expect(accountObj.fields).to.be.an('array');
                expect(accountObj.fields.length).to.be.greaterThan(0);
            }
        });

        it('should get metadata statistics for real org', async function() {
            const stats = await metadataService.getMetadataStats(testOrg1.id);

            expect(stats).to.have.property('totalObjects');
            expect(stats).to.have.property('totalFields');
            expect(stats.totalObjects).to.be.greaterThan(0);
        });

        it('should refresh metadata (update existing)', async function() {
            const beforeStats = await metadataService.getMetadataStats(testOrg1.id);

            const result = await metadataService.refreshMetadata(testOrg1.id, {
                objectsToAnalyze: ['Account']
            });

            expect(result.success).to.be.true;

            const afterStats = await metadataService.getMetadataStats(testOrg1.id);
            expect(afterStats.totalObjects).to.be.greaterThan(0);
        });

        it('should analyze multiple objects from real org', async function() {
            await metadataService.deleteOrgMetadata(testOrg2.id);

            const result = await metadataService.analyzeAndSaveOrg(testOrg2.id, {
                objectsToAnalyze: ['Account', 'Contact', 'Lead', 'Opportunity']
            });

            expect(result.success).to.be.true;
            expect(result.objectsAnalyzed).to.equal(4);
            expect(result.objects).to.be.an('array');
            expect(result.objects).to.have.lengthOf(4);
        });

        it('should retrieve metadata for specific Account object', async function() {
            const objects = await metadataService.getObjectsForOrg(testOrg2.id);
            const accountObj = objects.find(obj => obj.objectName === 'Account');

            expect(accountObj).to.exist;

            const fields = await metadataService.getFieldsForObject(accountObj.id);
            expect(fields).to.be.an('array');
            expect(fields.length).to.be.greaterThan(5);

            const nameField = fields.find(f => f.fieldName === 'Name');
            expect(nameField).to.exist;
            expect(nameField.isRequired).to.be.true;
        });

        it('should handle concurrent metadata operations', async function() {
            const [stats1, stats2, objects1] = await Promise.all([
                metadataService.getMetadataStats(testOrg1.id),
                metadataService.getMetadataStats(testOrg2.id),
                metadataService.getObjectsForOrg(testOrg1.id)
            ]);

            expect(stats1).to.have.property('totalObjects');
            expect(stats2).to.have.property('totalObjects');
            expect(objects1).to.be.an('array');
        });

        it('should analyze with record counts from real org', async function() {
            await metadataService.deleteOrgMetadata(testOrg1.id);

            const result = await metadataService.analyzeAndSaveOrg(testOrg1.id, {
                objectsToAnalyze: ['Account'],
                includeRecordCounts: true
            });

            expect(result.success).to.be.true;

            const objects = await metadataService.getObjectsForOrg(testOrg1.id);
            const accountObj = objects.find(obj => obj.objectName === 'Account');

            expect(accountObj).to.exist;
            expect(accountObj.recordCount).to.be.a('number');
        });
    });
});
