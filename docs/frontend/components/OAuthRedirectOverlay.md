# OAuthRedirectOverlay

Source: [sf-migrator/src/components/OAuthRedirectOverlay.vue](../../../src/components/OAuthRedirectOverlay.vue)

## Purpose

A full-screen overlay shown while a Salesforce OAuth authorization popup is open, telling the user to
complete sign-in in the popup window.

## Architecture

A "dumb" presentational component driven entirely by props; it renders via `Teleport` with custom CSS
(no PrimeVue).

- **Props**: `show` (Boolean — visibility), `orgName` (String — the org being authorized).
- **Emits**: none.

## How it's used / linkage

- Rendered by [Orgbar](./Orgbar.md) and bound to [useOrgAnalysis](../composables/useOrgAnalysis.md)'s
  `showingOAuthOverlay` and `oauthOrgName` refs. The composable toggles the overlay around the OAuth
  popup lifecycle (open → `postMessage` result → close).
