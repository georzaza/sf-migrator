/**
 *  Tooling limits: /services/data/vXX.X/limits
 *  Each query may create a cursor if results > 2000 rows.
 *      Max open cursors per user: 50
 *      Cursor timeout: 15 minutes
 *  Slow Objects: (not a full list)
 *      EntityDefinition
 *      FieldDefinition
 */
const toolingQueries = {
    users           : 'SELECT Id, Name, IsActive FROM User',
    lwcs            : 'SELECT Id, DeveloperName, ManageableState, TargetConfigs FROM LightningComponentBundle',
    auras           : 'SELECT Id, DeveloperName, ManageableState FROM AuraDefinitionBundle',
    loginHistories  : 'SELECT UserId, LoginTime, Application, Platform FROM LoginHistory',
    entitlements    : 'SELECT MasterLabel, CurrentAmountAllowed, AmountUsed, Frequency FROM TenantUsageEntitlement',
    licenseLimits   : 'SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense ORDER BY Name',
    apexTriggers    : 'SELECT Id, Name, TableEnumOrId, Status FROM ApexTrigger',
    apexClasses     : 'SELECT Id, Name, Status FROM ApexClass',
    recordTypes     : 'SELECT Id, Name, SobjectType, IsActive FROM RecordType',
    customObjects   : 'SELECT Id, DeveloperName FROM CustomObject',
    customFields    : 'SELECT Id, DeveloperName, TableEnumOrId FROM CustomField',
    entityLimits    : 'SELECT Id, DurableId, Type, Label, Max, Remaining, EntityDefinition.DeveloperName FROM EntityLimit',
    entityDefinitions : 'SELECT Id, DeveloperName, IsCustomizable FROM EntityDefinition',
    visualforcePages  : 'SELECT Id, Name, ManageableState, ControllerKey, ControllerType FROM ApexPage',
    flowsAndWorkflows : 'SELECT Id, ApiName, ProcessType, TriggerType, IsActive, IsTemplate, Builder, ManageableState, InstalledPackageName FROM FlowDefinitionView',
    workflowRules     : 'SELECT Id, Name, TableEnumOrId from WorkflowRule',
    permissionSets    : 'SELECT Id, Name, Profile.Name, Type, IsCustom FROM PermissionSet',
    permissionSetAssignments : 'SELECT AssigneeId, PermissionSetId from PermissionSetAssignment',
    profiles :'...',
    userRoles : '...',
    tbd: '...'
};

export default {
  toolingQueries,
}

