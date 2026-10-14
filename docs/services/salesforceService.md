# salesforceService

Source: [SERVER/src/services/salesforceService.js](../../SERVER/src/services/salesforceService.js)

## Purpose

The single gateway between the backend and Salesforce. It owns the **jsforce connection pool**, drives
the **OAuth2 web-server flow**, and exposes thin wrappers around Salesforce REST, Tooling, Composite,
and Bulk APIs. Every other service that needs live Salesforce data goes through here.

## Architecture

- **Connection pool** — module-level `connectionPool` (`Map<sfOrgId, jsforce.Connection>`) caches
  authorized connections. `oauth2Map` (`Map<sfOrgId, jsforce.OAuth2>`) holds in-flight OAuth sessions
  between the auth redirect and the callback.
- **API version** — pinned via the `VERSION` constant (`65.0`).
- **Concurrency limiter** — an inline `pLimit(concurrency)` implementation (p-limit is ESM-only in v5+)
  caps concurrent Composite API calls to respect Salesforce's per-org request limits.
- **`OAuthRequiredError`** — custom error thrown by `connectToOrg` when no valid cached connection
  exists. Carries `authUrl` so callers (routes) can return `401 { authUrl }` and trigger the frontend
  OAuth redirect.

## Key functions

| Function | Description |
| --- | --- |
| `beginOAuth(sfOrgId, returnTo)` | Builds the `jsforce.OAuth2` client, stores it in `oauth2Map`, returns the Salesforce authorization URL (scope `full`, state carries `sfOrgId`/`returnTo`). |
| `completeOAuth(sfOrgId, code)` | Exchanges the auth code for a connection, caches it, persists `accessToken`/`refreshToken`/`instanceUrl` via `orgRepository`, sets analysis status to `idle`. |
| `cancelOAuth(sfOrgId)` | Discards a pending OAuth session (e.g. on URL probe failure). |
| `connectToOrg(sfOrgId)` | Returns a cached, validated (`conn.identity()`) connection or throws `OAuthRequiredError`. |
| `describeGlobal(sfOrgId)` | `describeGlobal()` → normalized object list via `mapSfObject`. |
| `describeObjectMultiple(sfOrgId, names)` | Batches names into Composite API requests (25 per request, concurrency 5) for fast full-org describes. |
| `describeObject(sfOrgId, name)` | Single-object describe (use sparingly — prefer the multiple variant). |
| `getRecordCount` / `queryRecords` | SOQL `COUNT()` and record queries. |
| `insertRecords(sfOrgId, object, records)` | Bulk job for >200 records, otherwise `sobject.create`. |
| `testConnection(sfOrgId)` | Returns identity info to verify a live connection. |
| `clearConnection(sfOrgId)` | Evicts a connection from the pool. |

## How it's used / linkage

- **Consumed by**
  - [routes/oauth.js](../../SERVER/src/routes/oauth.js) — `beginOAuth`, `completeOAuth`, `cancelOAuth`.
  - [routes/api.js](../../SERVER/src/routes/api.js) — `connectToOrg` (pre-flight before analysis),
    `testConnection`.
  - [metadataService](./metadataService.md) — `describeGlobal`, `describeObjectMultiple`.
- **Depends on**
  - `jsforce` — Salesforce API client.
  - [orgRepository](../../SERVER/src/repositories/orgRepository.js) — token & status persistence.
  - [utils/sfObjectMapper.js](../../SERVER/src/utils/sfObjectMapper.js) and
    [utils/sfFieldMapper.js](../../SERVER/src/utils/sfFieldMapper.js) — normalize raw describe payloads.
  - [lib/logger.js](../../SERVER/src/lib/logger.js) — structured + `toFile` logging.
- **Note:** `extractionService` builds its **own** jsforce connection (with refresh-token support)
  rather than reusing this pool, because Bulk V2 extraction runs as a long background job.

## OAuth2 sequence

```
Frontend popup ─▶ GET /oauth2/auth ─▶ beginOAuth ─▶ Salesforce login
Salesforce ─▶ GET /oauth2/callback?code ─▶ completeOAuth ─▶ orgRepository.update(tokens)
                                                         └─▶ connectionPool.set(sfOrgId, conn)
```
