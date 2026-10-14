# views

Source: [sf-migrator/src/views](../../../src/views)

Views are route-level components rendered inside `layout/AppLayout.vue` (authenticated) or standalone
(auth pages). They compose [components](../components/README.md), call [stores](../stores/README.md),
and use [composables](../composables/README.md).

> `Dashboard.vue.old` is legacy and intentionally undocumented.

## Catalog

| View | Route | Purpose |
| --- | --- | --- |
| [MigrationWorkspace](./MigrationWorkspace.md) | `/migration-workspace` | Map objects between a source and target org. |
| [FieldMapping](./FieldMapping.md) | `/field-mapping/:mappingId` | Create/manage field mappings for an object pair. |
| [OrgStatsView](./OrgStatsView.md) | `/org-stats` | Thin wrapper around the `OrgStats` dashboard. |
| [auth/* views](./auth.md) | `/auth/login`, `/auth/register`, `/auth/access` | Login, registration, access-denied. |

The `/welcome` route renders [components/Welcome.vue](../components/misc.md) rather than a view.
