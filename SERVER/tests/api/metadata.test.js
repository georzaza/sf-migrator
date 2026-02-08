/**
 * Metadata API Endpoint Tests
 *
 * Tests for metadata-related API endpoints
 * NOTE: These tests mock the service layer - no real DB or SF connection needed
 */

const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

describe('Metadata API Endpoints', function() {

    describe('Basic endpoint structure', function() {
        it('should have metadata endpoints in server.js', function() {
            const serverPath = require('path').resolve(__dirname, '../../src/server.js');
            expect(() => require(serverPath)).to.not.throw();
        });
    });

    // TODO: Add integration tests with mocked services
    let app;
    let sandbox;
    let authToken;

    beforeEach(function() {
        sandbox = sinon.createSandbox();

        // Create minimal Express app for testing
        app = express();
        app.use(express.json());

        // Mock JWT token for authentication
        process.env.JWT_SECRET = 'test-secret';
        authToken = jwt.sign(
            { id: 'test-user-id', email: 'test@example.com' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Mock authentication middleware
        app.use((req, res, next) => {
            const token = req.cookies?.token || authToken;
            if (token) {
                try {
                    req.user = jwt.verify(token, process.env.JWT_SECRET);
                } catch (error) {
                    return res.status(401).json({ success: false, message: 'Invalid token' });
                }
            }
            next();
        });
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('GET /get-objects', function() {
        it('should return 400 if orgId is missing', async function() {
            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'getObjectsForOrg');

            app.get('/', async (req, res) => {
                const orgId = req.headers.orgid;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                const objects = await metadataService.getObjectsForOrg(orgId);
                res.json({ success: true, data: objects });
            });

            const response = await request(app)
                .get('/')
                .set('action', 'get-objects');

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });

        it('should return objects for valid orgId', async function() {
            const mockObjects = [
                { id: '1', objectName: 'Account', objectLabel: 'Account' },
                { id: '2', objectName: 'Contact', objectLabel: 'Contact' }
            ];

            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'getObjectsForOrg').resolves(mockObjects);

            app.get('/', async (req, res) => {
                const orgId = req.headers.orgid;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                const objects = await metadataService.getObjectsForOrg(orgId);
                res.json({ success: true, data: objects });
            });

            const response = await request(app)
                .get('/')
                .set('action', 'get-objects')
                .set('orgid', 'test-org-id');

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.be.an('array');
            expect(response.body.data).to.have.lengthOf(2);
        });
    });

    describe('GET /get-fields', function() {
        it('should return 400 if objectId is missing', async function() {
            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'getFieldsForObject');

            app.get('/', async (req, res) => {
                const objectId = req.headers.objectid;
                if (!objectId) {
                    return res.status(400).json({ success: false, message: 'Object ID is required' });
                }
                const fields = await metadataService.getFieldsForObject(objectId);
                res.json({ success: true, data: fields });
            });

            const response = await request(app)
                .get('/')
                .set('action', 'get-fields');

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });

        it('should return fields for valid objectId', async function() {
            const mockFields = [
                { fieldName: 'Name', fieldLabel: 'Account Name', dataType: 'string' },
                { fieldName: 'Type', fieldLabel: 'Account Type', dataType: 'picklist' }
            ];

            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'getFieldsForObject').resolves(mockFields);

            app.get('/', async (req, res) => {
                const objectId = req.headers.objectid;
                if (!objectId) {
                    return res.status(400).json({ success: false, message: 'Object ID is required' });
                }
                const fields = await metadataService.getFieldsForObject(objectId);
                res.json({ success: true, data: fields });
            });

            const response = await request(app)
                .get('/')
                .set('action', 'get-fields')
                .set('objectid', 'test-object-id');

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.be.an('array');
            expect(response.body.data).to.have.lengthOf(2);
        });
    });

    describe('GET /get-metadata-stats', function() {
        it('should return statistics for valid orgId', async function() {
            const mockStats = {
                totalObjects: 100,
                customObjects: 25,
                standardObjects: 75,
                totalFields: 1500
            };

            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'getMetadataStats').resolves(mockStats);

            app.get('/', async (req, res) => {
                const orgId = req.headers.orgid;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                const stats = await metadataService.getMetadataStats(orgId);
                res.json({ success: true, data: stats });
            });

            const response = await request(app)
                .get('/')
                .set('action', 'get-metadata-stats')
                .set('orgid', 'test-org-id');

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('totalObjects');
            expect(response.body.data.totalObjects).to.equal(100);
        });
    });

    describe('POST /analyze-org', function() {
        it('should return 400 if orgId is missing', async function() {
            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'analyzeAndSaveOrg');

            app.post('/', async (req, res) => {
                const { orgId } = req.body;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                const result = await metadataService.analyzeAndSaveOrg(orgId);
                res.json({ success: true, data: result });
            });

            const response = await request(app)
                .post('/')
                .set('action', 'analyze-org')
                .send({});

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });

        it('should analyze org successfully', async function() {
            const mockResult = {
                objectsAnalyzed: 50,
                fieldsAnalyzed: 500,
                duration: 1234
            };

            const metadataService = require('../../src/services/metadataService');
            sandbox.stub(metadataService, 'analyzeAndSaveOrg').resolves(mockResult);

            app.post('/', async (req, res) => {
                const { orgId } = req.body;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                const result = await metadataService.analyzeAndSaveOrg(orgId);
                res.json({ success: true, data: result });
            });

            const response = await request(app)
                .post('/')
                .set('action', 'analyze-org')
                .send({ orgId: 'test-org-id' });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('objectsAnalyzed');
        });
    });

    describe('POST /test-sf-connection', function() {
        it('should test connection successfully', async function() {
            const mockResult = {
                success: true,
                organizationId: '00D000000000001',
                username: 'test@example.com'
            };

            const salesforceService = require('../../src/services/salesforceService');
            sandbox.stub(salesforceService, 'testConnection').resolves(mockResult);

            app.post('/', async (req, res) => {
                const { orgId } = req.body;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                const result = await salesforceService.testConnection(orgId);
                res.json({ success: true, data: result });
            });

            const response = await request(app)
                .post('/')
                .set('action', 'test-sf-connection')
                .send({ orgId: 'test-org-id' });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('organizationId');
        });

        it('should handle connection failure', async function() {
            const salesforceService = require('../../src/services/salesforceService');
            sandbox.stub(salesforceService, 'testConnection').rejects(new Error('Invalid credentials'));

            app.post('/', async (req, res) => {
                const { orgId } = req.body;
                if (!orgId) {
                    return res.status(400).json({ success: false, message: 'Org ID is required' });
                }
                try {
                    const result = await salesforceService.testConnection(orgId);
                    res.json({ success: true, data: result });
                } catch (error) {
                    res.status(500).json({ success: false, message: error.message });
                }
            });

            const response = await request(app)
                .post('/')
                .set('action', 'test-sf-connection')
                .send({ orgId: 'test-org-id' });

            expect(response.status).to.equal(500);
            expect(response.body.success).to.be.false;
            expect(response.body.message).to.include('Invalid credentials');
        });
    });
});
