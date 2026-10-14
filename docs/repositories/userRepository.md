# userRepository

Source: [SERVER/src/repositories/userRepository.js](../../SERVER/src/repositories/userRepository.js)

## Purpose

Database access for the **`User`** model — application accounts used for authentication. It backs both
login/registration and per-request token validation.

## Architecture

Thin, stateless wrapper over the `User` Sequelize model. Lookups return a model instance or `null`.
`updateLastLogin` is intentionally fault-tolerant: it swallows errors and returns `null` so a failed
timestamp write never blocks a login.

## Key functions

| Function | Description |
| --- | --- |
| `findByEmail(email)` | Lookup by email (login + duplicate check on register). |
| `findByUsername(username)` | Lookup by username (login + duplicate check on register). |
| `findById(id)` | Lookup by PK (token validation). |
| `create(userData)` | Insert a new user (registration). |
| `updateLastLogin(id)` | Best-effort `lastLogin` timestamp update; never throws. |

## How it's used / linkage

- **Consumed by**
  - [authMiddleware](../middleware/authMiddleware.md) — `findById` to resolve the JWT subject into a
    full user on every protected request.
  - [routes/auth.js](../../SERVER/src/routes/auth.js) — `findByEmail` / `findByUsername` for login and
    duplicate checks, `create` for registration, `updateLastLogin` after a successful login, and
    `findById` for token-based re-validation.
- **Depends on** `User` (Sequelize) and [lib/logger.js](../../SERVER/src/lib/logger.js).

## Auth touchpoints

```
auth.js login    → findByEmail / findByUsername → (verify password) → updateLastLogin
auth.js register → findByEmail / findByUsername (uniqueness) → create
authMiddleware   → findById (resolve JWT → req.user)
```
