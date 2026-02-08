/**
 * Salesforce Service Tests
 *
 * Tests for Salesforce connection and metadata retrieval
 * NOTE: These tests use mocked jsforce - no real SF connection needed
 */

const { expect } = require('chai');
const sinon = require('sinon');
const jsforce = require('jsforce');

describe('Salesforce Service', function() {

    describe('Basic service structure', function() {
        const salesforceService = require('../../src/services/salesforceService');

        it('should export required functions', function() {
            expect(salesforceService).to.have.property('connectToOrg');
            expect(salesforceService).to.have.property('analyzeOrg');
            expect(salesforceService).to.have.property('getObjectMetadata');
            expect(salesforceService).to.have.property('getRecordCount');
            expect(salesforceService).to.have.property('queryRecords');
            expect(salesforceService).to.have.property('insertRecords');
            expect(salesforceService).to.have.property('testConnection');
        });

        it('should have functions that are callable', function() {
            expect(salesforceService.connectToOrg).to.be.a('function');
            expect(salesforceService.analyzeOrg).to.be.a('function');
            expect(salesforceService.getObjectMetadata).to.be.a('function');
        });
    });


    describe('Connection Management', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should create connection with username/password', async function() {
            // Mock jsforce Connection
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' })
            };
            sandbox.stub(jsforce, 'Connection').returns(mockConnection);

            // Mock SfOrg.findByPk
            const { SfOrg } = require('../../models');
            sandbox.stub(SfOrg, 'findByPk').resolves({
                id: 'test-org-id',
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password123',
                securityToken: 'token123',
                loginURL: 'https://test.salesforce.com'
            });

            const salesforceService = require('../../src/services/salesforceService');
            const conn = await salesforceService.connectToOrg('test-org-id');

            expect(conn).to.exist;
            expect(mockConnection.login.calledOnce).to.be.true;
        });

        it('should throw error for invalid org ID', async function() {
            const { SfOrg } = require('../../models');
            sandbox.stub(SfOrg, 'findByPk').resolves(null);

            const salesforceService = require('../../src/services/salesforceService');

            try {
                await salesforceService.connectToOrg('invalid-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('not found');
            }
        });
    });

    describe('Metadata Retrieval', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should retrieve object list from org', async function() {
            const mockObjects = {
                sobjects: [
                    { name: 'Account', label: 'Account', custom: false },
                    { name: 'Contact', label: 'Contact', custom: false },
                    { name: 'CustomObject__c', label: 'Custom Object', custom: true }
                ]
            };

            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describeGlobal: sandbox.stub().resolves(mockObjects)
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);

            const { SfOrg } = require('../../models');
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token',
                loginURL: 'https://test.salesforce.com'
            });

            const salesforceService = require('../../src/services/salesforceService');
            const objects = await salesforceService.analyzeOrg('test-org-id');

            expect(objects).to.be.an('array');
            expect(objects).to.have.lengthOf(3);
            expect(objects[0]).to.have.property('objectName', 'Account');
            expect(objects[2]).to.have.property('isCustom', true);
        });

        it('should retrieve detailed object metadata', async function() {
            const mockDescribe = {
                name: 'Account',
                label: 'Account',
                custom: false,
                fields: [
                    {
                        name: 'Name',
                        label: 'Account Name',
                        type: 'string',
                        length: 255,
                        nillable: false,
                        custom: false,
                        picklistValues: null
                    },
                    {
                        name: 'AnnualRevenue',
                        label: 'Annual Revenue',
                        type: 'currency',
                        length: null,
                        nillable: true,
                        custom: false,
                        picklistValues: null
                    }
                ]
            };

            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describe: sandbox.stub().resolves(mockDescribe)
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);

            const { SfOrg } = require('../../models');
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const salesforceService = require('../../src/services/salesforceService');
            const metadata = await salesforceService.getObjectMetadata('test-org-id', 'Account');

            expect(metadata).to.have.property('objectName', 'Account');
            expect(metadata).to.have.property('fields');
            expect(metadata.fields).to.be.an('array');
            expect(metadata.fields).to.have.lengthOf(2);
            expect(metadata.fields[0]).to.have.property('fieldName', 'Name');
            expect(metadata.fields[0]).to.have.property('isRequired', true);
        });
    });
});