/* TODO
const helper = async function(conn, query){
  let ret = await conn.tooling.query(query);
  return ret.records;
}

async function getNoUsers(conn){
  console.log('Users No');
  // retrieve number of users
  let result = await conn.query('SELECT Id, Name FROM User');
  let users_no = result.totalSize;
  return users_no;
}

async function getActiveUsersCheckbox(conn, usersNo){
  console.log('Active Users');
  let result = await conn.query('SELECT Name, IsActive FROM USER WHERE IsActive=true');
  return (result.totalSize / usersNo) * 100;
}

async function getActiveUsersLastXDays(conn, usersNo, days){
  console.log('Active Users Last X Days');
  result = await conn.query('SELECT UserId FROM LoginHistory WHERE LoginTime= LAST_N_DAYS:'+days+ ' GROUP BY UserId');
  return (result.totalSize / usersNo) * 100;
}

async function getAccessPercent(conn) {
  console.log('Access');
  let mobile = 0;
  let desktop = 0;
  let total_access = 0;
  result = await conn.query('SELECT COUNT(UserId), Application, Platform FROM LoginHistory GROUP BY Application, Platform')
  .on("record", (record) => {
    // excludes API access
    if(record.Platform!='Unknown'){
      total_access += record.expr0;
      if(record.Platform=='Android' || record.Platform=='iPhone'){
        mobile += record.expr0;
      } else {
        desktop += record.expr0;
      }
    }
  })
  .on("error", (err) => {
    console.error(err);
  })
  .run({ autoFetch : true, maxFetch : 4000 }); // synonym of Query.execute();

  return {'Desktop Access %': (desktop / total_access) *100, 'Mobile Access %': (mobile / total_access) *100}
}

async function getPPEM(conn) {
  console.log('Event Monitoring');
  let res = await _(Object.entries(config))
  .map(
    async ([logFile, options]) => {
    let query = await conn.query(getEmQuery(logFile));
    const s = _(query.records).map(async x => _(await conn.request('/sobjects/EventLogFile/'+x.Id+'/LogFile'))).resolve()
    .merge(5);
    const s2 = s
          .fork()
          .through(cfgPost[logFile])
          .toPromise()
          .then((values) => {
            return values;
          });

          // return s2;
          return {logFile: logFile, result: await s2};

  }).resolve().toPromise();// .then(x=>console.log('Outside', x));

  return res;
}


async function getEntitlements(conn){
  console.log('Entitlement Limits');
  let ret = await conn.query('SELECT MasterLabel, CurrentAmountAllowed, AmountUsed, Frequency FROM TenantUsageEntitlement');

  return _(ret.records).omit('attributes').values();
}

async function getLicenseLimits(conn){
  console.log('License Limits');
  let ret = await conn.query('SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense ORDER BY Name');

  return _(ret.records).omit('attributes').values();

}

async function getObjectLimits(conn) {
  console.log('Object Limits');
  let objectLimits = (await helper(conn, 'SELECT Id, DeveloperName, NamespacePrefix, IsCustomizable FROM EntityDefinition WHERE IsCustomizable = TRUE limit 25'))
  .map(async x => { return ( await helper(conn, 'SELECT Id, DurableId, Type, Label, Max, Remaining, EntityDefinition.DeveloperName FROM EntityLimit WHERE EntityDefinition.DeveloperName = \'' + x.DeveloperName + '\''))
    .map( x =>
      ({SObject: x.EntityDefinition.DeveloperName,
              Type: x.Type,
              Label: x.Label,
              Max: x.Max,
              Remaining: x.Remaining,
              PercentageUsage: Math.round((x.Max - x.Remaining) / x.Max * 100)
      })
    )
  });

  return Promise.all(objectLimits);
}

async function getUnusedProfilesAndPS(conn, type){
  console.log('Unused: ', type)
  let ret = await conn.query(`
    SELECT
      Id,
      Name,
      Profile.Name,
      NamespacePrefix,
      Type
    FROM PermissionSet
    WHERE IsCustom = TRUE
      AND Id NOT IN (SELECT PermissionSetId FROM PermissionSetAssignment)
  `);

  let unassignedPermissionSets = _(ret.records)
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
  console.log('Used: ', type);
  let ret = await _(conn.query(`
    SELECT
      Id,
      Name,
      Profile.Name,
      NamespacePrefix,
      Type
    FROM PermissionSet
    WHERE IsCustom = TRUE
      AND Id IN (SELECT PermissionSetId FROM PermissionSetAssignment)
  `));

  let assignedPermissionSets = _(ret.records)
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


async function getCustomObjects(conn){
  // Custom Objects
  console.log('Custom Objects');
  let objects = (await helper(conn, 'SELECT Id, NamespacePrefix, DeveloperName FROM CustomObject WHERE NamespacePrefix=null'))
  .map(x =>
    ({      Id: x.Id,
            SObject: x.DeveloperName,
            NamespacePrefix: x.NamespacePrefix,
    }));
    return objects;
}

// get all custom objects for finding where the custom fields are created
// Could be merged with the getCustomObjects function for optimizing queries
async function getAllCustomObjects(conn){
  let customObjs = (await helper(conn, 'SELECT Id, NamespacePrefix, DeveloperName FROM CustomObject'))
  .map(x =>
    ({      Id: x.Id,
            SObject: x.DeveloperName,
            NamespacePrefix: x.NamespacePrefix,
    }));

    return customObjs;
}

async function getCustomFields(conn, customObjs){
  console.log('Custom Fields');

  let fields = (await helper(conn, 'SELECT Id, NamespacePrefix, DeveloperName, TableEnumOrId FROM CustomField WHERE (NOT DeveloperName LIKE \'%del\') AND NamespacePrefix=null')) // check if we get deleted objects
  .map(x =>
    ({      Id: x.Id,
            SObject: customObjs.find(c => c.Id === x.TableEnumOrId) !=null ? customObjs.find(c => c.Id === x.TableEnumOrId).SObject: x.TableEnumOrId,
            CustomField: x.DeveloperName,
            NamespacePrefix: x.NamespacePrefix,
    }));

    return fields;
}

async function getRecordTypes(conn){
  console.log('RecordTypes');
  let types = (await helper(conn, 'SELECT Id, NamespacePrefix, Name, SobjectType FROM RecordType WHERE IsActive=true'))
  .map(x =>
    ({      Id: x.Id,
            SObject: x.SobjectType,
            RecordType: x.Name,
            NamespacePrefix: x.NamespacePrefix,
    }));

    return types;
}

async function getApexTriggers(conn, customObjs){
  console.log('Apex Triggers');
  let triggers = (await helper(conn, 'SELECT Id, NamespacePrefix, Name, TableEnumOrId, Status FROM ApexTrigger WHERE NamespacePrefix=null'))
  .map(x =>
    ({      Id: x.Id,
            SObject: customObjs.find(c => c.Id === x.TableEnumOrId) !=null ? customObjs.find(c => c.Id === x.TableEnumOrId).SObject: x.TableEnumOrId,
            Trigger: x.Name,
            NamespacePrefix: x.NamespacePrefix,
            Status: x.Status
  }));

  return triggers;
}

async function getApexClasses(conn){
  console.log('Custom Apex');
  let apex = (await helper(conn, 'SELECT Id, NamespacePrefix, Name, Status FROM ApexClass WHERE NamespacePrefix=null'))
  .map(x =>
    ({      Id: x.Id,
            Class: x.Name,
            NamespacePrefix: x.NamespacePrefix,
            Status: x.Status
  }));

  return apex;
}

async function getFlows(conn) {
  console.log('Flows');
  let query = (await conn.query('SELECT Id, ApiName, ProcessType, TriggerType, NamespacePrefix, IsActive, IsTemplate, Builder, ManageableState, InstalledPackageName FROM FlowDefinitionView WHERE IsActive=true AND NamespacePrefix=null'));
  let flows = query.records
  .filter(x=>x.ProcessType!=='Workflow')
  .map(x => ({ Id: x.Id,
            Flow: x.ApiName,
            ProcessType: x.ProcessType,
            TriggerType: x.TriggerType,
            IsActive: x.IsActive,
            // TriggerObjectOrEventLabel: x.TriggerObjectOrEventId,
            RecordTriggerType: x.RecordTriggerType,
            NamespacePrefix: x.NamespacePrefix,
    }
  ));
  return {'flowDefs': query.records, 'flows': flows };
}

async function getProcessBuilderRules(flowDefs){
  console.log('Process Builders');
  let processBuilders = flowDefs
  .filter(x=>x.ProcessType=='Workflow')
  .map(x => ({ Id: x.Id,
            Flow: x.ApiName,
            ProcessType: x.ProcessType,
            TriggerType: x.TriggerType,
            IsActive: x.IsActive,
            // TriggerObjectOrEventLabel: x.TriggerObjectOrEventId,
            RecordTriggerType: x.RecordTriggerType,
            NamespacePrefix: x.NamespacePrefix,
    }
  ));

  return processBuilders;
}

async function getWorkflowRules(conn){
  console.log('Workflow Rules');
  let rules = (await helper(conn, 'SELECT Id, ManageableState, Name, NamespacePrefix, TableEnumOrId from WorkflowRule WHERE NamespacePrefix=null'))
  .map(x =>
    ({      Id: x.Id,
            Workflow: x.Name,
            ManageableState: x.ManageableState,
            TableEnumOrId: x.TableEnumOrId,
            // IsActive: x.IsActive,
            NamespacePrefix: x.NamespacePrefix,
            // Metadata: x.Metadata
  }));

  return rules;
}


async function getLWC(conn){
  console.log('LWCs');
  let lwcs = (await helper(conn, 'SELECT Id, DeveloperName, ManageableState, NamespacePrefix, TargetConfigs FROM LightningComponentBundle WHERE NamespacePrefix=null'))
  .map(x => ({ Id: x.Id,
    LWC: x.DeveloperName,
    NamespacePrefix: x.NamespacePrefix,
    ManageableState: x.ManageableState
  }
  ));

  return lwcs;
}

async function getAura(conn){
  console.log('Aura');
  let auras = (await helper(conn, 'SELECT Id, DeveloperName, ManageableState, NamespacePrefix FROM AuraDefinitionBundle WHERE NameSpacePrefix=null'))
  .map(x => ({ Id: x.Id,
    Aura: x.DeveloperName,
    NamespacePrefix: x.NamespacePrefix,
    ManageableState: x.ManageableState
  }
  ));

  return auras;
}


async function getVisualforce(conn){
  console.log('Visualforce');
  let vfs = (await helper(conn, 'SELECT Id, Name, ManageableState, NamespacePrefix, ControllerKey, ControllerType FROM ApexPage WHERE NamespacePrefix=null'))
  .map(x => ({ Id: x.Id,
    Visualforce: x.Name,
    NamespacePrefix: x.NamespacePrefix,
    ControllerKey: x.ControllerKey,
    ManageableState: x.ManageableState
  }
  ));

  return vfs;
}

async function getSyncOperations(conn, days){
  console.log('Sync Operation');
  let syncs_query;
  try{
     syncs_query = await conn.query('SELECT Id, OCE__Origin__c, OCE__Message__c, OCE__SyncErrorCode__c, OCE__SyncStatus__c, OCE__Timestamp__c, OCE__Where__c, OCE__DeviceType__c FROM OCE__Log__c WHERE OCE__Origin__c LIKE \'mobile%\' AND OCE__Timestamp__c=LAST_N_DAYS:'+days);
  } catch (error) {
    console.error('Sync Operations is not supported in the org');
    return {'syncs_no': NaN,
      'failed': NaN};
    // Expected output: ReferenceError: nonExistentFunction is not defined
    // (Note: the exact output may be browser-dependent)
  }

  let syncs = syncs_query.records;
  // the number of all sync operations
  let syncs_no = syncs_query.totalSize;

  // the number of failed operations
  let sync_errors = syncs.filter(x=> x.OCE__SyncStatus__c==='ERROR');

  return {'syncs_no': syncs_no,
    'failed': (sync_errors.length/syncs_no)*100};
}


module.exports = {getNoUsers,
  getActiveUsersCheckbox,
  getActiveUsersLastXDays,
  getAccessPercent,
  getPPEM,
  getEntitlements,
  getLicenseLimits,
  getObjectLimits,
  getUnusedProfilesAndPS,
  getUsedProfilesAndPS,
  getCustomObjects,
  getCustomFields,
  getRecordTypes,
  getApexTriggers,
  getApexClasses,
  getFlows,
  getWorkflowRules,
  getProcessBuilderRules,
  getLWC,
  getAura,
  getVisualforce,
  getSyncOperations,
  getAllCustomObjects
  };
*/
