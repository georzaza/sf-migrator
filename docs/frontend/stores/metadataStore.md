# metadataStore

Source: [sf-migrator/src/stores/metadataStore.js](../../../src/stores/metadataStore.js)

## Purpose

Caches Salesforce **object and field metadata** on the client to avoid repeated round-trips. It stores
lightweight list data keyed by org/object and tracks the currently selected object/field details.

## Architecture

Setup-style Pinia store (`defineStore('metadata', () => { ... })`), **not** persisted. Caches use
`ref(new Map())` so lookups are O(1) by id. Each loader sets `loading`/`error` and stores results in
the appropriate map.

## State

| Field | Description |
| --- | --- |
| `objectsByOrg` | `Map<orgId, object[]>` — cached object lists. |
| `fieldsByObject` | `Map<objectId, field[]>` — cached field lists. |
| `selectedObjectDetails` / `selectedFieldDetails` | Full metadata for the active selection. |
| `loading` / `error` | Async status. |

## Actions

| Action | Backend `action` | Description |
| --- | --- | --- |
| `loadObjects(orgId)` | `get-objects` | Fetch & cache an org's objects. |
| `loadFields(objectId)` | `get-fields` | Fetch & cache an object's fields. |
| `getObjects(orgId)` / `getFields(objectId)` | — | Read from cache (empty array if missing). |
| `setObjectDetails` / `setFieldDetails` | — | Set the selected detail records. |
| `clearCache()` / `clearOrgCache(orgId)` | — | Invalidate caches. |

## How it's used / linkage

- **Consumed by** mapping/workspace views that browse objects and fields (the metadata source for
  building mappings).
- **Depends on** [axiosInstance](../api/axiosInstance.md).
- **Backend counterpart**: [metadataRepository](../../repositories/metadataRepository.md) via
  `routes/api.js` (`get-objects`, `get-fields`).

> Note: `useOrgAnalysis` performs its own `get-objects`/`get-fields` calls for the analysis panel
> rather than going through this store; this store is the reusable cache for mapping UIs.
