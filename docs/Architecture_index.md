# Architecture Index (AI Doc-Router)

> **Purpose (for the AI assistant):** Read this file FIRST when starting any task in this repo.
> It maps tasks and code areas to the existing `.md` documentation so you can read the docs
> instead of re-reading source files. Only open actual source when the docs are insufficient or
> you are about to edit code. Keep this index updated when docs or structure change.

## How to use

1. Find your task in the **Task lookup** table → open the listed doc(s).
2. If you need structure/location, use the **Structural map**.
3. Areas marked **(no doc — read source)** have no `.md` yet; the source path is given.
4. After reading the relevant doc(s), you usually have enough context to plan the change without
   reading every source file.

---

## Task lookup

| If the task involves… | Read this doc | Backend/Frontend |
| --- | --- | --- |
| Salesforce connection, OAuth2 flow, describe/query/insert | [services/salesforceService.md](./services/salesforceService.md) | BE |
| Analyzing an org / persisting object & field metadata | [services/metadataService.md](./services/metadataService.md) | BE |
| Org health/usage/security stats | [services/orgStatsService.md](./services/orgStatsService.md) | BE |
| Bulk record export, staging tables (`stg1_*`/`ext_*`), CSV | [services/extractionService.md](./services/extractionService.md) | BE |
| Field/object mapping business logic & validation | [services/mappingService.md](./services/mappingService.md) | BE |
| Writing JSON snapshots under `data/{orgId}` | [services/filesystemService.md](./services/filesystemService.md) | BE |
| Org DB rows, tokens, analysis/extraction status | [repositories/orgRepository.md](./repositories/orgRepository.md) | BE |
| Object/field DB upserts, stats, bulk writes | [repositories/metadataRepository.md](./repositories/metadataRepository.md) | BE |
| FieldMapping persistence / eager joins | [repositories/mappingRepository.md](./repositories/mappingRepository.md) | BE |
| User lookup/create/last-login | [repositories/userRepository.md](./repositories/userRepository.md) | BE |
| JWT cookie auth on `/api` routes | [middleware/authMiddleware.md](./middleware/authMiddleware.md) | BE |
| Request IDs / log correlation / tracing | [middleware/requestTracer.md](./middleware/requestTracer.md) | BE |
| HTTP client config, interceptors, `action` headers | [frontend/api/axiosInstance.md](./frontend/api/axiosInstance.md) | FE |
| Org list/selection/dialogs/CRUD state | [frontend/stores/orgStore.md](./frontend/stores/orgStore.md) | FE |
| Cached objects/fields on the client | [frontend/stores/metadataStore.md](./frontend/stores/metadataStore.md) | FE |
| Mapping state + CRUD on the client | [frontend/stores/mappingStore.md](./frontend/stores/mappingStore.md) | FE |
| Auth flag / identity in the client | [frontend/stores/userStore.md](./frontend/stores/userStore.md) | FE |
| App-wide global state (placeholder) | [frontend/stores/globalStore.md](./frontend/stores/globalStore.md) | FE |
| Analyze/extract/OAuth popup + status polling | [frontend/composables/useOrgAnalysis.md](./frontend/composables/useOrgAnalysis.md) | FE |
| Login / session check (`isLoggedIn`) | [frontend/composables/useAuth.md](./frontend/composables/useAuth.md) | FE |
| Object-to-object mapping screen | [frontend/views/MigrationWorkspace.md](./frontend/views/MigrationWorkspace.md) | FE |
| Field-level mapping screen | [frontend/views/FieldMapping.md](./frontend/views/FieldMapping.md) | FE |
| Org stats page wrapper | [frontend/views/OrgStatsView.md](./frontend/views/OrgStatsView.md) | FE |
| Login/Register/Access pages | [frontend/views/auth.md](./frontend/views/auth.md) | FE |
| Org top bar (analyze/extract/login buttons) | [frontend/components/Orgbar.md](./frontend/components/Orgbar.md) | FE |
| Add/Edit org modal | [frontend/components/OrgFormDialog.md](./frontend/components/OrgFormDialog.md) | FE |
| OAuth overlay UI | [frontend/components/OAuthRedirectOverlay.md](./frontend/components/OAuthRedirectOverlay.md) | FE |
| Stats dashboard component | [frontend/components/OrgStats.md](./frontend/components/OrgStats.md) | FE |
| Charts/tables/stat cards/org overview panel | [frontend/components/dashboard.md](./frontend/components/dashboard.md) | FE |
| Dark-mode toggle / welcome screen | [frontend/components/misc.md](./frontend/components/misc.md) | FE |
| App shell (topbar + org bar + router-view + footer) | [frontend/layout/AppLayout.md](./frontend/layout/AppLayout.md) | FE |
| Top bar / logout / theme toggle | [frontend/layout/AppTopbar.md](./frontend/layout/AppTopbar.md) | FE |
| Theme preset / palette / menu-mode configurator | [frontend/layout/AppConfigurator.md](./frontend/layout/AppConfigurator.md) | FE |
| Shared layout/theme state + dark mode (`useLayout`) | [frontend/layout/useLayout.md](./frontend/layout/useLayout.md) | FE |
| Frontend helper data (counts, storage sizes, tooltips) | [frontend/utils/README.md](./frontend/utils/README.md) | FE |

### Cross-cutting flows (read the linked docs together)

