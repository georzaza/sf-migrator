/**
 * Comprehensive API Integration Tests for Metadata Endpoints
 *
 * Tests the actual HTTP endpoints with real database and Salesforce connections
 */

const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { User, Project, SfOrg } = require('../../models');
const { realOrgs, getOrCreateTestOrg } = require('../fixtures/realOrgs');
const metadataService = require('../../src/services/metadataService');

describe('Metadata API - Integration Tests', function() {
    this.timeout(60000); // Increase timeout for real API calls

    let app, authToken, testUser, testProject, testOrg1, testOrg2;

    before(async function() {
        // Load the actual server app
        process.env.JWT_SECRET = 'test-jwt-secret-key';
        process.env.FRONTEND_URL = 'http://localhost:5173';

        // Create app but don't start server
        const express = require('express');
        const cors = require('cors');
        app = express();
        app.use(express.json());
        app.use(cors({
            origin: process.env.FRONTEND_URL,
            credentials: true
        }));

        // Register routes from actual server
        const authRoutes = require('../../src/routes/auth');
        const authMiddleware = require('../../src/middleware/authMiddleware');
        const sendResponse = require('../../src/utils/sendResponse');
        const salesforceService = require('../../src/services/salesforceService');
        const sfOrgService = require('../../src/services/sfOrgService');

        app.use('/auth', authRoutes);

        // GET endpoint from server.js
        app.get("/", authMiddleware, async (req, res) => {
            if (req.headers.action.toLowerCase() === 'get-objects') {
                const orgId = req.headers.orgid;
                if (!orgId) {
                    return sendResponse(res, 400, false, 'Org ID is required');
                }
                try {
                    const includeFields = req.query.includeFields === 'true';
                    const objects = await metadataService.getObjectsForOrg(orgId, { includeFields });
                    sendResponse(res, 200, true, 'Objects retrieved successfully', objects);
                } catch (error) {
                    console.error('Error retrieving objects:', error);
                    sendResponse(res, 500, false, 'Failed to retrieve objects');
                }
            }
            else if (req.headers.action.toLowerCase() === 'get-fields') {
                const objectId = req.headers.objectid;
                if (!objectId) {
                    return sendResponse(res, 400, false, 'Object ID is required');
                }
                try {
                    const fields = await metadataService.getFieldsForObject(objectId);
                    sendResponse(res, 200, true, 'Fields retrieved successfully', fields);
                } catch (error) {
                    console.error('Error retrieving fields:', error);
                    sendResponse(res, 500, false, 'Failed to retrieve fields');
                }
            }
            else if (req.headers.action.toLowerCase() === 'get-metadata-stats') {
                const orgId = req.headers.orgid;
                if (!orgId) {
                    return sendResponse(res, 400, false, 'Org ID is required');
                }
                try {
                    const stats = await metadataService.getMetadataStats(orgId);
                    sendResponse(res, 200, true, 'Metadata statistics retrieved successfully', stats);
                } catch (error) {
                    console.error('Error retrieving metadata statistics:', error);
                    sendResponse(res, 500, false, 'Failed to retrieve metadata statistics');
                }
            }
            else {
                res.status(400).json({ msg: 'Unknown GET action' });
            }
        });

        // POST endpoint from server.js
        app.post("/", authMiddleware, async (req, res) => {
            if (req.headers.action.toLowerCase() === 'analyze-org') {
                const { orgId, includeCustomOnly, excludeManaged } = req.body;
                if (!orgId) {
                    return sendResponse(res, 400, false, 'Org ID is required');
                }
                try {
                    const result = await metadataService.analyzeAndSaveOrg(orgId, {
                        includeCustomOnly,
                        excludeManaged
                    });
                    sendResponse(res, 200, true, 'Org analysis completed successfully', result);
                } catch (error) {
                    console.error('Error analyzing org:', error);
                    sendResponse(res, 500, false, error.message || 'Failed to analyze org');
                }
            }
            else if (req.headers.action.toLowerCase() === 'refresh-metadata') {
                const { orgId } = req.body;
                if (!orgId) {
                    return sendResponse(res, 400, false, 'Org ID is required');
                }
                try {
                    const result = await metadataService.refreshMetadata(orgId);
                    sendResponse(res, 200, true, 'Metadata refreshed successfully', result);
                } catch (error) {
                    console.error('Error refreshing metadata:', error);
                    sendResponse(res, 500, false, 'Failed to refresh metadata');
                }
            }
            else if (req.headers.action.toLowerCase() === 'test-sf-connection') {
                const { orgId } = req.body;
                if (!orgId) {
                    return sendResponse(res, 400, false, 'Org ID is required');
                }
                try {
                    const result = await salesforceService.testConnection(orgId);
                    sendResponse(res, 200, true, 'Connection test successful', result);
                } catch (error) {
                    console.error('Error testing connection:', error);
                    sendResponse(res, 500, false, error.message || 'Connection test failed');
                }
            }
            else {
                res.send(['Invalid Unknown POST Action']);
                res.end();
            }
        });

        // Create test user
        testUser = await User.create({
            email: 'api-integration@example.com',
            password: 'hashedpassword',
            firstname: 'API',
            lastname: 'Integration',
            username: 'apiintegration'
        });

        // Generate JWT token
        authToken = jwt.sign(
            { id: testUser.id, email: testUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Create test project
        testProject = await Project.create({
            name: 'API Integration Test Project',
            userId: testUser.id
        });

        // Get or create real test orgs
        testOrg1 = await getOrCreateTestOrg(SfOrg, 'superbadgeFormulas', testProject.id);
        testOrg2 = await getOrCreateTestOrg(SfOrg, 'superbadgeApexWebServices', testProject.id);
    });

    describe('POST /analyze-org - Live Integration', function() {
        it('should analyze real Salesforce org and save metadata', async function() {
            // Clean existing metadata first
            await metadataService.deleteOrgMetadata(testOrg1.id);

            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'analyze-org')
                .send({
                    orgId: testOrg1.id,
                    objectsToAnalyze: ['Account', 'Contact']
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.message).to.include('completed successfully');
            expect(response.body.data).to.have.property('objectsAnalyzed');
            expect(response.body.data.objectsAnalyzed).to.equal(2);
            expect(response.body.data).to.have.property('totalFields');
            expect(response.body.data.totalFields).to.be.greaterThan(0);
        });

        it('should return 400 when orgId is missing', async function() {
            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'analyze-org')
                .send({});

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
            expect(response.body.message).to.include('required');
        });

        it('should handle analyzing multiple objects', async function() {
            await metadataService.deleteOrgMetadata(testOrg2.id);

            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'analyze-org')
                .send({
                    orgId: testOrg2.id,
                    objectsToAnalyze: ['Account', 'Contact', 'Lead']
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.objectsAnalyzed).to.equal(3);
        });
    });

    describe('GET /get-objects - Live Integration', function() {
        before(async function() {
            // Ensure org1 has metadata
            const stats = await metadataService.getMetadataStats(testOrg1.id);
            if (stats.totalObjects === 0) {
                await metadataService.analyzeAndSaveOrg(testOrg1.id, {
                    objectsToAnalyze: ['Account', 'Contact']
                });
            }
        });

        it('should retrieve objects without fields', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-objects')
                .set('orgid', testOrg1.id);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.be.an('array');
            expect(response.body.data.length).to.be.greaterThan(0);
            expect(response.body.data[0]).to.have.property('objectName');
        });

        it('should retrieve objects with fields', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-objects')
                .set('orgid', testOrg1.id)
                .query({ includeFields: 'true' });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.be.an('array');
            expect(response.body.data[0]).to.have.property('fields');
            expect(response.body.data[0].fields).to.be.an('array');
        });

        it('should return 400 when orgId is missing', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-objects');

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });

        it('should return empty array for org with no metadata', async function() {
            const emptyOrg = await SfOrg.create({
                name: 'Empty API Test Org',
                projectId: testProject.id,
                loginURL: 'https://empty.salesforce.com',
                connectionType: 'Credentials',
                username: 'empty@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-objects')
                .set('orgid', emptyOrg.id);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.be.an('array');
            expect(response.body.data).to.have.lengthOf(0);
        });
    });

    describe('GET /get-fields - Live Integration', function() {
        let accountObjectId;

        before(async function() {
            const objects = await metadataService.getObjectsForOrg(testOrg1.id);
            const accountObj = objects.find(obj => obj.objectName === 'Account');
            if (accountObj) {
                accountObjectId = accountObj.id;
            }
        });

        it('should retrieve fields for object', async function() {
            if (!accountObjectId) {
                this.skip();
                return;
            }

            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-fields')
                .set('objectid', accountObjectId);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.be.an('array');
            expect(response.body.data.length).to.be.greaterThan(0);
            expect(response.body.data[0]).to.have.property('fieldName');
            expect(response.body.data[0]).to.have.property('dataType');
        });

        it('should return 400 when objectId is missing', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-fields');

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });
    });

    describe('GET /get-metadata-stats - Live Integration', function() {
        it('should retrieve metadata statistics', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-metadata-stats')
                .set('orgid', testOrg1.id);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('totalObjects');
            expect(response.body.data).to.have.property('customObjects');
            expect(response.body.data).to.have.property('standardObjects');
            expect(response.body.data).to.have.property('totalFields');
            expect(response.body.data).to.have.property('totalRecords');
        });

        it('should return zero stats for org with no metadata', async function() {
            const emptyOrg = await SfOrg.create({
                name: 'Empty Stats Org',
                projectId: testProject.id,
                loginURL: 'https://empty.salesforce.com',
                connectionType: 'Credentials',
                username: 'empty@sf.com',
                password: 'password',
                securityToken: 'token'
            });

            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-metadata-stats')
                .set('orgid', emptyOrg.id);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.totalObjects).to.equal(0);
            expect(response.body.data.totalFields).to.equal(0);
        });

        it('should return 400 when orgId is missing', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-metadata-stats');

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });
    });

    describe('POST /refresh-metadata - Live Integration', function() {
        it('should refresh metadata for org', async function() {
            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'refresh-metadata')
                .send({
                    orgId: testOrg1.id,
                    objectsToAnalyze: ['Account']
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.message).to.include('refreshed successfully');
        });

        it('should return 400 when orgId is missing', async function() {
            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'refresh-metadata')
                .send({});

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });
    });

    describe('POST /test-sf-connection - Live Integration', function() {
        it('should test connection to real Salesforce org', async function() {
            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'test-sf-connection')
                .send({ orgId: testOrg1.id });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('userId');
            expect(response.body.data).to.have.property('username');
            expect(response.body.data).to.have.property('orgId');
            expect(response.body.data.orgId).to.equal(realOrgs.superbadgeFormulas.orgId);
        });

        it('should handle invalid org credentials', async function() {
            const invalidOrg = await SfOrg.create({
                name: 'Invalid Credentials Org',
                projectId: testProject.id,
                loginURL: 'https://login.salesforce.com',
                connectionType: 'Credentials',
                username: 'invalid@example.com',
                password: 'wrongpassword',
                securityToken: 'wrongtoken'
            });

            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'test-sf-connection')
                .send({ orgId: invalidOrg.id });

            expect(response.status).to.equal(500);
            expect(response.body.success).to.be.false;
            expect(response.body.message).to.exist;
        });

        it('should return 400 when orgId is missing', async function() {
            const response = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'test-sf-connection')
                .send({});

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
        });
    });

    describe('Authentication Requirements', function() {
        it('should reject requests without auth token', async function() {
            const response = await request(app)
                .get('/')
                .set('action', 'get-objects')
                .set('orgid', testOrg1.id);

            expect(response.status).to.equal(401);
        });

        it('should reject requests with invalid auth token', async function() {
            const response = await request(app)
                .get('/')
                .set('Authorization', 'Bearer invalid-token')
                .set('action', 'get-objects')
                .set('orgid', testOrg1.id);

            expect(response.status).to.equal(401);
        });
    });

    describe('End-to-End Metadata Flow', function() {
        let flowTestOrg;

        before(async function() {
            flowTestOrg = await getOrCreateTestOrg(SfOrg, 'superbadgeFormulas', testProject.id);
            await metadataService.deleteOrgMetadata(flowTestOrg.id);
        });

        it('should complete full metadata workflow', async function() {
            // Step 1: Test connection
            const connectionResponse = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'test-sf-connection')
                .send({ orgId: flowTestOrg.id });

            expect(connectionResponse.status).to.equal(200);
            expect(connectionResponse.body.success).to.be.true;

            // Step 2: Analyze org
            const analyzeResponse = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'analyze-org')
                .send({
                    orgId: flowTestOrg.id,
                    objectsToAnalyze: ['Account', 'Contact']
                });

            expect(analyzeResponse.status).to.equal(200);
            expect(analyzeResponse.body.data.objectsAnalyzed).to.equal(2);

            // Step 3: Get metadata stats
            const statsResponse = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-metadata-stats')
                .set('orgid', flowTestOrg.id);

            expect(statsResponse.status).to.equal(200);
            expect(statsResponse.body.data.totalObjects).to.equal(2);

            // Step 4: Get objects with fields
            const objectsResponse = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-objects')
                .set('orgid', flowTestOrg.id)
                .query({ includeFields: 'true' });

            expect(objectsResponse.status).to.equal(200);
            expect(objectsResponse.body.data).to.have.lengthOf(2);
            expect(objectsResponse.body.data[0].fields).to.be.an('array');

            // Step 5: Get fields for specific object
            const accountObj = objectsResponse.body.data.find(obj => obj.objectName === 'Account');
            const fieldsResponse = await request(app)
                .get('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'get-fields')
                .set('objectid', accountObj.id);

            expect(fieldsResponse.status).to.equal(200);
            expect(fieldsResponse.body.data).to.be.an('array');
            expect(fieldsResponse.body.data.length).to.be.greaterThan(0);

            // Step 6: Refresh metadata
            const refreshResponse = await request(app)
                .post('/')
                .set('Authorization', `Bearer ${authToken}`)
                .set('action', 'refresh-metadata')
                .send({
                    orgId: flowTestOrg.id,
                    objectsToAnalyze: ['Account']
                });

            expect(refreshResponse.status).to.equal(200);
            expect(refreshResponse.body.success).to.be.true;
        });
    });
});
