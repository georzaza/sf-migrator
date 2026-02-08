/**
 * Real Salesforce Org Credentials for Integration Testing
 *
 * These are actual Salesforce org credentials that can be used for
 * integration tests against live Salesforce instances.
 */

/**
 * Real Salesforce orgs provided for testing
 * These orgs exist in the database and can be used for testing
 */
const realOrgs = {
    superbadgeFormulas: {
        name: 'Superbadge: Formulas',
        description: 'Dev Edition',
        orgId: '00Dd200000UJcIe',
        loginURL: 'https://deloittegrsuperbadgeformula-dev-ed.develop.my.salesforce.com',
        connectionType: 'Credentials',
        username: 'gzazanis@deloitte.gr_superbadge_formulas',
        password: '6u1nxqD6a@',
        securityToken: 'zKDXzphgZaWxeSdivLEmkxB53',
        email: 'gmail',
        instanceUrl: 'https://deloittegrsuperbadgeformula-dev-ed.develop.my.salesforce.com',
        clientId: '3MVG9YFqzc_KnL.yKgyiri.fuca75.r.8qiAz8d_FIEy09rnsWIXi3b.KlZfHrqRQzY6MaUBcGmrlC3MSO969',
        clientSecret: '37B38F0ECA9761FCD1802354D6BBA8E784F9E656C84818025A0151FB7A395D08'
    },
    superbadgeApexWebServices: {
        name: 'Superbadge: Apex Web Services',
        description: 'Dev Edition',
        orgId: '00DQy00000ddMNF',
        loginURL: 'https://deloittegrsuperbadgeape-12f-dev-ed.develop.my.salesforce.com',
        connectionType: 'Credentials',
        username: 'gzazanis@deloitte.gr_superbadge_apex_web_services',
        password: '6u1nxqD6a!',
        securityToken: 'aoUzg5oH5F20AG50xiEdTfLg',
        email: 'gmail',
        instanceUrl: 'https://deloittegrsuperbadgeape-12f-dev-ed.develop.my.salesforce.com'
    }
};

/**
 * Helper to create org record for database
 * @param {string} orgKey - Key from realOrgs
 * @param {string} projectId - Project UUID
 * @returns {Object} Org data ready for DB insertion
 */
function createOrgRecord(orgKey, projectId) {
    const org = realOrgs[orgKey];
    return {
        name: org.name,
        description: org.description,
        loginURL: org.loginURL,
        connectionType: org.connectionType,
        username: org.username,
        password: org.password,
        securityToken: org.securityToken,
        projectId: projectId,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

/**
 * Check if org exists by username
 * @param {Object} SfOrg - Sequelize model
 * @param {string} username - Org username
 * @returns {Promise<Object|null>} Org if exists, null otherwise
 */
async function findOrgByUsername(SfOrg, username) {
    return await SfOrg.findOne({ where: { username } });
}

/**
 * Get or create test org
 * @param {Object} SfOrg - Sequelize model
 * @param {string} orgKey - Key from realOrgs
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object>} Org record
 */
async function getOrCreateTestOrg(SfOrg, orgKey, projectId) {
    const org = realOrgs[orgKey];
    const [record, created] = await SfOrg.findOrCreate({
        where: { username: org.username },
        defaults: createOrgRecord(orgKey, projectId)
    });
    return record;
}

module.exports = {
    realOrgs,
    createOrgRecord,
    findOrgByUsername,
    getOrCreateTestOrg
};
