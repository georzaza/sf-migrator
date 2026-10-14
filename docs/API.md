# SF-Migrator Backend HTTP API Inventory

## Response Envelope & Auth

### Response Shape
All responses follow this envelope:
```json
{
  "success": boolean,
  "message": string,
  "data": any,           // optional, omitted if undefined
  "requestId": string    // optional, only if X-Request-ID header is set
}
```

### Status Codes Used
- `200`: Successful GET/PUT/DELETE
- `201`: Resource created (POST create-mapping, add-org)
- `202`: Background job started (analyze-org, start-extraction, start-transform, start-load)
- `400`: Bad request (missing headers/body fields)
- `401`: Unauthorized (missing/expired token or OAuth required)
- `404`: Not found (org, setting, etc.)
- `500`: Server error

### Auth Middleware
- **Mechanism**: JWT token in `auth_token` cookie
- **Checked on**: All /api routes (GET, POST, PUT, DELETE)
- **Failure**: Returns 401 with message "Unauthorized"
- **Required header**: `action` (case-insensitive, lowercase by service)
- Token verified with `process.env.JWT_SECRET`
- Token expired = 401 "Token has expired"

---

## Domain 1: Orgs/Auth

### GET get-orgs
- **Headers**: None (beyond auth)
- **Returns**: Array of org objects
```javascript
{
  id, userId, instanceUrl, loginURL, name, clientId, clientSecret, 
  accessToken, refreshToken, analysisStatus, analysisStartedAt,
  createdAt, updatedAt,
  // Masked fields:
  hasAccessToken: boolean,        // true if accessToken exists
  clientId: '**********' | null,  // masked
  clientSecret: '**********' | null,
  accessToken: '**********' | null
}[]
```
- **Status**: 200

---

### POST test-sf-connection
- **Body**: `{ orgId: string }`
- **Returns**: Connection test result object
- **Status**: 200 on success, 500 on failure

---

### PUT add-org
- **Headers**: None (beyond auth)
- **Body**: `{ loginURL: string, ... }` (other org fields)
- **Validation**: loginURL must match `^https://.+\.my\.salesforce\.com$` and be reachable
- **Returns**: Created org object (same schema as GET get-orgs)
- **Status**: 201 on success

---

### PUT update-org
- **Headers**: `orgId` (org ID)
- **Body**: `{ loginURL?, ...other fields }`
- **Returns**: None (just success message)
- **Status**: 200

---

### DELETE delete-org
- **Headers**: `orgId` (org ID)
- **Returns**: None (just success message)
- **Status**: 200

---

## Domain 2: Metadata/Analysis

### POST analyze-org
- **Body**: `{ orgId: string, options?: object }`
- **Process**: 
  1. Verifies OAuth (401 if OAuthRequiredError)
  2. Sets status to 'running'
  3. Returns 202 immediately
  4. Background chain: mdtService.analyzeAndSaveOrg → orgStatsService.calculateAndSaveOrgStats → update status to 'complete' or 'failed'
- **Returns** (202): `{ analysisStatus: 'running' }`
- **Failure**: Sets analysisStatus to 'failed' or 'auth_required' in background
- **Status**: 202 (async), or 401/500 on sync error

---

### GET get-org-status
- **Headers**: `orgId` (org ID)
- **Returns**: 
```javascript
{
  analysisStatus: 'idle' | 'running' | 'complete' | 'failed' | 'auth_required',
  analysisStartedAt: Date | null,
  authUrl?: string  // only if status === 'auth_required'
}
```
- **Status**: 200

---

### GET get-objects
- **Headers**: `orgId` (required)
- **Query**: `includeFields=true` (optional, boolean)
- **Returns**: Array of objects
```javascript
{
  id, name, label, sfOrgId, createdAt, updatedAt,
  fields?: [ // if includeFields=true
    { id, name, label, type, createable, updateable, nillable, 
      externalId, defaultedOnCreate, defaultValue, referenceTo, 
      compoundFieldName, objectMetadataId, ... }
  ]
}[]
```
- **Status**: 200

---

### GET get-fields
- **Headers**: `objectId` (required, object ID)
- **Returns**: Array of field objects
```javascript
{
  id, name, label, type, createable, updateable, nillable, 
  externalId, defaultedOnCreate, defaultValue, referenceTo[], 
  compoundFieldName, objectMetadataId, ...
}[]
```
- **Status**: 200

---

### GET get-org-stats
- **Headers**: `orgId` (required)
- **Returns**: Latest org stats object (from `orgStatsService.getLatestOrgStats()`)
- **Status**: 200

---

## Domain 3: Mapping (Object & Field)

