# mappingRepository

Source: [SERVER/src/repositories/mappingRepository.js](../../SERVER/src/repositories/mappingRepository.js)

## Purpose

Database access for the **`FieldMapping`** model — the only persisted mapping entity in the app. Each
record links a source field to a target field (within a source/target object pair) and carries the
mapping type and any transformation rule or constant value. Object-level mappings are *derived* in the
service layer, not stored here.

## Architecture

- **Eager-loaded context** — a shared `FIELD_MAPPING_INCLUDES` definition joins each mapping to its
  `sourceObject`, `targetObject`, `sourceField`, and `targetField` (from `SfObjectMetadata` /
  `SfFieldMetadata`) with trimmed attribute lists. `sourceField` is `required: false` so constant /
  expression mappings (which may have no source field) still load.
- **Org-scoped queries** — `findFieldMappings*` variants apply a `where: { sfOrgId }` filter on the
  joined `sourceObject` and/or `targetObject` to scope mappings by source org, target org, or a
  specific org pair.
- **Return shape** — create/update re-fetch by PK with the full includes so callers always get a
  fully-populated mapping.

## Key functions

| Function | Description |
| --- | --- |
| `findFieldMappingById(id)` | Single mapping with full includes. |
| `findFieldMappingsByObjectPair(sourceObjectId, targetObjectId)` | Mappings for one object pair. |
| `findFieldMappingsBySourceOrg(sourceOrgId)` | All mappings whose source object is in the org. |
| `findFieldMappingsByOrgPair(sourceOrgId, targetOrgId)` | Mappings between a specific org pair. |
| `findFieldMappingsByTargetOrg(targetOrgId)` | Mappings pointing into a target org. |
| `findFieldMappingByFields(...)` | Lookup by the full source/target object+field tuple. |
| `createFieldMapping(data)` | Insert, then return the populated record. |
| `updateFieldMapping(id, data)` | Load-then-`update`; throws if missing. |
| `deleteFieldMapping(id)` | Load-then-`destroy`; throws if missing. |
| `bulkDeleteFieldMappings(sourceObjectId, targetObjectId)` | Delete all mappings for a pair. |

## How it's used / linkage

- **Consumed by** [mappingService](../services/mappingService.md) exclusively — the service adds
  validation, object-pair grouping (`buildObjectPairSummaries`), and transformation-rule parsing on
  top of these calls.
- **Indirectly drives** [extractionService](../services/extractionService.md), which asks
  `mappingService` (→ this repository) which objects to extract.
- **Depends on** `FieldMapping`, `SfObjectMetadata`, `SfFieldMetadata` (Sequelize) and
  [lib/logger.js](../../SERVER/src/lib/logger.js).

## Joins per mapping

```
FieldMapping
  ├─ sourceObject  (SfObjectMetadata, where sfOrgId = source)
  ├─ targetObject  (SfObjectMetadata, where sfOrgId = target)
  ├─ sourceField   (SfFieldMetadata, optional)
  └─ targetField   (SfFieldMetadata)
```