- **Connect an org (OAuth):** [useOrgAnalysis](./frontend/composables/useOrgAnalysis.md) →
  [salesforceService](./services/salesforceService.md) → [orgRepository](./repositories/orgRepository.md).
  Routes: `SERVER/src/routes/oauth.js` **(no doc — read source)**.
- **Analyze an org:** [Orgbar](./frontend/components/Orgbar.md) /
  [useOrgAnalysis](./frontend/composables/useOrgAnalysis.md) →
  [metadataService](./services/metadataService.md) → [orgStatsService](./services/orgStatsService.md) →
  [metadataRepository](./repositories/metadataRepository.md) +
  [filesystemService](./services/filesystemService.md).
- **Extract records:** [useOrgAnalysis](./frontend/composables/useOrgAnalysis.md) →
  [extractionService](./services/extractionService.md) → [mappingService](./services/mappingService.md) +
  [metadataRepository](./repositories/metadataRepository.md).
- **Auth/login:** [useAuth](./frontend/composables/useAuth.md) +
  [userStore](./frontend/stores/userStore.md) →
  [authMiddleware](./middleware/authMiddleware.md) + [userRepository](./repositories/userRepository.md).
  Routes: `SERVER/src/routes/auth.js` **(no doc — read source)**.

---

## Structural map

### Documentation tree (`docs/`)

```
docs/
├── Architecture_index.md            ← THIS FILE (read first)
├── services/        README + 6 service docs        (BE business logic)
├── repositories/    README + 4 repository docs     (BE data access)
├── middleware/      README + 2 middleware docs      (BE request pipeline)
└── frontend/        README + api/stores/composables/utils/views/components
```
Pre-existing design docs (not part of this index's per-module set):
`docs/ARCHITECTURE.md`, `docs/Migration.md`, `docs/Cloudflare.md`,
`docs/ConnectedApp Creation.md`, `docs/fields.json`.

### Backend (`SERVER/`)

| Area | Doc | Source (when no doc) |
| --- | --- | --- |
| Services | [services/](./services/README.md) | `SERVER/src/services/` |
| Repositories | [repositories/](./repositories/README.md) | `SERVER/src/repositories/` |
| Middleware | [middleware/](./middleware/README.md) | `SERVER/src/middleware/` |
| HTTP routes (`/api`, `/auth`, `/oauth2`) | **(no doc — read source)** | `SERVER/src/routes/{api,auth,oauth,validator}.js` |
| Sequelize models | **(no doc — read source)** | `SERVER/models/{index,SfOrg,SfObjectMetadata,SfFieldMetadata,FieldMapping,User,MigrationJob}.js` |
| Logger (structured + file + AsyncLocalStorage) | referenced in middleware docs | `SERVER/src/lib/logger.js` |
| BE utils (mappers, cookie/url/response helpers, rule parser) | partially referenced in repo/service docs | `SERVER/src/utils/{sfObjectMapper,sfFieldMapper,transformationRule,parseCookies,probeUrl,sendResponse,popupResultHtml,excludedObjects}.js` |
| Object-exclusion config | referenced in [metadataService](./services/metadataService.md) | `SERVER/src/services/config/objectsToExclude.js` |
| Reference SOQL/Tooling queries (WIP) | noted in [orgStatsService](./services/orgStatsService.md) | `SERVER/src/services/queries/{toolingAPIqueries,restAPIqueries}.js` |
| Migrations / seeders / scripts / config | **(no doc — read source)** | `SERVER/{migrations,seeders,scripts,config}/` |
| Server bootstrap | **(no doc — read source)** | `SERVER/src/server.js` |

> Key model facts already captured in repo docs: `SfObjectMetadata` ↔ `SfFieldMetadata` (alias
> `fields`), `FieldMapping` joins source/target object+field, `isFormula`/`isRollUpSummary` are
> Postgres generated columns. Read the model source only if you need column-level detail beyond this.

### Frontend (`src/`)

| Area | Doc | Source (when no doc) |
| --- | --- | --- |
| HTTP client | [frontend/api/](./frontend/api/README.md) | `src/api/axiosInstance.js` |
| Pinia stores | [frontend/stores/](./frontend/stores/README.md) | `src/stores/` |
| Composables | [frontend/composables/](./frontend/composables/README.md) | `src/composables/` |
| FE utils | [frontend/utils/](./frontend/utils/README.md) | `src/utils/` |
| Views | [frontend/views/](./frontend/views/README.md) | `src/views/` |
| Components | [frontend/components/](./frontend/components/README.md) | `src/components/` |
| Router + auth guard | summarized in [frontend/README.md](./frontend/README.md) | `src/router/index.js` |
| Layout shell | [frontend/layout/README.md](./frontend/layout/README.md) | — |
| App bootstrap (Pinia/PrimeVue/Router wiring) | summarized in [frontend/README.md](./frontend/README.md) | `src/main.js`, `src/App.vue` |

> `.old`/`.vue.old` files are legacy and intentionally undocumented — do not rely on them.

---

## Maintenance notes (for the AI)

- When you add/rename a documented module, update its category `README.md` **and** the tables above.
- When you document a **(no doc — read source)** area, replace its row's pointer with the new `.md`.
- This repo is a multi-root workspace; the documented app lives under `sf-migrator/`. Paths in the
  tables are relative to `sf-migrator/docs/`.
