import _ from 'exstream.js';
import fsService from './filesystemService.js';
import logger from '../lib/logger.js';
const log = logger.create('orgStatsService');

const helper = async function(conn, query){
    let ret = await conn.tooling.query(query);
    return ret.records;
}


async function calculateAndSaveOrgStats(conn, orgId) {
    // call the various function serially, then for each function, call the filesystem service to save the results in a common json file.
    const stats = {};
    try {
        stats.noUsers               = await getNoUsers(conn);
        stats.activeUsersCheckbox   = await getActiveUsersCheckbox(conn, stats.noUsers);
        stats.activeUsersLast30Days = await getActiveUsersLastXDays(conn, stats.noUsers, 30);
        stats.activeUsersLast90Days = await getActiveUsersLastXDays(conn, stats.noUsers, 90);
        stats.accessPercent         = await getAccessPercent(conn);
        stats.limits                = await getLimits(conn);
        stats.entitlements          = await getEntitlements(conn);
        stats.licenseLimits         = await getLicenseLimits(conn);
        //stats.objectLimits          = await getObjectLimits(conn);
        stats.unusedProfiles        = await getUnusedProfilesAndPS(conn, type => type === 'Profile');
        stats.unusedPermissionSets  = await getUnusedProfilesAndPS(conn, type => type === 'PermissionSet');
        stats.usedProfiles          = await getUsedProfilesAndPS(conn, type => type === 'Profile');
        stats.usedPermissionSets    = await getUsedProfilesAndPS(conn, type => type === 'PermissionSet');
        stats.storage               = await getStorage(conn);
        stats.customObjects         = await getCustomObjects(conn);
        stats.customFields          = await getCustomFields(conn, stats.customObjects);
        stats.recordTypes           = await getRecordTypes(conn);
        stats.apexTriggers          = await getApexTriggers(conn, stats.customObjects);
        stats.apexClasses           = await getApexClasses(conn);
        const flowsResult           = await getFlows(conn);
        stats.flows                 = flowsResult.flows;
        stats.processBuilderRules   = await getProcessBuilderRules(flowsResult.flowDefs);
        stats.workflowRules         = await getWorkflowRules(conn);
        stats.lwc                   = await getLWC(conn);
        stats.aura                  = await getAura(conn);
        stats.visualforce           = await getVisualforce(conn);
        stats.dangerousProfiles     = await getDangerousProfiles(conn);

        await fsService.saveOrgStatsToFile(orgId, stats);
        return stats;
    } catch (error) {
        log.error('Failed to calculate org stats', error, { orgId });
        throw error;
    }
}


async function getNoUsers(conn){
    log.info('getNoUsers started', {userInfo: conn.userInfo});
    const result = await conn.query('SELECT Id, Name FROM User');
    const users_no = result.totalSize;
    return users_no;
}


async function getActiveUsersCheckbox(conn, usersNo){
    log.info('getActiveUsersCheckbox started', {userInfo: conn.userInfo});
    const result = await conn.query('SELECT Name, IsActive FROM USER WHERE IsActive=true');
    return (result.totalSize / usersNo) * 100;
}


async function getActiveUsersLastXDays(conn, usersNo, days){
    log.info('getActiveUsersLastXDays started', {userInfo: conn.userInfo});
    const result = await conn.query('SELECT UserId FROM LoginHistory WHERE LoginTime= LAST_N_DAYS:'+days+ ' GROUP BY UserId');
    return (result.totalSize / usersNo) * 100;
}


async function getAccessPercent(conn) {
    log.info('getAccessPercent started', {userInfo: conn.userInfo});
    let mobile = 0;
    let desktop = 0;
    let total_access = 0;
    let result = await conn.query('SELECT COUNT(UserId), Application, Platform FROM LoginHistory GROUP BY Application, Platform')
        .on("record", (record) => {
            // excludes API access
            if(record.Platform!='Unknown'){
                total_access += record.expr0;
                record.Platform=='Android' || record.Platform=='iPhone'
                    ? mobile += record.expr0
                    : desktop += record.expr0;
            }
        })
        .on("error", (err) => {
            log.error('Error in getAccessPercent query', err);
        })
        .run({ autoFetch : true, maxFetch : 4000 }); // synonym of Query.execute();

    return {'Desktop Access %': (desktop / total_access) *100, 'Mobile Access %': (mobile / total_access) *100}
}


