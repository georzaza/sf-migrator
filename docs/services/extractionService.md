# extractionService

Source: [SERVER/src/services/extractionService.js](../../SERVER/src/services/extractionService.js)

## Purpose

Exports record **data** (not metadata) out of a source org and lands it in PostgreSQL staging tables.
For each mapped object it generates a full-field SOQL query, runs a **jsforce Bulk V2** export to CSV,
parses the CSV, and bulk-loads the rows into a dynamically created `stg1_*` table. Every object's run
is recorded in a per-org `ext_*` stats table.

## Architecture

Unlike other services, `extractionService` runs as a **long-lived background job** (kicked off with a
`202 Accepted` from the route) and manages its **own** Salesforce connection plus **raw SQL** against
dynamic tables.

- **Own jsforce connection** — built directly with an `OAuth2` config so it can auto-refresh tokens
  for a long export; refreshed tokens are written back via `orgRepository`. (It does *not* reuse
  `salesforceService`'s pool.) API version pinned to `66.0`.
- **Object resolution** (`collectObjectsForExtraction`) — starts from mapped source objects, then does
  a breadth-first walk over **reference/lookup/master-detail** fields to transitively include
  referenced objects, so foreign keys have targets to land in.
- **Compound-field handling** — compound parent fields (e.g. `BillingAddress`) are filtered out;
  component fields (`BillingStreet`, `BillingCity`) are kept. `Id` is always included.
- **Bulk V2 export** (`runBulk2Export`) — streams `conn.bulk2.query(soql)` into a CSV write stream.
- **CSV parsing** — a hand-rolled quote-aware parser (`parseCsv`/`parseCsvFile`) handles embedded
  commas, quotes, and BOM stripping.
- **Dynamic staging tables** — `stg1_{orgId}_{object}` tables are created/altered (`TEXT` columns),
  truncated, and filled in batches of `INSERT_BATCH_SIZE` (500) via parameterized bulk inserts. Names
  are sanitized and hashed when they exceed Postgres's 63-char identifier limit.
- **Validation** — `validateLoadedTable` asserts the loaded row count matches the parsed CSV count.
- **Run stats** — `ext_{orgId}_extraction_stats` records per-object status, fields, paths, row counts,
  and errors for each `runId`.

## Key functions

| Function | Description |
| --- | --- |
| `runExtraction({ sourceOrgId, targetOrgId? })` | Extract all resolved objects for one source org. Returns a summary with per-object results. |
| `runExtractionForTargetOrg({ targetOrgId })` | Fans out: finds every source org mapped to the target and runs `runExtraction` for each. |
| `collectObjectsForExtraction` | BFS over reference fields to build the full object set to extract. |
| `runBulk2Export` | Streams a Bulk V2 query result to a CSV file. |
| `parseCsvFile` / `parseCsv` | Parse exported CSV into headers + normalized rows. |
| `loadRowsToDynamicTable` / `ensureDynamicTable` / `insertRows` | Create/fill the dynamic staging table. |
| `validateLoadedTable` | Row-count integrity check. |
| `ensureExtractionStatsTable` / `insertExtractionStat` | Manage the per-org run-stats table. |

## How it's used / linkage

- **Consumed by** [routes/api.js](../../SERVER/src/routes/api.js) in the `start-extraction` action.
  The route sets `extractionStatus = running`, returns `202`, then runs extraction in the background
  and writes `extractionSummary` / `extractionError` back to the org row.
- **Depends on**
  - `jsforce` (own connection + Bulk V2).
  - [mappingService](./mappingService.md) — resolves which objects to extract
    (`getObjectMappingsBySourceOrg`, `getObjectMappingsByOrgPair`, `getObjectMappingsByTargetOrg`).
  - [metadataRepository](../../SERVER/src/repositories/metadataRepository.js) — object/field metadata.
  - [orgRepository](../../SERVER/src/repositories/orgRepository.js) — org lookup + token refresh writes.
  - `models/index.js` (`db.sequelize`) — **raw SQL** for dynamic staging & stats tables.
- **Outputs** — CSV + `.query` files under `data/{orgId}/Extraction/`, plus `stg1_*` and `ext_*`
  Postgres tables.

## Outstanding TODOs (from source)

- Wide-object fallback: split fields across multiple query files and merge by `Id` when a full-field
  SOQL export exceeds column limits.

## Extraction flow

```
api.js start-extraction (202)
   └─ runExtraction({ sourceOrgId, targetOrgId? })
        ├─ orgRepository.findById                (load org + tokens)
        ├─ jsforce Connection (auto-refresh)
        ├─ mappingService.getObjectMappings*     (which objects)
        ├─ collectObjectsForExtraction           (+ referenced objects, BFS)
        └─ per object:
             metadataRepository.findFieldsByObjectId
             → SOQL → bulk2.query → CSV
             → parseCsvFile → loadRowsToDynamicTable (stg1_*)
             → validateLoadedTable → insertExtractionStat (ext_*)
```