### POST create-mapping
- **Body**: `{ sourceObjectId: string, targetObjectId: string }`
- **Returns**: Created object mapping
```javascript
{
  id, sourceObjectId, targetObjectId, 
  sourceObject: { id, name, label, ... },
  targetObject: { id, name, label, ... },
  createdAt, updatedAt
}
```
- **Status**: 201

---

### GET get-mappings
- **Headers**: 
  - `sourceOrgId` (required)
  - `targetOrgId` (optional)
- **If targetOrgId provided**: Returns mappings for that org pair
- **Else**: Returns all mappings where source org = sourceOrgId
- **Returns**: Array of object mappings (same schema as POST create-mapping)
- **Status**: 200

---

### PUT update-mapping
- **Headers**: `mappingId` (required, mapping ID)
- **Body**: Updates to the mapping
- **Returns**: Updated object mapping
- **Status**: 200

---

### DELETE delete-mapping
- **Headers**: `mappingId` (required)
- **Returns**: None (just success message)
- **Status**: 200

---

### POST create-field-mapping
- **Body**: 
```javascript
{
  sourceObjectId: string,
  targetObjectId: string,
  sourceFieldId?: string,
  targetFieldId: string (required),
  mappingType?: 'as-is' | 'expression' | 'constant',
  transformationRule?: string,  // for 'expression' mappings
  constantValue?: any           // for 'constant' mappings
}
```
- **Validation**: 
  - Target field must be writable (updateable !== false)
  - Target field cannot already be mapped
  - Type compatibility warning (if sourceFieldId + 'as-is')
  - Expression references validated (if 'expression')
- **Returns**: Created field mapping
```javascript
{
  id, sourceObjectId, targetObjectId, sourceFieldId, targetFieldId,
  mappingType, transformationRule, constantValue,
  sourceField: { id, name, label, type, referenceTo, ... },
  targetField: { id, name, label, type, createable, updateable, ... },
  createdAt, updatedAt
}
```
- **Status**: 201

---

### GET get-field-mappings
- **Headers**: `mappingId` (required, object mapping ID)
- **Returns**: Array of field mappings for that object pair
- **Status**: 200

---

### PUT update-field-mapping
- **Headers**: `mappingId` (required, field mapping ID)
- **Body**: Updates to field mapping
- **Returns**: Updated field mapping
- **Status**: 200

---

### DELETE delete-field-mapping
- **Headers**: `mappingId` (required, field mapping ID)
- **Returns**: None (just success message)
- **Status**: 200

---

## Domain 4: Migration Settings

### GET get-migration-setting
- **Headers**: 
  - `sourceObjectId` (required)
  - `targetObjectId` (required)
- **Returns**: Migration setting object or null
```javascript
{
  id, sourceObjectId, targetObjectId,
  enabled?: boolean,
  batchSize?: number,
  useBulkApi?: boolean,
  operation?: string,
  sortToAvoidLocks?: boolean,
  extractFilter?: string,
  externalIdStrategy?: string,
  metadata?: {
    tracebackExternalIdField?: { id: string, name: string } | null,
    ... other metadata
  },
  createdAt, updatedAt
} | null
```
- **Status**: 200

---

### PUT upsert-migration-setting
- **Headers**: None (beyond auth)
- **Body**: 
```javascript
{
  sourceObjectId: string (required),
  targetObjectId: string (required),
  enabled?: boolean,
  batchSize?: number,
  useBulkApi?: boolean,
  operation?: string,
  sortToAvoidLocks?: boolean,
  extractFilter?: string,
  externalIdStrategy?: string,
  metadata?: object  // merged with existing metadata
}
```
- **Allowed fields**: enabled, batchSize, useBulkApi, operation, sortToAvoidLocks, extractFilter, externalIdStrategy, metadata
- **Returns**: Upserted migration setting (same schema as GET get-migration-setting)
- **Status**: 200

---

## Domain 5: Validation

### GET validate-object-mapping
- **Headers**: 
  - `sourceObjectId` (required)
  - `targetObjectId` (required)
- **Returns**: 
```javascript
{
  warnings: [
    {
      code: 'required-unmapped' | 'no-traceback-field',
      field?: string,           // field name (required-unmapped)
      message: string           // human description
    }
  ]
}
```
- **Warning codes**:
  - `'required-unmapped'`: Target field is createable, not nillable, no default, and not mapped
  - `'no-traceback-field'`: No External Id field selected for load correlation
- **Status**: 200

---

## Domain 6: Dependency/Load-Plan

### GET get-load-plan
- **Headers**: 
  - `sourceOrgId` (required)
  - `targetOrgId` (required)
