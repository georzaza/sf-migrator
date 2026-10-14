# mappingStore

Source: [sf-migrator/src/stores/mappingStore.js](../../../src/stores/mappingStore.js)

## Purpose

Owns client state and CRUD for **object mappings** and **field mappings** between source and target
orgs. It mirrors the backend's FieldMapping-only model: object mappings are derived pairs, field
mappings are the real records.

## Architecture

Setup-style Pinia store (`defineStore('mapping', () => { ... })`), not persisted. Exposes `loading`/
`error` refs, two computed getters, and a full set of CRUD actions. Each action updates the local
arrays optimistically from the response so views stay in sync without a reload.

## State & getters

| Member | Description |
| --- | --- |
| `objectMappings` | Derived source/target pair summaries. |
| `currentMapping` | Mapping selected for detail view. |
| `fieldMappings` | Field mappings for the current object pair. |
| `getMappingById` (getter) | Lookup an object mapping by id. |
| `fieldMappingsByObjectMapping` (getter) | Filter field mappings by `"src:tgt"` pair id. |

## Actions

| Action | Backend `action` | Description |
| --- | --- | --- |
| `loadMappings(sourceOrgId, targetOrgId?)` | `get-mappings` | Load object-pair summaries. |
| `loadFieldMappings(mappingId)` | `get-field-mappings` | Load field mappings for a pair. |
| `createMapping(sourceObjectId, targetObjectId)` | `create-mapping` | Create an object pair. |
| `createFieldMapping(data)` | `create-field-mapping` | Create a field mapping. |
| `updateMapping` / `updateFieldMapping` | `update-mapping` / `update-field-mapping` | Update + reconcile local state. |
| `deleteMapping` / `deleteFieldMapping` | `delete-mapping` / `delete-field-mapping` | Delete + prune local state. |
| `setCurrentMapping` / `clearMappings` | — | Selection & reset helpers. |

## How it's used / linkage

- **Consumed by**
  - [MigrationWorkspace](../views/MigrationWorkspace.md) — create object mappings between orgs.
  - [FieldMapping](../views/FieldMapping.md) — load/create/delete field mappings for a pair.
- **Depends on** [axiosInstance](../api/axiosInstance.md).
- **Backend counterparts**: [mappingService](../../services/mappingService.md) +
  [mappingRepository](../../repositories/mappingRepository.md) via `routes/api.js`.
