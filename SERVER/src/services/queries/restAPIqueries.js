
const getStorage = async (conn) => {
    const res = await conn.request('/limits/recordCount') || {};
    const sObjects = Array.isArray(res.sObjects) ? res.sObjects : [];
    return sObjects
        .map(x => ({ name: x.name, count: Number(x.count) || 0 }))
        .sort((a, b) => b.count - a.count);
}

const getLimits = async (conn) => {
    const res = await conn.request('/limits') || {};
    return Object.entries(res).map(([key, val]) => {
        const max = Number(val?.Max || 0);
        const remaining = Number(val?.Remaining || 0);
        return {
            Name: key,
            Max: max,
            Remaining: remaining,
            PercentUsed: max === 0 ? 0 : ((max - remaining) / max) * 100
        };
    });
}

const getDangerousProfiles = async (conn) =>  {
    const permissionSetDescribe = await conn.request('/sobjects/PermissionSet/describe');
    const hasEncryption = permissionSetDescribe.fields.some(x => x.name === 'PermissionsManageEncryptionKeys');

    let dang = await conn.query('SELECT Id, Name, Profile.Name, NamespacePrefix, Type, PermissionsViewSetup,' +
    'PermissionsManageProfilesPermissionsets,PermissionsManagePasswordPolicies,PermissionsAssignPermissionSets, PermissionsAuthorApex,' +
    'PermissionsBulkApiHardDelete, PermissionsManageRoles,PermissionsManageSessionPermissionSets,PermissionsManageSharing,PermissionsManageNetworks,' +
    'PermissionsManageUsers,PermissionsModifyAllData,PermissionsManageCertificates,PermissionsManageCustomPermissions,' +
    (hasEncryption ? ' PermissionsManageEncryptionKeys, ' : '') +
    'PermissionsViewEncryptedData,PermissionsManageLoginAccessPolicies,PermissionsViewAllData,PermissionsManageIpAddresses, ' +
    '(SELECT AssigneeId, Assignee.Name, Assignee.IsActive FROM Assignments WHERE Assignee.IsActive=true) ' +
    'FROM PermissionSet WHERE Id IN (SELECT PermissionSetId FROM PermissionSetAssignment) ' +
    'AND ( PermissionsViewSetup = TRUE OR PermissionsManageProfilesPermissionsets = TRUE OR PermissionsManagePasswordPolicies = TRUE ' +
        'OR PermissionsAssignPermissionSets = TRUE OR PermissionsAuthorApex = TRUE OR PermissionsBulkApiHardDelete = TRUE OR PermissionsManageRoles = TRUE ' +
        'OR PermissionsManageSessionPermissionSets = TRUE OR PermissionsManageSharing = TRUE OR PermissionsManageNetworks = TRUE ' +
        'OR PermissionsManageUsers = TRUE OR PermissionsModifyAllData = TRUE OR PermissionsManageCertificates = TRUE OR PermissionsManageCustomPermissions = TRUE ' +
        (hasEncryption ? ' OR PermissionsManageEncryptionKeys = TRUE ' : '') +
        'OR PermissionsViewEncryptedData = TRUE OR PermissionsManageLoginAccessPolicies = TRUE OR PermissionsViewAllData = TRUE OR PermissionsManageIpAddresses = TRUE )');

    // omit attributes
    let records = dang.records;
    records.forEach(function(e){ delete e.attributes});
    records.map(x => ({ ...x, 'Profile Name': x.Profile?.Name }))
        .map(x => {
            const res = {}
            for (const [k, v] of Object.entries(x)) {
                k.startsWith('Permissions')
                    ? res[k.replace('Permissions', '')] = v
                    : res[k] = v
            }
            return res
    });
    return records;
}

export { getLimits, getStorage, getDangerousProfiles };
