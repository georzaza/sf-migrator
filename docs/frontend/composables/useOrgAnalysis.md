# useOrgAnalysis

Source: [sf-migrator/src/composables/useOrgAnalysis.js](../../../src/composables/useOrgAnalysis.js)

## Purpose

The orchestration hub for everything an org can do from the UI: **analyze**, **extract**, **log in via
OAuth**, and **browse objects/fields** — including the background **status polling**, the **OAuth
popup** flow, and all the user-facing toasts. It hides the messy async coordination from components.

## Architecture

A factory `useOrgAnalysis()` that returns reactive state plus action functions. It must run inside a
component `setup` (it uses `useToast`). It reads/writes [orgStore](../stores/orgStore.md) and calls
[axiosInstance](../api/axiosInstance.md) directly.

- **State refs** — `analyzingOrgId`, `extractingOrgId`, `loggingInOrgId`, `objects`, `selectedObject`,
  `fields`, `loadingFields`, `hasAnalysis`, `checkingAnalysis`, plus OAuth overlay state
  (`showingOAuthOverlay`, `oauthOrgName`).
- **Per-org polling** — `statusPollTimers` / `extractionPollTimers` are `Map`s keyed by `orgId`, so
  switching the selected org never cancels another org's in-flight background job.
- **OAuth popup flow** (`triggerOAuthRedirect`) — opens a centered popup to Salesforce, listens for a
  `postMessage` (`sf-oauth-success` / `sf-oauth-error`) validated against the backend origin, and falls
  back to a full-page redirect if the popup is blocked. A `pollTimer` detects a manually-closed popup
  (e.g. `redirect_uri_mismatch`) and shows a helpful toast with the expected callback URL. An
  `oauthPopupActive` guard prevents duplicate popups.
- **Store patching** — `patchOrgInStore` mutates the org in both `orgs[]` and `selectedOrg` to reflect
  status changes live.

## Key functions

| Function | Description |
| --- | --- |
| `checkOrgAnalysis(orgId)` | Loads objects + analysis status; starts polling or triggers OAuth as needed. |
| `doAnalysis()` | POST `analyze-org` (202 → poll; 401 → OAuth). |
| `doExtraction()` | POST `start-extraction` (202 → poll; 401 → OAuth). |
| `beginOAuth()` | Login-only OAuth (no analysis); refreshes orgs on success. |
| `startPolling` / `stopPolling` | Per-org analysis-status polling (3s) → toasts on complete/failed, OAuth on `auth_required`. |
| `startExtractionPolling` / `stopExtractionPolling` | Per-org extraction-status polling (3s) → toasts on complete/failed/`auth_failed`. |
| `onSelectObject(obj)` / `loadFields(obj)` | Object selection + field load for the analysis panel. |
| `resetState()` | Clear visual state on org switch (does **not** stop background polls). |

## Backend `action`s used

`analyze-org`, `start-extraction`, `get-org-status`, `get-extraction-status`, `get-objects`,
`get-fields`, plus `/oauth2/auth` (via popup).

## How it's used / linkage

- **Consumed by** [Orgbar](../components/Orgbar.md), which exposes the analyze / extract / login
  buttons and renders [OAuthRedirectOverlay](../components/OAuthRedirectOverlay.md) bound to the
  overlay state.
- **Depends on** [orgStore](../stores/orgStore.md), [axiosInstance](../api/axiosInstance.md),
  PrimeVue `useToast`.
- **Backend counterparts**: `routes/api.js` (analysis/extraction) + `routes/oauth.js`
  ([salesforceService](../../services/salesforceService.md), [extractionService](../../services/extractionService.md)).

## OAuth popup sequence

```
button ─▶ triggerOAuthRedirect(authUrl, orgId)
   ├─ show overlay → window.open(popup → Salesforce)
   ├─ on postMessage 'sf-oauth-success' → onSuccess() (default doAnalysis)
   ├─ on postMessage 'sf-oauth-error'   → error toast
   └─ popup closed w/o message          → "Authorization Incomplete" toast (callback URL hint)
```