- **Returns**: 
```javascript
{
  loadOrder: [
    {
      sourceObjectId: string,
      sourceObjectName: string,
      targetObjectId: string,
      targetObjectName: string
    }
  ],
  deferredFields: [
    {
      sourceObjectId: string,
      sourceObjectName: string,
      fieldName: string,
      referencedObjectName: string,
      reason: 'self-reference' | 'cycle'
    }
  ]
}
```
- **Logic**: Topological sort of objects by lookup/master-detail references, parents first
- **Cycles**: Cuts cyclic edges, reports as deferredFields (filled in load pass 2)
- **Status**: 200

---

## Domain 7: Extraction

### POST start-extraction
- **Body**: 
```javascript
{
  sourceOrgId?: string,
  targetOrgId?: string
  // One of these is required; if both, sourceOrgId is used
}
```
- **Modes**:
  - sourceOrgId only: Extract source org's mapped objects (mode: 'source-org')
  - targetOrgId only: Extract all source orgs feeding that target (mode: 'target-org')
- **Process**:
  1. Sets org.extractionStatus = 'running', clears summary/error
  2. Returns 202 immediately with `{ extractionStatus: 'running' }`
  3. Background: Executes extraction, updates org.extractionStatus to 'complete', 'failed', or 'auth_failed'
- **Returns** (202): `{ extractionStatus: 'running' }`
- **Status**: 202 (async), or 500 on sync error

---

### GET get-extraction-status
- **Headers**: `orgId` (required, source or target org ID)
- **Returns**: 
```javascript
{
  extractionStatus: 'idle' | 'running' | 'complete' | 'failed' | 'auth_failed',
  summary: {
    runId: uuid,
    sourceOrgId?: string,
    targetOrgId?: string,
    totalObjects: number,
    successCount: number,
    failedCount: number,
    results: [
      {
        sourceObjectId: string,
        objectName: string,
        status: 'success' | 'failed',
        fieldsExportedCount: number,
        recordsExported: number,
        startedAt: Date,
        finishedAt: Date,
        queryFilePath: string,      // path to .query file
        csvFilePath: string,        // path to extracted CSV
        stgTableName: string,       // stg1_* table name
        validatedRowCount: number,
        errorMessage?: string
      }
    ],
    todos?: string[]
  } | null,
  error: string | null,
  currentObject: string | null,     // currently extracting (in-memory progress)
  objectsRemaining: number | null   // objects left to extract
}
```
- **Status**: 200

---

## Domain 8: Transform

### POST start-transform
- **Body**: 
```javascript
{
  sourceOrgId: string (required),
  targetOrgId: string (required)
}
```
- **Process**:
  1. Sets in-memory transform status to { status: 'running', summary: null, error: null }
  2. Returns 202 immediately
  3. Background: Runs transform, updates status to 'complete' or 'failed'
- **Returns** (202): `{ transformStatus: 'running' }`
- **Status**: 202 (async), or 500 on sync error

---

### GET get-transform-status
- **Headers**: 
  - `sourceOrgId` (required)
  - `targetOrgId` (required)
- **Returns**: 
```javascript
{
  status: 'idle' | 'running' | 'complete' | 'failed',
  summary: {
    runId: uuid,
    sourceOrgId: string,
    targetOrgId: string,
    targetObjectCount: number,
    successCount: number,
    failedCount: number,
    results: [
      {
        targetObject: string,
        drivingObject: string,
        runId: uuid,
        stg2Table: string,             // stg2_* table name
        rowCount: number,
        successCount: number,
        errorCount: number,
        status: 'success' | 'failed',
        errorMessage?: string,
        startedAt: Date,
        finishedAt: Date
      }
    ]
  } | null,
  error: string | null
}
```
- **Status**: 200

---

## Domain 9: Traceback (External Id)

### GET get-traceback-candidates
- **Headers**: `targetObjectId` (required)
- **Returns**: Array of External Id field candidates
```javascript
{
  id: string,
  name: string,          // API name
  label: string,
  type: string,          // field type
  unique: boolean        // if externalId + unique
}[]
```
- **Filter**: Fields where externalId === true AND createable === true
- **Status**: 200

---

### PUT set-traceback-field
- **Body**: 
```javascript
{
  sourceObjectId: string (required),
  targetObjectId: string (required),
  fieldId?: string | null            // null to clear selection
}
```
- **Validation**:
  - fieldId must belong to targetObject
  - fieldId must be an External Id candidate (externalId + createable)
- **Storage**: Stored as MigrationSetting.metadata.tracebackExternalIdField = { id, name }
- **Returns**: Selected field or null
```javascript
{
  id: string,
  name: string
} | null
```
- **Status**: 200

---

## Domain 10: Load

### POST start-load
- **Body**: 
```javascript
{
  sourceOrgId: string (required),
  targetOrgId: string (required)
}
```
- **Process**:
  1. Sets in-memory load status to { status: 'running', summary: null, error: null }
  2. Returns 202 immediately
  3. Background: Runs two-pass load (stg3 build → Bulk insert → deferred updates)
