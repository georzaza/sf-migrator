
const getStorage = async (conn) =>  {
  const recordCounts = await _(conn.request('/limits/recordCount'))
    .flatMap(x => x.sObjects)
    .map(x => ({ name: x.name, count: x.count }))
    .sortBy((a, b) => a.count > b.count ? -1 : 1)
    .values();

    return recordCounts;
}

const getLimits = async (conn) =>  {
  return await _(conn.request('/limits'))
  .flatMap(Object.entries)
  .map(([k, v]) => ({
    Name: k,
    Max: v.Max,
    Remaining: v.Remaining,
    PercentUsed: v.Max === 0 ? 0 : ((v.Max - v.Remaining) / v.Max * 100)
  }))
  .values();
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

module.exports = {
    getLimits,
    getStorage,
    getDangerousProfiles,
}
