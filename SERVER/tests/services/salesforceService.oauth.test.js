/**
 * OAuth Connection Tests for Salesforce Service
 * Tests OAuth 2.0 username-password flow
 */

const { expect } = require('chai');
const salesforceService = require('../../src/services/salesforceService');
const { SfOrg } = require('../../models');

describe('Salesforce Service - OAuth Connection Tests', function() {
    this.timeout(30000);

    let testOrgs = [];

    before(async function() {
        // Find all orgs with OAuth connection type
        testOrgs = await SfOrg.findAll({
            where: { connectionType: 'OAuth' }
        });

        if (testOrgs.length === 0) {
            console.log('\n⚠️  No OAuth orgs found in database. Skipping OAuth tests.\n');
            this.skip();
        } else {
            console.log(`\n✅ Found ${testOrgs.length} OAuth org(s) for testing\n`);
            testOrgs.forEach((org, index) => {
                console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`);
                console.log(`      Login URL: ${org.loginURL}`);
                console.log(`      Username: ${org.username}`);
                console.log(`      Client ID: ${org.clientId?.substring(0, 15)}...`);
                console.log('');
            });
        }
    });

    describe('OAuth Connection with Client ID/Secret', function() {
        testOrgs.forEach((org, index) => {
            describe(`OAuth Org ${index + 1}: ${org.name}`, function() {

                it('should have all required OAuth credentials', function() {
                    expect(org.clientId).to.exist.and.not.be.empty;
                    expect(org.clientSecret).to.exist.and.not.be.empty;
                    expect(org.username).to.exist.and.not.be.empty;
                    expect(org.password).to.exist.and.not.be.empty;
                });

                it('should validate username is in email format', function() {
                    expect(org.username).to.match(/@/);
                    console.log(`      ✓ Username format valid: ${org.username}`);
                });

                it('should connect to Salesforce using OAuth', async function() {
                    try {
                        console.log(`\n      🔌 Attempting OAuth connection to: ${org.name}`);
                        console.log(`         Login URL: ${org.loginURL}`);
                        console.log(`         Username: ${org.username}`);
                        console.log(`         Client ID: ${org.clientId.substring(0, 20)}...`);

                        const conn = await salesforceService.connectToOrg(org.id);

                        expect(conn).to.exist;
                        expect(conn.accessToken).to.exist;
                        expect(conn.instanceUrl).to.exist;

                        console.log(`      ✅ Connected successfully!`);
                        console.log(`         Instance URL: ${conn.instanceUrl}`);
                        console.log(`         Access Token: ${conn.accessToken.substring(0, 20)}...`);
                    } catch (error) {
                        console.error(`\n      ❌ Connection failed for ${org.name}:`);
                        console.error(`         Error: ${error.message}`);
                        console.error(`\n         Troubleshooting:`);
                        console.error(`         1. Verify Connected App is created in Salesforce`);
                        console.error(`         2. Check Consumer Key (Client ID) is correct`);
                        console.error(`         3. Check Consumer Secret is correct`);
                        console.error(`         4. Ensure username/password/token are correct`);
                        console.error(`         5. Check if user has API access enabled`);
                        console.error(`         6. Verify loginURL matches org type (test.salesforce.com vs login.salesforce.com)`);
                        throw error;
                    }
                });

                it('should test connection and get user identity', async function() {
                    try {
                        const identity = await salesforceService.testConnection(org.id);

                        expect(identity).to.exist;
                        expect(identity.userId).to.exist;
                        expect(identity.username).to.exist;
                        expect(identity.orgId).to.exist;

                        console.log(`\n      ✅ Identity retrieved:`);
                        console.log(`         User ID: ${identity.userId}`);
                        console.log(`         Username: ${identity.username}`);
                        console.log(`         Org ID: ${identity.orgId}`);
                        console.log(`         Display Name: ${identity.displayName}`);
                    } catch (error) {
                        console.error(`\n      ❌ Identity test failed: ${error.message}`);
                        throw error;
                    }
                });

                it('should analyze org and retrieve objects', async function() {
                    try {
                        console.log(`\n      📊 Analyzing org: ${org.name}`);

                        const objects = await salesforceService.analyzeOrg(org.id);

                        expect(objects).to.be.an('array');
                        expect(objects.length).to.be.greaterThan(0);

                        console.log(`      ✅ Found ${objects.length} objects`);
                        console.log(`         Sample objects: ${objects.slice(0, 5).map(o => o.objectName).join(', ')}`);
                    } catch (error) {
                        console.error(`\n      ❌ Org analysis failed: ${error.message}`);
                        throw error;
                    }
                });

                it('should get metadata for Account object', async function() {
                    try {
                        console.log(`\n      🔍 Getting Account metadata`);

                        const metadata = await salesforceService.getObjectMetadata(org.id, 'Account');

                        expect(metadata).to.exist;
                        expect(metadata.objectName).to.equal('Account');
                        expect(metadata.fields).to.be.an('array');
                        expect(metadata.fields.length).to.be.greaterThan(0);

                        console.log(`      ✅ Retrieved ${metadata.fields.length} fields for Account`);
                        console.log(`         Sample fields: ${metadata.fields.slice(0, 5).map(f => f.fieldName).join(', ')}`);
                    } catch (error) {
                        console.error(`\n      ❌ Metadata fetch failed: ${error.message}`);
                        throw error;
                    }
                });

                it('should execute SOQL query', async function() {
                    try {
                        console.log(`\n      🔍 Executing SOQL query`);

                        const records = await salesforceService.queryRecords(
                            org.id,
                            'SELECT Id, Name FROM Account LIMIT 5'
                        );

                        expect(records).to.be.an('array');

                        console.log(`      ✅ Query returned ${records.length} records`);
                        if (records.length > 0) {
                            console.log(`         First record: ${records[0].Name || 'N/A'}`);
                        }
                    } catch (error) {
                        console.error(`\n      ❌ Query failed: ${error.message}`);
                        throw error;
                    }
                });
            });
        });
    });

    describe('OAuth Error Handling', function() {
        it('should handle missing Client ID gracefully', async function() {
            const badOrg = await SfOrg.create({
                name: 'Test Bad OAuth Org',
                loginURL: 'https://login.salesforce.com',
                connectionType: 'OAuth',
                username: 'test@example.com',
                password: 'password',
                clientId: null,
                clientSecret: 'secret',
                projectId: '00000000-0000-4000-8000-000000000000'
            });

            try {
                await salesforceService.connectToOrg(badOrg.id);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('clientId');
            } finally {
                await badOrg.destroy();
            }
        });

        it('should handle invalid credentials', async function() {
            const badOrg = await SfOrg.create({
                name: 'Test Invalid Creds Org',
                loginURL: 'https://login.salesforce.com',
                connectionType: 'OAuth',
                username: 'invalid@example.com',
                password: 'wrongpassword',
                clientId: '3MVG9invalid',
                clientSecret: 'invalidsecret',
                projectId: '00000000-0000-4000-8000-000000000000'
            });

            try {
                await salesforceService.connectToOrg(badOrg.id);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Failed to connect');
            } finally {
                await badOrg.destroy();
            }
        });
    });

    describe('Credentials Type with Environment Variables', function() {
        let credsOrg;

        before(async function() {
            // Check if .env has SF_CLIENT_ID and SF_CLIENT_SECRET
            if (!process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET) {
                console.log('\n⚠️  SF_CLIENT_ID or SF_CLIENT_SECRET not found in .env');
                console.log('   Skipping Credentials type tests with environment variables.\n');
                this.skip();
                return;
            }

            // Find a Credentials type org
            credsOrg = await SfOrg.findOne({
                where: { connectionType: 'Credentials' }
            });

            if (!credsOrg) {
                console.log('\n⚠️  No Credentials type org found. Skipping.\n');
                this.skip();
            }
        });

        it('should connect using Credentials type with env variables', async function() {
            console.log(`\n      🔌 Testing Credentials type with .env OAuth credentials`);
            console.log(`         Org: ${credsOrg.name}`);
            console.log(`         Using SF_CLIENT_ID from .env: ${process.env.SF_CLIENT_ID.substring(0, 20)}...`);

            try {
                const conn = await salesforceService.connectToOrg(credsOrg.id);

                expect(conn).to.exist;
                expect(conn.accessToken).to.exist;

                console.log(`      ✅ Connection successful with env OAuth credentials!`);
            } catch (error) {
                console.error(`\n      ❌ Connection failed: ${error.message}`);
                throw error;
            }
        });
    });
});
