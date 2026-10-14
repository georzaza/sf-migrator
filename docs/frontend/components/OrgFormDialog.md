# OrgFormDialog

Source: [sf-migrator/src/components/dashboard/OrgFormDialog.vue](../../../src/components/dashboard/OrgFormDialog.vue)

## Purpose

A unified modal for **creating a new org** or **editing an existing one**. It validates the Salesforce
login URL, manages OAuth credential fields, and updates the org store in place after a successful save.

## Architecture

- **Props**: `visible` (Boolean, `v-model`), `org` (Object — `null` ⇒ add mode, otherwise edit mode).
- **Emits**: `update:visible` (close), `saved` (after a successful create/update).
- **Store**: [orgStore](../stores/orgStore.md). On save it patches the store entry in place (and
  `selectedOrg` if it matches), mirroring the pattern used by `useOrgAnalysis`.
- **Validation**: enforces the `https://….my.salesforce.com` URL shape. In edit mode, credential
  fields are intentionally left blank so a save doesn't overwrite stored secrets unless re-entered.
- **PrimeVue**: `Dialog`, `InputText`, `InputTextarea`, `Button`.

## Backend `action`s

- `add-org` (PUT) — create.
- `update-org` (PUT) — edit.

## How it's used / linkage

- Rendered by [Orgbar](./Orgbar.md) for add/edit. After save, callers typically `loadOrgs()` to
  refresh.
- **Backend counterparts**: `routes/api.js` + [orgRepository](../../repositories/orgRepository.md);
  the backend also probes the login URL before accepting it.