- **Returns** (202): `{ loadStatus: 'running' }`
- **Status**: 202 (async), or 500 on sync error

---

### GET get-load-status
- **Headers**: 
  - `sourceOrgId` (required)
  - `targetOrgId` (required)
- **Returns**: 
```javascript
{
  status: 'idle' | 'running' | 'complete' | 'failed',
  summary: {
    runId: uuid,
    sourceOrgId: string,
    targetOrgId: string,
    objectCount: number,
    loadDir: string,                  // directory containing stg3 tables + CSVs
    results: [
      {
        targetObject: string,
        sourceObject: string,
        status: 'success' | 'skipped' | 'failed',
        stg3Table: string,             // stg3_* table name
        total: number,                 // total stg2 rows
        ready: number,                 // rows sent to Bulk
        loaded: number,                // rows successfully inserted
        failed: number,                // rows that failed
        skipped: number,               // rows skipped (already-loaded, missing parent)
        deferredUpdated: number,       // rows updated in pass 2
        errorMessage?: string,
        successCsv?: string,           // path to success CSV
        errorCsv?: string              // path to error CSV
      }
    ]
  } | null,
  error: string | null
}
```
- **Load logic**:
  - Pass 1: Insert ready rows in dependency order, correlate via External Id, build RecordIdMap
  - Pass 2: Update deferred lookups (self-ref, cycles) now that parent Ids exist
  - Skip rows with missing parents or already-loaded source Ids
  - Correlation: Source Id → External Id field → Bulk result sf__Id → RecordIdMap
- **Status**: 200

---

## Data Type Mappings

### Field Types
Text-like: string, textarea, picklist, multipicklist, phone, url, email, encryptedstring, combobox, id, reference
Number: int, double, currency, percent, long
Date: date, datetime, time
Boolean: boolean

### Relationship Types
- reference: generic relationship
- lookup: optional relationship
- masterdetail: required relationship

### Object/Field Metadata Fields
- Org: id, userId, instanceUrl, loginURL, name, clientId, clientSecret, accessToken, refreshToken, analysisStatus, analysisStartedAt, createdAt, updatedAt
- Object: id, name, label, sfOrgId, createdAt, updatedAt
- Field: id, name, label, type, createable, updateable, nillable, externalId, defaultedOnCreate, defaultValue, referenceTo[], compoundFieldName, objectMetadataId

---

## Error Handling Patterns

### Sync Errors (immediate response)
- 400: Missing required headers/body fields
- 401: Missing/expired JWT token, OAuthRequiredError
- 404: Org/object/setting not found
- 500: Unhandled exceptions

### Async Errors (background job failure)
- Extraction: org.extractionStatus = 'failed' or 'auth_failed', org.extractionError = message
- Transform: transformStatusByKey[key].status = 'failed', error = message
- Load: loadStatusByKey[key].status = 'failed', error = message

### Blocking Validation Errors
- validateFieldMapping throws on: target field not found, not writable, already mapped
- validateObjectMapping returns warnings (advisory only)
- setExternalIdField throws on: field not found, wrong target object, not an External Id candidate

---

## Implementation Notes

### Action Header Resolution
- GET: `req.get('action')?.toLowerCase()`
- POST/PUT/DELETE: `req.headers.action?.toLowerCase()`
- Required: authMiddleware rejects if no action header

### In-Memory Status Tracking
- transformStatusByKey: Map keyed by `${sourceOrgId}::${targetOrgId}`
- loadStatusByKey: Map keyed by `${sourceOrgId}::${targetOrgId}`
- extractionProgress: Map keyed by sourceOrgId, stores { objectName, remaining }
- **WARNING**: Resets on service restart

### Data Storage Layers
- **Metadata**: Database (orgRepository, metadataRepository, mappingRepository, etc.)
- **Extraction output**: Dynamic stg1_* tables + CSV files in data/[sourceOrgId]/Extraction/
- **Transform output**: Dynamic stg2_* tables in database
- **Load output**: Dynamic stg3_* tables + CSV files in data/[targetOrgId]/Load/[runId]/
- **Record mapping**: RecordIdMap table (sourceOrgId, targetOrgId, objectName, sourceRecordId → targetRecordId)

### Field Mapping Types
- `'as-is'`: Copy source field value as-is; for lookups, keeps source parent Id (remapped in load)
- `'expression'`: Evaluate JS expression against nested record assembled from relationships
- `'constant'`: Use fixed constant value for all rows

### External ID Correlation Model
- User selects an External Id field on target object (per object pair)
- During load, source record Id is written to this field
- Bulk API 2.0 echoes it back in results (preserved External Id column)
- Results correlated back to source records via that column
- Target Ids captured and stored in RecordIdMap for parent lookups

---

End of API Inventory
