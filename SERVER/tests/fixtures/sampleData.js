/**
 * Sample Test Data Fixtures
 *
 * Provides reusable sample data for testing
 */

const bcrypt = require('bcrypt');

/**
 * Sample user data
 */
const sampleUsers = {
    user1: {
        email: 'test1@example.com',
        password: 'Password123!',
        firstname: 'Test',
        lastname: 'User1',
        username: 'testuser1',
        role: 'user'
    },
    user2: {
        email: 'test2@example.com',
        password: 'Password123!',
        firstname: 'Test',
        lastname: 'User2',
        username: 'testuser2',
        role: 'admin'
    }
};

/**
 * Sample project data
 */
const sampleProjects = {
    project1: {
        name: 'Test Project 1',
        description: 'A test project for migration'
    },
    project2: {
        name: 'Test Project 2',
        description: 'Another test project'
    }
};

/**
 * Sample Salesforce org data
 */
const sampleSfOrgs = {
    sourceOrg: {
        name: 'Source Org',
        description: 'Source Salesforce organization',
        loginURL: 'https://login.salesforce.com',
        connectionType: 'Credentials',
        username: 'source@example.com',
        password: 'SourcePassword123',
        securityToken: 'SourceToken123'
    },
    targetOrg: {
        name: 'Target Org',
        description: 'Target Salesforce organization',
        loginURL: 'https://test.salesforce.com',
        connectionType: 'Credentials',
        username: 'target@example.com',
        password: 'TargetPassword123',
        securityToken: 'TargetToken123'
    },
    oauthOrg: {
        name: 'OAuth Org',
        description: 'OAuth-based connection',
        loginURL: 'https://login.salesforce.com',
        connectionType: 'OAuth',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    }
};

/**
 * Sample object metadata
 */
const sampleObjectMetadata = {
    account: {
        objectName: 'Account',
        objectLabel: 'Account',
        isCustom: false,
        recordCount: 1000
    },
    contact: {
        objectName: 'Contact',
        objectLabel: 'Contact',
        isCustom: false,
        recordCount: 5000
    },
    customObject: {
        objectName: 'CustomObject__c',
        objectLabel: 'Custom Object',
        isCustom: true,
        recordCount: 50
    }
};

/**
 * Sample field metadata
 */
const sampleFieldMetadata = {
    accountName: {
        fieldName: 'Name',
        fieldLabel: 'Account Name',
        dataType: 'string',
        length: 255,
        isRequired: true,
        isCustom: false
    },
    accountRevenue: {
        fieldName: 'AnnualRevenue',
        fieldLabel: 'Annual Revenue',
        dataType: 'currency',
        length: null,
        isRequired: false,
        isCustom: false
    },
    customField: {
        fieldName: 'CustomField__c',
        fieldLabel: 'Custom Field',
        dataType: 'string',
        length: 100,
        isRequired: false,
        isCustom: true
    }
};

/**
 * Helper function to create a user with hashed password
 */
async function createTestUser(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    return {
        ...userData,
        password: hashedPassword
    };
}

module.exports = {
    sampleUsers,
    sampleProjects,
    sampleSfOrgs,
    sampleObjectMetadata,
    sampleFieldMetadata,
    createTestUser
};
