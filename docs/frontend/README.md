# Frontend Overview

This documents the Vue 3 single-page app in [sf-migrator/src](../../src). It is organized by the
folders requested: **views**, **stores**, **utils**, **composables**, **components**, and **api**.

> Backend docs live in [docs/services](../services/README.md), [docs/repositories](../repositories/README.md),
> and [docs/middleware](../middleware/README.md). Note that "utils" exists on **both** sides — this
> section covers the **frontend** utils only.

## Stack

- **Vue 3** (`<script setup>` + Composition API and a couple of Options-API stores)
- **Pinia** for state, with `pinia-plugin-persistedstate` (localStorage) on selected stores
- **Vue Router** (`createWebHistory`) with a global auth guard
- **PrimeVue** (Aura theme, dark selector `.app-dark`) for UI, plus Toast/Confirm services
- **Axios** singleton for all HTTP, with request-ID tracing interceptors
- **Vite** build, `@` alias → `src/`

## Layered architecture

```
router ──▶ views ──▶ components ──▶ PrimeVue primitives
   │         │            │
   │         └─ composables (useOrgAnalysis, useAuth)  ← orchestration + side effects
   │                  │
   └─ auth guard ──▶ stores (Pinia: org/metadata/mapping/user/global)
                          │
                          └─ api/axiosInstance ──▶ backend (/api, /auth, /oauth2)
```

- **views** are route targets; they compose components and call stores/composables.
- **components** are reusable UI; "dumb" presentational ones take props/emits, "smart" ones
  (e.g. `Orgbar`) wire up composables and stores.
- **composables** encapsulate cross-cutting async logic (org analysis/extraction/OAuth, auth).
- **stores** hold shared state and wrap backend calls; they are the main `axiosInstance` callers.
- **api** is the single configured Axios instance every store/composable imports.

## Backend contract

Almost every call hits one of three Express route groups via a header-dispatched `action`:

- `/api` — app actions (`get-orgs`, `analyze-org`, `start-extraction`, mappings, metadata, …)
- `/auth` — `login`, `register`, `whoami`
- `/oauth2` — Salesforce OAuth (driven through popups by `useOrgAnalysis`)

See each subsection for file-level detail:

- [views/](./views/README.md)
- [stores/](./stores/README.md)
- [utils/](./utils/README.md)
- [composables/](./composables/README.md)
- [components/](./components/README.md)
- [api/](./api/README.md)
- [layout/](./layout/README.md)

## Routes (from `src/router/index.js`)

| Path | Name | Component | Auth |
| --- | --- | --- | --- |
| `/welcome` | welcome | `components/Welcome.vue` | required |
| `/org-stats` | org-stats | `views/OrgStatsView.vue` | required |
| `/migration-workspace` | migration-workspace | `views/MigrationWorkspace.vue` | required |
| `/field-mapping/:mappingId` | field-mapping | `views/FieldMapping.vue` | required |
| `/auth/login` | login | `views/auth/Login.vue` | public |
| `/auth/register` | register | `views/auth/Register.vue` | public |
| `/auth/access` | accessDenied | `views/auth/Access.vue` | public |

Authenticated routes render inside `layout/AppLayout.vue`. A global `beforeEach` guard calls
`isLoggedIn()` (from [useAuth](./composables/useAuth.md)) and redirects to `/auth/login` when needed.
