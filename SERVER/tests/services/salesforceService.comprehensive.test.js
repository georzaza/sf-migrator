/**
 * Comprehensive Salesforce Service Tests
 *
 * Tests for Salesforce connection and metadata retrieval
 * Includes both mocked tests and live integration tests
 */

const { expect } = require('chai');
const sinon = require('sinon');
const jsforce = require('jsforce');
const salesforceService = require('../../src/services/salesforceService');
const { User, Project, SfOrg } = require('../../models');
const { realOrgs, getOrCreateTestOrg } = require('../fixtures/realOrgs');

describe('Salesforce Service - Comprehensive Tests', function() {
    this.timeout(30000); // Increase timeout for live API calls

    describe('Module exports', function() {
        it('should export all required functions', function() {
            expect(salesforceService).to.have.property('connectToOrg');
            expect(salesforceService).to.have.property('analyzeOrg');
            expect(salesforceService).to.have.property('getObjectMetadata');
            expect(salesforceService).to.have.property('getRecordCount');
            expect(salesforceService).to.have.property('queryRecords');
            expect(salesforceService).to.have.property('insertRecords');
            expect(salesforceService).to.have.property('testConnection');
        });

        it('should have all functions callable', function() {
            expect(salesforceService.connectToOrg).to.be.a('function');
            expect(salesforceService.analyzeOrg).to.be.a('function');
            expect(salesforceService.getObjectMetadata).to.be.a('function');
            expect(salesforceService.getRecordCount).to.be.a('function');
            expect(salesforceService.queryRecords).to.be.a('function');
            expect(salesforceService.insertRecords).to.be.a('function');
            expect(salesforceService.testConnection).to.be.a('function');
        });
    });

    describe('Connection Management (Mocked)', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should create connection with username/password/token', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id', organizationId: 'test-org-id' })
            };
            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                id: 'test-org-id',
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password123',
                securityToken: 'token123',
                loginURL: 'https://login.salesforce.com'
            });

            const conn = await salesforceService.connectToOrg('test-org-id');

            expect(conn).to.exist;
            expect(mockConnection.login.calledOnce).to.be.true;
            expect(mockConnection.login.firstCall.args[0]).to.equal('test@example.com');
            expect(mockConnection.login.firstCall.args[1]).to.equal('password123token123');
        });

        it('should use empty string for missing security token', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' })
            };
            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                id: 'test-org-id',
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password123',
                securityToken: null,
                loginURL: 'https://login.salesforce.com'
            });

            const conn = await salesforceService.connectToOrg('test-org-id');

            expect(conn).to.exist;
            expect(mockConnection.login.firstCall.args[1]).to.equal('password123');
        });

        it('should throw error for invalid org ID', async function() {
            sandbox.stub(SfOrg, 'findByPk').resolves(null);

            try {
                await salesforceService.connectToOrg('invalid-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('not found');
            }
        });

        it('should throw error for missing username', async function() {
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: null,
                password: 'password123'
            });

            try {
                await salesforceService.connectToOrg('test-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Username and password');
            }
        });

        it('should throw error for missing password', async function() {
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: null
            });

            try {
                await salesforceService.connectToOrg('test-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Username and password');
            }
        });

        it('should handle OAuth connection type with error', async function() {
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'OAuth',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            });

            try {
                await salesforceService.connectToOrg('test-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('OAuth');
            }
        });

        it('should handle login failure', async function() {
            const mockConnection = {
                login: sandbox.stub().rejects(new Error('Invalid credentials'))
            };
            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'wrong-password',
                securityToken: 'token'
            });

            try {
                await salesforceService.connectToOrg('test-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to connect');
            }
        });
    });

    describe('Org Analysis (Mocked)', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should retrieve all objects from org', async function() {
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
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const objects = await salesforceService.analyzeOrg('test-org-id');

            expect(objects).to.be.an('array');
            expect(objects).to.have.lengthOf(3);
            expect(objects[0]).to.have.property('objectName', 'Account');
            expect(objects[0]).to.have.property('objectLabel', 'Account');
            expect(objects[0]).to.have.property('isCustom', false);
            expect(objects[2]).to.have.property('isCustom', true);
        });

        it('should handle empty org (no objects)', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describeGlobal: sandbox.stub().resolves({ sobjects: [] })
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const objects = await salesforceService.analyzeOrg('test-org-id');

            expect(objects).to.be.an('array');
            expect(objects).to.have.lengthOf(0);
        });

        it('should handle describeGlobal failure', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describeGlobal: sandbox.stub().rejects(new Error('API Error'))
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            try {
                await salesforceService.analyzeOrg('test-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to analyze org');
            }
        });
    });

    describe('Object Metadata Retrieval (Mocked)', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should retrieve detailed object metadata with fields', async function() {
            const mockDescribe = {
                name: 'Account',
                label: 'Account',
                custom: false,
                fields: [
                    {
                        name: 'Id',
                        label: 'Account ID',
                        type: 'id',
                        length: 18,
                        nillable: false,
                        custom: false,
                        picklistValues: null
                    },
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
                        name: 'Type',
                        label: 'Account Type',
                        type: 'picklist',
                        length: 40,
                        nillable: true,
                        custom: false,
                        picklistValues: [
                            { label: 'Prospect', value: 'Prospect' },
                            { label: 'Customer', value: 'Customer' },
                            { label: 'Partner', value: 'Partner' }
                        ]
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
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const metadata = await salesforceService.getObjectMetadata('test-org-id', 'Account');

            expect(metadata).to.have.property('objectName', 'Account');
            expect(metadata).to.have.property('objectLabel', 'Account');
            expect(metadata).to.have.property('isCustom', false);
            expect(metadata).to.have.property('fields');
            expect(metadata.fields).to.be.an('array');
            expect(metadata.fields).to.have.lengthOf(4);

            // Check field structure
            const nameField = metadata.fields.find(f => f.fieldName === 'Name');
            expect(nameField).to.exist;
            expect(nameField.fieldLabel).to.equal('Account Name');
            expect(nameField.dataType).to.equal('string');
            expect(nameField.length).to.equal(255);
            expect(nameField.isRequired).to.be.true;
            expect(nameField.isCustom).to.be.false;

            // Check picklist field
            const typeField = metadata.fields.find(f => f.fieldName === 'Type');
            expect(typeField).to.exist;
            expect(typeField.picklistValues).to.be.an('array');
            expect(typeField.picklistValues).to.have.lengthOf(3);
            expect(typeField.picklistValues[0]).to.deep.equal({ label: 'Prospect', value: 'Prospect' });
        });

        it('should handle custom object metadata', async function() {
            const mockDescribe = {
                name: 'CustomObject__c',
                label: 'Custom Object',
                custom: true,
                fields: [
                    {
                        name: 'CustomField__c',
                        label: 'Custom Field',
                        type: 'string',
                        length: 100,
                        nillable: true,
                        custom: true,
                        picklistValues: null
                    }
                ]
            };

            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describe: sandbox.stub().resolves(mockDescribe)
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const metadata = await salesforceService.getObjectMetadata('test-org-id', 'CustomObject__c');

            expect(metadata.isCustom).to.be.true;
            expect(metadata.fields[0].isCustom).to.be.true;
        });

        it('should handle object with no fields', async function() {
            const mockDescribe = {
                name: 'EmptyObject',
                label: 'Empty Object',
                custom: false,
                fields: []
            };

            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describe: sandbox.stub().resolves(mockDescribe)
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const metadata = await salesforceService.getObjectMetadata('test-org-id', 'EmptyObject');

            expect(metadata.fields).to.be.an('array');
            expect(metadata.fields).to.have.lengthOf(0);
        });

        it('should handle describe failure', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                describe: sandbox.stub().rejects(new Error('Object not found'))
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            try {
                await salesforceService.getObjectMetadata('test-org-id', 'InvalidObject');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to get object metadata');
            }
        });
    });

    describe('Record Count Retrieval (Mocked)', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should retrieve record count for object', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                query: sandbox.stub().resolves({ totalSize: 1234 })
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const count = await salesforceService.getRecordCount('test-org-id', 'Account');

            expect(count).to.equal(1234);
            expect(mockConnection.query.calledOnce).to.be.true;
            expect(mockConnection.query.firstCall.args[0]).to.equal('SELECT COUNT() FROM Account');
        });

        it('should return null on query failure', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                query: sandbox.stub().rejects(new Error('No access'))
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const count = await salesforceService.getRecordCount('test-org-id', 'RestrictedObject');

            expect(count).to.be.null;
        });

        it('should handle zero records', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                query: sandbox.stub().resolves({ totalSize: 0 })
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const count = await salesforceService.getRecordCount('test-org-id', 'EmptyObject');

            expect(count).to.equal(0);
        });
    });

    describe('Query Records (Mocked)', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should execute SOQL query and return records', async function() {
            const mockRecords = [
                { Id: '001xxx', Name: 'Account 1' },
                { Id: '001yyy', Name: 'Account 2' }
            ];

            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                query: sandbox.stub().resolves({ records: mockRecords })
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const records = await salesforceService.queryRecords('test-org-id', 'SELECT Id, Name FROM Account LIMIT 2');

            expect(records).to.be.an('array');
            expect(records).to.have.lengthOf(2);
            expect(records[0].Name).to.equal('Account 1');
        });

        it('should handle query with no results', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                query: sandbox.stub().resolves({ records: [] })
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const records = await salesforceService.queryRecords('test-org-id', 'SELECT Id FROM Account WHERE Name = \'NonExistent\'');

            expect(records).to.be.an('array');
            expect(records).to.have.lengthOf(0);
        });

        it('should handle query failure', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                query: sandbox.stub().rejects(new Error('Invalid SOQL'))
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            try {
                await salesforceService.queryRecords('test-org-id', 'INVALID QUERY');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Query failed');
            }
        });
    });

    describe('Test Connection (Mocked)', function() {
        let sandbox;

        beforeEach(function() {
            sandbox = sinon.createSandbox();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('should test connection and return identity', async function() {
            const mockIdentity = {
                user_id: '005xxx',
                username: 'test@example.com',
                organization_id: '00Dxxx',
                display_name: 'Test User'
            };

            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                identity: sandbox.stub().resolves(mockIdentity)
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'password',
                securityToken: 'token'
            });

            const result = await salesforceService.testConnection('test-org-id');

            expect(result).to.have.property('userId', '005xxx');
            expect(result).to.have.property('username', 'test@example.com');
            expect(result).to.have.property('orgId', '00Dxxx');
            expect(result).to.have.property('displayName', 'Test User');
        });

        it('should fail on invalid credentials', async function() {
            const mockConnection = {
                login: sandbox.stub().resolves({ id: 'test-user-id' }),
                identity: sandbox.stub().rejects(new Error('Unauthorized'))
            };

            sandbox.stub(jsforce, 'Connection').returns(mockConnection);
            sandbox.stub(SfOrg, 'findByPk').resolves({
                connectionType: 'Credentials',
                username: 'test@example.com',
                password: 'wrong-password',
                securityToken: 'token'
            });

            try {
                await salesforceService.testConnection('test-org-id');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Connection test failed');
            }
        });
    });

    describe('Live Integration Tests', function() {
        let testUser, testProject, testOrg1, testOrg2;

        before(async function() {
            // Create test user and project
            testUser = await User.create({
                email: 'salesforce-test@example.com',
                password: 'hashedpassword',
                firstname: 'Salesforce',
                lastname: 'Test',
                username: 'sftest'
            });

            testProject = await Project.create({
                name: 'Salesforce Integration Test Project',
                userId: testUser.id
            });

            // Get or create real test orgs
            testOrg1 = await getOrCreateTestOrg(SfOrg, 'superbadgeFormulas', testProject.id);
            testOrg2 = await getOrCreateTestOrg(SfOrg, 'superbadgeApexWebServices', testProject.id);
        });

        it('should connect to real Salesforce org (formulas)', async function() {
            const conn = await salesforceService.connectToOrg(testOrg1.id);
            expect(conn).to.exist;
            expect(conn.accessToken).to.exist;
        });

        it('should connect to real Salesforce org (apex web services)', async function() {
            const conn = await salesforceService.connectToOrg(testOrg2.id);
            expect(conn).to.exist;
            expect(conn.accessToken).to.exist;
        });

        it('should test connection to real org', async function() {
            const result = await salesforceService.testConnection(testOrg1.id);

            expect(result).to.have.property('userId');
            expect(result).to.have.property('username');
            expect(result).to.have.property('orgId');
            expect(result.orgId).to.equal(realOrgs.superbadgeFormulas.orgId);
        });

        it('should retrieve standard objects from real org', async function() {
            const objects = await salesforceService.analyzeOrg(testOrg1.id);

            expect(objects).to.be.an('array');
            expect(objects.length).to.be.greaterThan(0);

            // Check for standard objects
            const accountObj = objects.find(obj => obj.objectName === 'Account');
            expect(accountObj).to.exist;
            expect(accountObj.objectLabel).to.equal('Account');
            expect(accountObj.isCustom).to.be.false;

            const contactObj = objects.find(obj => obj.objectName === 'Contact');
            expect(contactObj).to.exist;
        });

        it('should retrieve detailed Account metadata from real org', async function() {
            const metadata = await salesforceService.getObjectMetadata(testOrg1.id, 'Account');

            expect(metadata).to.have.property('objectName', 'Account');
            expect(metadata).to.have.property('objectLabel', 'Account');
            expect(metadata).to.have.property('isCustom', false);
            expect(metadata).to.have.property('fields');
            expect(metadata.fields).to.be.an('array');
            expect(metadata.fields.length).to.be.greaterThan(10);

            // Check for standard fields
            const nameField = metadata.fields.find(f => f.fieldName === 'Name');
            expect(nameField).to.exist;
            expect(nameField.isRequired).to.be.true;

            const idField = metadata.fields.find(f => f.fieldName === 'Id');
            expect(idField).to.exist;
        });

        it('should retrieve detailed Contact metadata from real org', async function() {
            const metadata = await salesforceService.getObjectMetadata(testOrg1.id, 'Contact');

            expect(metadata).to.have.property('objectName', 'Contact');
            expect(metadata.fields).to.be.an('array');
            expect(metadata.fields.length).to.be.greaterThan(10);

            const lastNameField = metadata.fields.find(f => f.fieldName === 'LastName');
            expect(lastNameField).to.exist;
            expect(lastNameField.isRequired).to.be.true;
        });

        it('should get record count from real org', async function() {
            const count = await salesforceService.getRecordCount(testOrg1.id, 'Account');

            expect(count).to.be.a('number');
            expect(count).to.be.at.least(0);
        });

        it('should query records from real org', async function() {
            const records = await salesforceService.queryRecords(
                testOrg1.id,
                'SELECT Id, Name FROM Account LIMIT 5'
            );

            expect(records).to.be.an('array');
            if (records.length > 0) {
                expect(records[0]).to.have.property('Id');
                expect(records[0]).to.have.property('Name');
            }
        });

        it('should handle custom objects if they exist', async function() {
            const objects = await salesforceService.analyzeOrg(testOrg1.id);
            const customObjects = objects.filter(obj => obj.isCustom);

            // Just verify the flag works correctly
            customObjects.forEach(obj => {
                expect(obj.objectName).to.match(/__c$/);
            });
        });

        it('should retrieve User object metadata from real org', async function() {
            const metadata = await salesforceService.getObjectMetadata(testOrg1.id, 'User');

            expect(metadata).to.have.property('objectName', 'User');
            expect(metadata.fields).to.be.an('array');

            const usernameField = metadata.fields.find(f => f.fieldName === 'Username');
            expect(usernameField).to.exist;
        });

        it('should work with second org simultaneously', async function() {
            const [objects1, objects2] = await Promise.all([
                salesforceService.analyzeOrg(testOrg1.id),
                salesforceService.analyzeOrg(testOrg2.id)
            ]);

            expect(objects1).to.be.an('array');
            expect(objects2).to.be.an('array');
            expect(objects1.length).to.be.greaterThan(0);
            expect(objects2.length).to.be.greaterThan(0);
        });
    });
});
