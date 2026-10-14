# metadataService

Source: [SERVER/src/services/metadataService.js](../../SERVER/src/services/metadataService.js)

## Purpose

Orchestrates **org analysis**: pulls object and field metadata from Salesforce, filters out system
objects, and persists the results to both the database and JSON files. It is the bridge between
`salesforceService` (live API) and `metadataRepository` (storage).

## Architecture

`metadataService` holds no state. Its flagship function `analyzeAndSaveOrg` runs a pipeline:

1. **Describe global** — `salesforceService.describeGlobal(sfOrgId)` lists all sObjects.
2. **Filter** the object list in three passes:
   - optional caller-supplied `objectsToAnalyze` allow-list,
   - `hardcodedList` exclusions,
   - `patternList` regex exclusions
     (both from [config/objectsToExclude.js](../../SERVER/src/services/config/objectsToExclude.js)).
3. **Describe in bulk** — `salesforceService.describeObjectMultiple` (Composite API) fetches full
   describes for the surviving objects.
4. **Persist JSON** — `filesystemService.saveObjectDescribes` and `saveFieldDescribes` snapshot the
   raw results under `data/{orgId}`.
5. **Persist DB** — `metadataRepository.bulkUpsertObjects` then `bulkUpsertFields`, linking each field
   to its object's id via an in-memory `objectIdMap`.

## Key functions

| Function | Description |
| --- | --- |
| `analyzeAndSaveOrg(sfOrgId, options)` | Full analyze-and-persist pipeline. `options` supports `objectsToAnalyze` and `includeCustomOnly`. |
| `saveObjectMetadata(sfOrgId, metadata)` | Upsert a single object (and its fields) via the repository. |
| `saveFieldMetadata(objectMetadataId, fields)` | Upsert fields one-by-one for an object. |
| `getObjectsForOrg(sfOrgId, { includeFields })` | Read objects back from the DB. |
| `getFieldsForObject(objectMetadataId)` | Read fields for an object. |
| `deleteOrgMetadata(sfOrgId)` | Cascade-delete an org's stored metadata. |
| `getMetadataStats(sfOrgId)` | Aggregate counts from the repository. |

## How it's used / linkage

- **Consumed by** [routes/api.js](../../SERVER/src/routes/api.js) in the `analyze-org` action —
  invoked as **step 1** of analysis, before `orgStatsService`.
- **Depends on**
  - [salesforceService](./salesforceService.md) — describe calls.
  - [filesystemService](./filesystemService.md) — JSON snapshots.
  - [metadataRepository](../../SERVER/src/repositories/metadataRepository.js) — DB upserts/reads.
  - [config/objectsToExclude.js](../../SERVER/src/services/config/objectsToExclude.js) — object filters.
- **Downstream consumers** of the persisted metadata include
  [extractionService](./extractionService.md) and [mappingService](./mappingService.md), which read
  objects/fields via `metadataRepository`.

## Place in the analyze-org flow

```
api.js analyze-org
   └─ sfService.connectToOrg (pre-flight 401 if needed)
   └─ metadataService.analyzeAndSaveOrg   ← step 1 (objects + fields)
   └─ orgStatsService.calculateAndSaveOrgStats  ← step 2 (stats)
   └─ orgRepository.updateAnalysisStatus('complete')
```
