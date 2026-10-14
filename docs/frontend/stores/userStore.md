# userStore

Source: [sf-migrator/src/stores/userStore.js](../../../src/stores/userStore.js)

## Purpose

Holds the client-side **authentication flag** and convenience copies of the logged-in user's email and
username. The authoritative identity lives in the HTTP-only `auth_token` cookie; this store mirrors a
few fields for easy template access.

## Architecture

Options-API Pinia store (`defineStore('user', ...)`) with `persist: true`, so the UI can render an
authenticated state immediately on reload (subject to re-validation by the router guard).

## State & actions

| Member | Description |
| --- | --- |
| `isAuthenticated` | Whether the user is considered logged in. |
| `email` / `username` | Cached identity fields (also present in the cookie). |
| `setEmail` / `setUsername` / `setIsAuthenticated` | Setters. |

> The code also references `userStore.serverDown` in [useAuth](../composables/useAuth.md) to flag
> network failures; it is set dynamically rather than declared in initial state.

## How it's used / linkage

- **Consumed by**
  - [useAuth](../composables/useAuth.md) — sets auth fields after login and `isLoggedIn()` checks.
  - [Login](../views/auth.md) / [Register](../views/auth.md) — read/route on auth state.
  - Router guard — gates protected routes via `isLoggedIn()`.
- **Backend counterpart**: `/auth` routes ([userRepository](../../repositories/userRepository.md)).
