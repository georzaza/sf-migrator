# Repositories Overview

This folder documents every repository in [SERVER/src/repositories](../../SERVER/src/repositories).
Repositories are the **only** modules that talk to Sequelize models — they own all persistent
database access and hide ORM details from the rest of the app.

## Layering

```
routes ──▶ services ──▶ repositories ──▶ models (Sequelize) ──▶ PostgreSQL
                            │
                            ├──▶ utils/sfObjectMapper, sfFieldMapper  (normalize Salesforce payloads)
                            └──▶ lib/logger                           (structured logging)
```

- **Services** hold business logic and call repositories for storage.
- **Repositories** wrap Sequelize models (`db.*` from [models/index.js](../../SERVER/src/../models/index.js)),
  expose intention-revealing functions (`findById`, `bulkUpsertObjects`, …), and return model
  instances or plain aggregates.
- Some routes call repositories **directly** for simple reads (e.g. `get-objects`, `get-fields`).

## Repository catalog

| Repository | Model(s) | Responsibility | Primary callers |
| --- | --- | --- | --- |
| [orgRepository](./orgRepository.md) | `SfOrg` | Org CRUD, token & analysis/extraction status | `salesforceService`, `extractionService`, `api.js`, `oauth.js` |
| [metadataRepository](./metadataRepository.md) | `SfObjectMetadata`, `SfFieldMetadata` | Object/field upserts & reads, stats | `metadataService`, `mappingService`, `extractionService`, `api.js` |
| [mappingRepository](./mappingRepository.md) | `FieldMapping` (+ metadata joins) | Field-mapping CRUD with eager-loaded objects/fields | `mappingService` |
| [userRepository](./userRepository.md) | `User` | User lookup, creation, last-login | `authMiddleware`, `auth.js` |

## Conventions

- **Model access** — each repository imports `db` from `models/index.js` and destructures its
  model(s). No other layer imports models (the lone exception is `extractionService`, which issues
  raw SQL for dynamic staging tables).
- **Mappers** — metadata repositories run Salesforce describe payloads through
  [utils/sfObjectMapper.js](../../SERVER/src/utils/sfObjectMapper.js) and
  [utils/sfFieldMapper.js](../../SERVER/src/utils/sfFieldMapper.js) before persisting, keeping the DB
  schema decoupled from raw API shapes.
- **Bulk upserts** — metadata writes use `bulkCreate` with `updateOnDuplicate` + `conflictAttributes`
  for idempotent re-analysis.
- **Errors** — repositories throw plain `Error`s for "not found" cases; services/routes translate
  these into HTTP responses.

See each repository's page for function-level detail and linkage.
