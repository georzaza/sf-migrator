# Middleware Overview

This folder documents every middleware in [SERVER/src/middleware](../../SERVER/src/middleware).
Middleware sits in the Express request pipeline, before route handlers, to handle cross-cutting
concerns: request tracing and authentication.

## Pipeline position

Wired in [SERVER/src/server.js](../../SERVER/src/server.js):

```
app.use(cors(...))
app.use(express.json())
app.use(requestTracer)        ← global: assigns a request ID + log context to EVERY request
app.use('/auth',  authRoutes)
app.use('/api',   apiRoutes)  ← each protected handler runs authMiddleware first
app.use('/',      oauthRoutes)
```

- **`requestTracer`** is registered globally and runs for all requests.
- **`authMiddleware`** is applied per-route inside [routes/api.js](../../SERVER/src/routes/api.js)
  (it guards the `/api` GET/POST/PUT/DELETE handlers). The `/auth` and `/oauth2` routes are public.

## Middleware catalog

| Middleware | Responsibility | Scope |
| --- | --- | --- |
| [requestTracer](./requestTracer.md) | Generate/propagate a request ID and bind log context via `AsyncLocalStorage` | Global |
| [authMiddleware](./authMiddleware.md) | Validate the JWT cookie and attach `req.user` | Per `/api` route |

See each page for behavior, dependencies, and linkage.
