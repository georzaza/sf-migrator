# requestTracer

Source: [SERVER/src/middleware/requestTracer.js](../../SERVER/src/middleware/requestTracer.js)

## Purpose

Gives every request a **correlation ID** and binds a per-request logging context so all log lines
emitted while handling a request can be traced end-to-end — without threading the ID through every
function call.

## Architecture

A global Express middleware built on Node's `AsyncLocalStorage`:

1. **Request ID** — uses the inbound `X-Request-ID` header if present, otherwise generates a short
   `crypto.randomUUID().slice(0, 8)`.
2. **Context capture** — also reads the `action` header and `req.body.orgId` (defaulting to `'-'`).
3. **Expose** — stores the ID on `req.requestId` and echoes it back via the `X-Request-ID` response
   header for client-side correlation.
4. **Bind** — calls `asyncLocalStorage.run({ requestId, action, orgId }, next)` so the logger
   automatically includes this context for the entire async lifetime of the request.

The `asyncLocalStorage` instance is owned by [lib/logger.js](../../SERVER/src/lib/logger.js) and
re-exported here, which is what lets the logger read the active context implicitly.

## How it's used / linkage

- **Registered globally** in [SERVER/src/server.js](../../SERVER/src/server.js)
  (`app.use(requestTracer)`), before all route handlers — so it runs for every request, public or
  protected.
- **Depends on**
  - `crypto` — request-ID generation.
  - [lib/logger.js](../../SERVER/src/lib/logger.js) — shares its `asyncLocalStorage` so log entries
    carry `requestId` / `action` / `orgId` automatically.
- **Frontend contract** — clients may send `X-Request-ID` to trace a call; the same ID is always
  returned on the response.

## Trace propagation

```
incoming request
  └─ requestTracer: requestId (header or random) ─▶ req.requestId + X-Request-ID response header
       └─ asyncLocalStorage.run({ requestId, action, orgId })
            └─ next() … all downstream logger.* calls include this context
```
