# metadataRepository

Source: [SERVER/src/repositories/metadataRepository.js](../../SERVER/src/repositories/metadataRepository.js)

## Purpose

Database access for the **`SfObjectMetadata`** and **`SfFieldMetadata`** models — the persisted
catalog of an org's objects and fields produced by analysis. It supports both single-record
find-or-create and high-throughput bulk upserts, plus read helpers used widely across the app.

## Architecture

- **Two related models** — objects (`SfObjectMetadata`) and their fields (`SfFieldMetadata`), linked
  by `objectMetadataId` with the `fields` association alias.
- **Mapping layer** — incoming Salesforce describe payloads are normalized through
  [utils/sfObjectMapper.js](../../SERVER/src/utils/sfObjectMapper.js) (`mapSfObject`, `SF_OBJECT_COLUMNS`)
  and [utils/sfFieldMapper.js](../../SERVER/src/utils/sfFieldMapper.js) (`mapSfField`, `SF_FIELD_COLUMNS`)
  before any write.
- **Idempotent bulk upserts** — `bulkUpsertObjects`/`bulkUpsertFields` use `bulkCreate` with
  `updateOnDuplicate` and `conflictAttributes` (`['sfOrgId','name']` for objects,
  `['objectMetadataId','name']` for fields), so re-analyzing an org updates in place.
- **Generated columns** — `isFormula` and `isRollUpSummary` are Postgres `GENERATED ALWAYS AS STORED`
  columns and are intentionally excluded from the writable field columns.

## Key functions

| Function | Description |
| --- | --- |
| `findOrCreateObject(sfOrgId, objectData)` | Upsert a single object, refreshing `lastAnalyzed`. |
| `findOrCreateField(objectMetadataId, fieldData)` | Upsert a single field. |
| `findObjectById(id, { includeFields })` | Object by PK, optionally eager-loading fields. |
| `findObjectsByOrgId(sfOrgId, { includeFields })` | All objects for an org, ordered by name. |
| `findFieldsByObjectId(objectMetadataId)` | All fields for an object. |
| `findFieldById(id)` | Field by PK. |
| `deleteObjectsByOrgId(sfOrgId)` | Cascade-delete fields then objects for an org. |
| `bulkUpsertObjects(sfOrgId, objectDataArray)` | Bulk idempotent object upsert. |
| `bulkUpsertFields(fieldsArray)` | Bulk idempotent field upsert. |
| `getStats(sfOrgId)` | Aggregate counts: total/custom/standard objects, fields, records, last analyzed. |

## How it's used / linkage

- **Consumed by**
  - [metadataService](../services/metadataService.md) — bulk upserts during `analyzeAndSaveOrg` plus
    the read/delete/stats helpers.
  - [mappingService](../services/mappingService.md) — object/field existence checks
    (`findObjectById`, `findFieldById`).
  - [extractionService](../services/extractionService.md) — `findObjectsByOrgId`,
    `findFieldsByObjectId` to resolve objects and build SOQL field lists.
  - [routes/api.js](../../SERVER/src/routes/api.js) — direct reads for `get-objects` / `get-fields`.
- **Depends on** `SfObjectMetadata` & `SfFieldMetadata` (Sequelize), and the two mapper utils.

## Object/field relationship

```
SfObjectMetadata (1) ──< SfFieldMetadata (many)
        ▲                      ▲
   sfOrgId, name        objectMetadataId, name
   (conflict key)         (conflict key)
```
