# orgRepository

Source: [SERVER/src/repositories/orgRepository.js](../../SERVER/src/repositories/orgRepository.js)

## Purpose

Database access for the **`SfOrg`** model — the record representing a connected Salesforce org
(login URL, OAuth client credentials, tokens, and analysis/extraction status). Every other layer that
needs to read or mutate org state goes through here.

## Architecture

Thin, stateless wrapper over the `SfOrg` Sequelize model. Functions resolve to model instances (or
throw `Error('Salesforce Org not found')` when a primary-key lookup misses). The module exports
`delete` aliased from the internal `remove` function (since `delete` is a reserved word).

## Key functions

| Function | Description |
| --- | --- |
| `findById(id)` | `findByPk` lookup of a single org. |
| `findByUserId(userId)` | All orgs owned by a user (used by `get-orgs`). |
| `findAll()` | All orgs. |
| `create(sfOrgData)` | Insert a new org. |
| `update(id, sfOrgData)` | Load-then-`update`; throws if missing. Used to persist tokens, extraction status/summary/error, login URL, etc. |
| `delete(id)` | Load-then-`destroy`; throws if missing. |
| `updateAnalysisStatus(id, status)` | Sets `analysisStatus`; stamps `analysisStartedAt` when status is `running`. |

## How it's used / linkage

- **Consumed by**
  - [salesforceService](../services/salesforceService.md) — persists `accessToken`/`refreshToken`/
    `instanceUrl` after OAuth (`completeOAuth`) and resets status to `idle`.
  - [extractionService](../services/extractionService.md) — `findById` to load org + tokens, `update`
    to write back refreshed tokens.
  - [routes/api.js](../../SERVER/src/routes/api.js) — org CRUD actions (`get-orgs`, `add-org`,
    `update-org`, `delete-org`), analysis status, and extraction status/summary writes.
  - [routes/oauth.js](../../SERVER/src/routes/oauth.js) — indirectly via `salesforceService`.
- **Depends on** `SfOrg` (Sequelize) and [lib/logger.js](../../SERVER/src/lib/logger.js).

## Status fields it manages

- `analysisStatus`: `idle` → `running` → `complete` / `failed` / `auth_required`
- `extractionStatus`: `idle` → `running` → `complete` / `failed` / `auth_failed`
  (with `extractionSummary` / `extractionError` payloads)
