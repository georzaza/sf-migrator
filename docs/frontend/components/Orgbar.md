# Orgbar

Source: [sf-migrator/src/components/Orgbar.vue](../../../src/components/Orgbar.vue)

## Purpose

The org-management top bar and the main entry point for org actions. It shows the selected-org
dropdown and buttons to add/edit/delete an org, open it in Salesforce, and trigger **analysis**,
**extraction**, and **OAuth login**.

## Architecture

A "smart" component that composes [useOrgAnalysis](../composables/useOrgAnalysis.md) for all async
org behavior and reads/writes [orgStore](../stores/orgStore.md). Uses PrimeVue `useToast` and
`useConfirm` (e.g. delete confirmation) and `useRouter` for navigation.

- **Stores**: `useOrgStore`. **Composables**: `useOrgAnalysis`.
- **Children**: [OAuthRedirectOverlay](./OAuthRedirectOverlay.md) (bound to the composable's overlay
  refs), [OrgFormDialog](./OrgFormDialog.md) (add/edit).
- **PrimeVue**: `Select`, `Button`, `ProgressSpinner`.

## How it's used / linkage

- Mounted at the app layout level so org context is available across authenticated views.
- **Drives** analysis/extraction/OAuth via the composable; **reflects** per-org status (analyzing /
  extracting / logging-in spinners) from the composable's refs.
- **Backend counterparts**: `analyze-org`, `start-extraction`, `get-org-status`,
  `get-extraction-status`, `/oauth2/*`.
