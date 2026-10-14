# orgStore

Source: [sf-migrator/src/stores/orgStore.js](../../../src/stores/orgStore.js)

## Purpose

The central store for **Salesforce orgs**: the list, the currently selected org, dialog visibility
flags, and the CRUD/stats operations that back the org bar and dashboard.

## Architecture

Options-API Pinia store (`defineStore('orgs', ...)`) with `persist: true`, so the org list and
selection survive page reloads. All actions call [axiosInstance](../api/axiosInstance.md) against
`/api` using `action` headers and reconcile local state from the `{ success, data }` envelope.

## State

| Field | Description |
| --- | --- |
| `orgs` | Array of org objects loaded from the backend. |
| `selectedOrg` | The active org (kept in sync on reload). |
| `showEditOrgDialog` / `showAddOrgDialog` | Dialog visibility flags. |

## Actions

| Action | Backend `action` | Description |
| --- | --- | --- |
| `setSelectedOrg(org)` | — | Select an org. |
| `closeEditOrgDialog` / `closeAddOrgDialog` | — | Close dialogs. |
| `loadOrgs()` | `get-orgs` | Load orgs; re-syncs `selectedOrg` from the refreshed list. |
| `deleteOrg(orgId)` | `delete-org` | Delete and prune from local state. |
| `getOrgStats(orgId)` | `get-org-stats` | Fetch the latest analysis stats snapshot. |

## How it's used / linkage

- **Consumed by**
  - [Orgbar](../components/Orgbar.md) — org selection, add/edit/delete, drives analysis/extraction.
  - [OrgFormDialog](../components/OrgFormDialog.md) — create/update orgs (then `loadOrgs`).
  - [useOrgAnalysis](../composables/useOrgAnalysis.md) — reads `selectedOrg`, patches `orgs[]` during
    polling, calls `loadOrgs` after OAuth login.
  - [useAuth](../composables/useAuth.md) — calls `loadOrgs()` after a successful login.
- **Depends on** [axiosInstance](../api/axiosInstance.md).
- **Backend counterparts**: [orgRepository](../../repositories/orgRepository.md) via `routes/api.js`.
