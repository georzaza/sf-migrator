# useAuth

Source: [sf-migrator/src/composables/auth/useAuth.js](../../../src/composables/auth/useAuth.js)

## Purpose

Handles user **login** and **session validation**. It authenticates against `/auth`, hydrates the user
store, and provides the `isLoggedIn()` check used by the router guard.

## Architecture

Two exports:

- **`useAuth()`** — a factory returning `{ login }`. Must run in a component `setup` because it uses
  the stores. `login(email, password)`:
  1. POST `/auth/login` (`action: login`).
  2. On `200`, GET `/auth/whoami` to fetch identity.
  3. Hydrates [userStore](../stores/userStore.md) (`isAuthenticated`, `email`, `username`) and calls
     `orgStore.loadOrgs()`.
  4. On network error, sets `userStore.serverDown` so the UI can react.
- **`isLoggedIn()`** — a standalone async function (callable outside components) that GETs
  `/auth/whoami`; on `200` it hydrates the user store and returns `true`, else `false`. Network errors
  set `serverDown`.

Relies on the `auth_token` cookie sent automatically by [axiosInstance](../api/axiosInstance.md)
(`withCredentials: true`).

## How it's used / linkage

- **Consumed by**
  - [Login](../views/auth.md) / [Register](../views/auth.md) — call `login()`.
  - Router guard (`src/router/index.js`) — calls `isLoggedIn()` in `beforeEach` to gate routes.
- **Depends on** [userStore](../stores/userStore.md), [orgStore](../stores/orgStore.md),
  [axiosInstance](../api/axiosInstance.md).
- **Backend counterparts**: `/auth` routes + [userRepository](../../repositories/userRepository.md),
  and JWT validation in [authMiddleware](../../middleware/authMiddleware.md).

## Auth flow

```
Login.vue ─▶ useAuth().login(email, pw)
   └─ POST /auth/login → 200 → GET /auth/whoami
        └─ userStore hydrate + orgStore.loadOrgs()

router.beforeEach ─▶ isLoggedIn() ─▶ GET /auth/whoami (cookie) → true/false
```
