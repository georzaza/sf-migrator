# mappingService

Source: [SERVER/src/services/mappingService.js](../../SERVER/src/services/mappingService.js)

## Purpose

Owns the business logic for **field mappings** between source and target objects. In the current
architecture there is **no persisted "object mapping" entity** — object-level mappings are *derived*
on the fly by grouping field mappings by their `(sourceObjectId, targetObjectId)` pair.

## Architecture

- **FieldMapping-only model** — the only persisted records are field mappings (via
  `mappingRepository`). `buildObjectPairSummaries` collapses a flat list of field mappings into
  per-object-pair summaries (with a `fieldMappingCount`) using a `"sourceId:targetId"` pseudo-id.
- **Validation on write** — `createFieldMapping`/`updateFieldMapping` validate that source/target
  objects and fields exist (via `metadataRepository`) and enforce per-`mappingType` rules:
  - `as-is` → requires `sourceFieldId`,
  - `expression` → requires a `transformationRule`, parsed/validated by
    [utils/transformationRule.js](../../SERVER/src/utils/transformationRule.js),
  - `constant` → requires a `constantValue`.
- **Deprecated paths** — `updateObjectMapping` throws by design, and `deleteObjectMapping` splits the
  pseudo-id and bulk-deletes the underlying field mappings, reflecting the move away from persisted
  object mappings.

## Key functions

| Function | Description |
| --- | --- |
| `getObjectMappingsBySourceOrg(sourceOrgId)` | Field mappings for a source org, grouped into object pairs. |
| `getObjectMappingsByOrgPair(sourceOrgId, targetOrgId)` | Grouped pairs for a specific org pair. |
| `getObjectMappingsByTargetOrg(targetOrgId)` | Grouped pairs pointing into a target org (used by extraction fan-out). |
| `getFieldMappingsBySourceOrg` / `getFieldMappingsByOrgPair` | Raw (ungrouped) field mappings. |
| `getFieldMappingsByObjectMapping(mappingId)` | Field mappings for a `"src:tgt"` pair. |
| `upsertObjectMapping(sourceObjectId, targetObjectId)` | Validates both objects exist, returns a derived pair summary (no persistence). |
| `createFieldMapping(data)` | Validates and persists a field mapping. |
| `updateFieldMapping(mappingId, updates)` | Whitelisted updates + expression validation. |
| `deleteFieldMapping(mappingId)` / `deleteObjectMapping(mappingId)` | Delete one mapping / all mappings for a pair. |

## How it's used / linkage

- **Consumed by**
  - [routes/api.js](../../SERVER/src/routes/api.js) — `get-mappings`, `get-field-mappings`,
    `create-mapping`, `create-field-mapping`, `update-mapping`, `update-field-mapping`,
    `delete-mapping`, `delete-field-mapping`.
  - [extractionService](./extractionService.md) — to resolve which objects to extract.
- **Depends on**
  - [mappingRepository](../../SERVER/src/repositories/mappingRepository.js) — field-mapping persistence.
  - [metadataRepository](../../SERVER/src/repositories/metadataRepository.js) — object/field existence checks.
  - [utils/transformationRule.js](../../SERVER/src/utils/transformationRule.js) — expression grammar parsing.

## Object-pair grouping

```
findFieldMappings* (flat list)
   └─ buildObjectPairSummaries
        └─ group by "sourceObjectId:targetObjectId"
             → { id, sourceObject, targetObject, fieldMappingCount }
```