async function getLimits(conn){
    log.info('getLimits started', {userInfo: conn.userInfo});
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


async function getEntitlements(conn){
    log.info('getEntitlements started', {userInfo: conn.userInfo});
    const ret = await conn.query('SELECT MasterLabel, CurrentAmountAllowed, AmountUsed, Frequency FROM TenantUsageEntitlement');
    return _(ret.records).omit('attributes').values();
}


async function getLicenseLimits(conn){
    log.info('getLicenseLimits started', {userInfo: conn.userInfo});
    const ret = await conn.query('SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense ORDER BY Name');
    return _(ret.records).omit('attributes').values();
}


async function getObjectLimits(conn) {
    log.info('getObjectLimits started', {userInfo: conn.userInfo});
    const objectLimits = (await conn.tooling.query(conn, 'SELECT Id, DeveloperName, NamespacePrefix, IsCustomizable FROM EntityDefinition WHERE IsCustomizable = TRUE limit 25'))
        .records
        .map(async x => { return ( await helper(conn, 'SELECT Id, DurableId, Type, Label, Max, Remaining, EntityDefinition.DeveloperName FROM EntityLimit WHERE EntityDefinition.DeveloperName = \'' + x.DeveloperName + '\''))
            .map( x => ({
                SObject: x.EntityDefinition.DeveloperName,
                Type: x.Type,
                Label: x.Label,
                Max: x.Max,
                Remaining: x.Remaining,
                PercentageUsage: Math.round((x.Max - x.Remaining) / x.Max * 100)
            }))
        });
    return Promise.all(objectLimits);
}


async function getUnusedProfilesAndPS(conn, type){
    log.info('getUnusedProfilesAndPS started', {userInfo: conn.userInfo});
    const ret = await conn.query(`SELECT Id, Name, Profile.Name, NamespacePrefix, Type FROM PermissionSet WHERE IsCustom = TRUE AND Id NOT IN (SELECT PermissionSetId FROM PermissionSetAssignment)`);
    const unassignedPermissionSets = _(ret.records)
        .filter(x => type(x.Type))
        .map(x => ({
            Name: x.Type === 'Profile' ? x.Profile.Name : x.Name,
            Type: x.Type,
            Namespace: x.NamespacePrefix,
            Id: x.Id
        }))
        .sortBy((a, b) => a.Namespace + '_' + a.Name > b.Namespace + '_' + b.Name ? 1 : -1)
        .values();

    return unassignedPermissionSets;
}


async function getUsedProfilesAndPS(conn, type){
    log.info('getUsedProfilesAndPS started', {userInfo: conn.userInfo});
    const ret = await _(conn.query(`SELECT Id, Name, Profile.Name, NamespacePrefix, Type FROM PermissionSet WHERE IsCustom = TRUE AND Id IN (SELECT PermissionSetId FROM PermissionSetAssignment)`));
    const assignedPermissionSets = _(ret.records)
        .filter(x => type(x.Type))
        .map(x => ({
            Name: x.Type === 'Profile' ? x.Profile.Name : x.Name,
            Type: x.Type,
            Namespace: x.NamespacePrefix,
            Id: x.Id
        }))
        .sortBy((a, b) => a.Namespace + '_' + a.Name > b.Namespace + '_' + b.Name ? 1 : -1)
        .values();
    return assignedPermissionSets;
}


async function getStorage(conn){
    log.info('getStorage started', {userInfo: conn.userInfo});
    const recordCounts = await _(conn.request('/limits/recordCount'))
        .flatMap(x => x.sObjects)
        .map(x => ({ name: x.name, count: x.count }))
        .sortBy((a, b) => a.count > b.count ? -1 : 1)
        .values();
    return recordCounts;
}


async function getCustomObjects(conn){
    log.info('getCustomObjects started', {userInfo: conn.userInfo});
    // TODO return from DB
    // Custom Objects
    const objects = await conn.tooling.query('SELECT Id, NamespacePrefix, DeveloperName FROM CustomObject WHERE NamespacePrefix=null');
    return objects.records.map(x => ({
            Id: x.Id,
            SObject: x.DeveloperName,
            NamespacePrefix: x.NamespacePrefix,
    }));
}


async function getCustomFields(conn, customObjs){
    log.info('getCustomFields started', {userInfo: conn.userInfo});
    // TODO return from DB
    const fields = (await helper(conn, 'SELECT Id, NamespacePrefix, DeveloperName, TableEnumOrId FROM CustomField WHERE (NOT DeveloperName LIKE \'%del\') AND NamespacePrefix=null')) // check if we get deleted objects
    return fields.map(x => ({
        Id: x.Id,
        SObject: customObjs.find(c => c.Id === x.TableEnumOrId) !=null ? customObjs.find(c => c.Id === x.TableEnumOrId).SObject: x.TableEnumOrId,
        CustomField: x.DeveloperName,
        NamespacePrefix: x.NamespacePrefix,
    }));
}

async function getRecordTypes(conn){
    log.info('getRecordTypes started', {userInfo: conn.userInfo});
    const types = await conn.tooling.query('SELECT Id, NamespacePrefix, Name, SobjectType FROM RecordType WHERE IsActive=true');
    return types.records.map(x => ({
        Id: x.Id,
        SObject: x.SobjectType,
        RecordType: x.Name,
        NamespacePrefix: x.NamespacePrefix,
    }));
}

async function getApexTriggers(conn, customObjs){
    log.info('getApexTriggers started', {userInfo: conn.userInfo});
    const triggers = await conn.tooling.query('SELECT Id, NamespacePrefix, Name, TableEnumOrId, Status FROM ApexTrigger');
    return triggers.records.map(x => ({
        Id: x.Id,
        SObject: customObjs.find(c => c.Id === x.TableEnumOrId) !=null ? customObjs.find(c => c.Id === x.TableEnumOrId).SObject: x.TableEnumOrId,
        Trigger: x.Name,
        NamespacePrefix: x.NamespacePrefix,
        Status: x.Status
    }));
}

async function getApexClasses(conn){
    log.info('getApexClasses started', {userInfo: conn.userInfo});
    const apex = await conn.tooling.query('SELECT Id, NamespacePrefix, Name, Status FROM ApexClass');
    return apex.records.map(x => ({
        Id: x.Id,
        Class: x.Name,
        NamespacePrefix: x.NamespacePrefix,
        Status: x.Status
    }));
}

async function getFlows(conn) {
    log.info('getFlows started', {userInfo: conn.userInfo});
    const query = await conn.query('SELECT Id, ApiName, ProcessType, TriggerType, NamespacePrefix, IsActive, IsTemplate, Builder, ManageableState, InstalledPackageName FROM FlowDefinitionView WHERE IsActive=true');
    let flows = query.records
        .filter(x=>x.ProcessType!=='Workflow')
        .map(x => ({
            Id: x.Id,
            Flow: x.ApiName,
            ProcessType: x.ProcessType,
            TriggerType: x.TriggerType,
            IsActive: x.IsActive,
            RecordTriggerType: x.RecordTriggerType,
            NamespacePrefix: x.NamespacePrefix,
        }
        ));
    return {'flowDefs': query.records, 'flows': flows };
}


async function getProcessBuilderRules(flowDefs){
    log.info('getProcessBuilderRules started');
    if (!flowDefs || flowDefs.length === 0)
        return [];
    const workflowRules = flowDefs.filter(x=>x.ProcessType=='Workflow');
    if (!workflowRules || workflowRules.length === 0)
        return [];
    return workflowRules.map(x => ({
        Id: x.Id,
        Flow: x.ApiName,
        ProcessType: x.ProcessType,
        TriggerType: x.TriggerType,
        IsActive: x.IsActive,
        RecordTriggerType: x.RecordTriggerType,
        NamespacePrefix: x.NamespacePrefix,
    }));
}

async function getWorkflowRules(conn){
    log.info('getWorkflowRules started', {userInfo: conn.userInfo});
    const result = await conn.tooling.query('SELECT Id, ManageableState, Name, NamespacePrefix, TableEnumOrId from WorkflowRule');
    return result.records.map(x => ({
        Id: x.Id,
        Workflow: x.Name,
        ManageableState: x.ManageableState,
        TableEnumOrId: x.TableEnumOrId,
        NamespacePrefix: x.NamespacePrefix,
    }));
}


async function getLWC(conn){
    log.info('getLWC started', {userInfo: conn.userInfo});
    const lwcs = await conn.tooling.query('SELECT Id, DeveloperName, ManageableState, NamespacePrefix, TargetConfigs FROM LightningComponentBundle');
    return lwcs.records.map(x => ({
        Id: x.Id,
        LWC: x.DeveloperName,
        NamespacePrefix: x.NamespacePrefix,
        ManageableState: x.ManageableState
    }));
}

async function getAura(conn){
    log.info('getAura started', {userInfo: conn.userInfo});
    const auras = await conn.tooling.query('SELECT Id, DeveloperName, ManageableState, NamespacePrefix FROM AuraDefinitionBundle');
    return auras.records.map(x => ({
        Id: x.Id,
        Aura: x.DeveloperName,
        NamespacePrefix: x.NamespacePrefix,
        ManageableState: x.ManageableState
    }));
}


async function getVisualforce(conn){
    log.info('getVisualforce started', {userInfo: conn.userInfo});
    const vfs = await conn.tooling.query('SELECT Id, Name, ManageableState, NamespacePrefix, ControllerKey, ControllerType FROM ApexPage');
    return vfs.records.map(x => ({
        Id: x.Id,
        Visualforce: x.Name,
        NamespacePrefix: x.NamespacePrefix,
        ControllerKey: x.ControllerKey,
        ManageableState: x.ManageableState
    }));
}


async function getDangerousProfiles(conn){
    log.info('getDangerousProfiles started', {userInfo: conn.userInfo});
    const permissionSetDescribe = await conn.request('/sobjects/PermissionSet/describe');
    const hasEncryption = permissionSetDescribe.fields.some(x => x.name === 'PermissionsManageEncryptionKeys');

    const dang = await conn.query(
        'SELECT Id, Name, Profile.Name, NamespacePrefix, Type,' +
        `${(hasEncryption ? 'PermissionsManageEncryptionKeys,' : '')}` +
        'PermissionsViewSetup,' +
        'PermissionsManageProfilesPermissionsets,' +
        'PermissionsManagePasswordPolicies,' +
        'PermissionsAssignPermissionSets,' +
        'PermissionsAuthorApex,' +
        'PermissionsBulkApiHardDelete,' +
        'PermissionsManageRoles,' +
        'PermissionsManageSessionPermissionSets,' +
        'PermissionsManageSharing,' +
        'PermissionsManageNetworks,' +
        'PermissionsManageUsers,' +
        'PermissionsModifyAllData,' +
        'PermissionsManageCertificates,' +
        'PermissionsManageCustomPermissions,' +
        'PermissionsViewEncryptedData,' +
        'PermissionsManageLoginAccessPolicies,' +
        'PermissionsViewAllData,' +
        'PermissionsManageIpAddresses,' +
        '(SELECT AssigneeId, Assignee.Name, Assignee.IsActive FROM Assignments WHERE Assignee.IsActive=true)' +

        ' FROM PermissionSet WHERE Id IN ( SELECT PermissionSetId FROM PermissionSetAssignment) ' +
        ' AND (' +
            `${(hasEncryption ? 'PermissionsManageEncryptionKeys=TRUE' : '')}` +
            ' OR PermissionsViewSetup=TRUE' +
            ' OR PermissionsManageProfilesPermissionsets=TRUE' +
            ' OR PermissionsManagePasswordPolicies=TRUE' +
            ' OR PermissionsAssignPermissionSets=TRUE' +
            ' OR PermissionsAuthorApex=TRUE' +
            ' OR PermissionsBulkApiHardDelete=TRUE' +
            ' OR PermissionsManageRoles=TRUE' +
            ' OR PermissionsManageSessionPermissionSets=TRUE' +
            ' OR PermissionsManageSharing=TRUE' +
            ' OR PermissionsManageNetworks=TRUE' +
            ' OR PermissionsManageUsers=TRUE' +
            ' OR PermissionsModifyAllData=TRUE' +
            ' OR PermissionsManageCertificates=TRUE' +
            ' OR PermissionsManageCustomPermissions=TRUE' +
            ' OR PermissionsViewEncryptedData=TRUE' +
            ' OR PermissionsManageLoginAccessPolicies=TRUE' +
            ' OR PermissionsViewAllData=TRUE' +
            ' OR PermissionsManageIpAddresses=TRUE' +
        ')'
    );


    // omit attributes
    let records = dang.records;
    records.forEach(function(e){ delete e.attributes});
    records
        .map(x => ({ ...x, 'Profile Name': x.Profile?.Name }))
        .map(x => {
            const res = {}
            for (const [k, v] of Object.entries(x)) {
                if (k.startsWith('Permissions'))
                    res[k.replace('Permissions', '')] = v
                else
                    res[k] = v
            }
            return res
        });
    return records;
}


export default {
    calculateAndSaveOrgStats,
}
