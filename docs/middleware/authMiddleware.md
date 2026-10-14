# authMiddleware

Source: [SERVER/src/middleware/authMiddleware.js](../../SERVER/src/middleware/authMiddleware.js)

## Purpose

Guards protected endpoints by validating the **JWT auth cookie** on each request and attaching the
resolved user to `req.user`. Unauthenticated or invalid requests are short-circuited with a
standardized error response.

## Architecture

A standard Express `(req, res, next)` middleware:

1. **Header guard** — rejects requests missing required headers or the `action` header (`400`).
2. **Cookie parse** — extracts `auth_token` from the `Cookie` header via
   [utils/parseCookies.js](../../SERVER/src/utils/parseCookies.js); missing token → `401`.
3. **JWT verify** — `jwt.verify(token, process.env.JWT_SECRET)`. On `TokenExpiredError` → `401`; any
   other verification failure → `403`.
4. **User resolution** — `userRepository.findById(userData.id)`; missing user → `404`.
5. **Attach & continue** — sets `req.user = fullUser` and calls `next()`.

All responses go through [utils/sendResponse.js](../../SERVER/src/utils/sendResponse.js) for a
consistent shape.

## How it's used / linkage

- **Applied by** [routes/api.js](../../SERVER/src/routes/api.js) — passed as the second argument to
  the GET/POST/PUT/DELETE `/api` handlers, so every API action runs behind it. The `/auth` and
  `/oauth2` routes are intentionally public.
- **Depends on**
  - `jsonwebtoken` — token verification.
  - [userRepository](../repositories/userRepository.md) — `findById` to load the full user.
  - [utils/parseCookies.js](../../SERVER/src/utils/parseCookies.js) — cookie extraction.
  - [utils/sendResponse.js](../../SERVER/src/utils/sendResponse.js) — standardized responses.
  - [lib/logger.js](../../SERVER/src/lib/logger.js).
- **Produces** `req.user`, consumed downstream by handlers (e.g. `get-orgs` uses `req.user.id`,
  `add-org` stamps `userId: req.user.id`).

## Decision flow

```
missing headers/action ─▶ 400
no auth_token cookie   ─▶ 401
token expired          ─▶ 401
token invalid          ─▶ 403
user not found         ─▶ 404
valid                  ─▶ req.user set → next()
```
