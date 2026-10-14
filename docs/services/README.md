# Backend Services Overview

This folder documents every service in [SERVER/src/services](../../SERVER/src/services). Services hold the
application's business logic. They sit between the HTTP **routes** (which only parse requests and
shape responses) and the **repositories** (which own all persistent database access via Sequelize).

## Layering

```
routes ──▶ services ──▶ repositories ──▶ models (Sequelize) ──▶ PostgreSQL
   │           │
   │           ├──▶ lib/logger          (structured + file logging)
   │           ├──▶ utils/*             (mappers, parsers, helpers)
   │           └──▶ jsforce             (Salesforce REST / Tooling / Bulk APIs)
   │
   └──▶ middleware (auth, request tracing)
```

- **Routes** ([routes/api.js](../../SERVER/src/routes/api.js), [routes/oauth.js](../../SERVER/src/routes/oauth.js))
  dispatch on an `action` header/field and delegate to a service.
- **Services** orchestrate Salesforce calls, file persistence, and DB writes.
- **Repositories** ([repositories/](../../SERVER/src/repositories)) are the only modules that talk to
  Sequelize models. Services never import models directly — except `extractionService`, which issues
  raw SQL to manage dynamically created staging tables.

## Service catalog

| Service | Responsibility | Primary callers |
| --- | --- | --- |
| [salesforceService](./salesforceService.md) | jsforce connection pool, OAuth2 flow, describe / query / insert | `oauth.js`, `metadataService`, `api.js` |
| [metadataService](./metadataService.md) | Analyze an org, persist object & field metadata | `api.js` (`analyze-org`) |
| [orgStatsService](./orgStatsService.md) | Compute org health/usage statistics | `api.js` (`analyze-org`, step 2) |
| [extractionService](./extractionService.md) | Bulk-export records to CSV + dynamic staging tables | `api.js` (`start-extraction`) |
| [mappingService](./mappingService.md) | Object/field mapping business logic & validation | `api.js`, `extractionService` |
| [filesystemService](./filesystemService.md) | Persist describes & stats as JSON under `data/{orgId}` | `metadataService`, `orgStatsService`, `api.js` |

## Supporting folders

- [services/config/objectsToExclude.js](../../SERVER/src/services/config/objectsToExclude.js) —
  hardcoded + regex pattern lists of system objects to skip during analysis.
- [services/queries/](../../SERVER/src/services/queries) — reference SOQL/Tooling query
  collections. `toolingAPIqueries.js` is largely a catalog of queries; `restAPIqueries.js`
  exposes a few standalone helpers. These are reference/WIP modules and are not the primary
  execution path used by `orgStatsService`.

## End-to-end flows

**1. Connect an org (OAuth2)**
`oauth.js` → `salesforceService.beginOAuth` → redirect to Salesforce → `oauth.js` callback →
`salesforceService.completeOAuth` → tokens saved via `orgRepository`.

**2. Analyze an org**
`api.js` `analyze-org` → `metadataService.analyzeAndSaveOrg` (describe + persist via
`metadataRepository` + JSON via `filesystemService`) → `orgStatsService.calculateAndSaveOrgStats`
(stats + JSON via `filesystemService`) → status updated via `orgRepository`.

**3. Extract records**
`api.js` `start-extraction` → `extractionService.runExtraction` /
`runExtractionForTargetOrg` → resolves objects from `mappingService` + `metadataRepository` →
jsforce Bulk V2 export to CSV → load into dynamic `stg1_*` staging tables → write `ext_*` run stats.

See each service's page for detailed architecture, function-level notes, and linkage diagrams.
