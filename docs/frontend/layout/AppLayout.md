# AppLayout

Source: [sf-migrator/src/layout/AppLayout.vue](../../../src/layout/AppLayout.vue)

## Purpose

The root structural shell for all **authenticated** routes. The router mounts protected views inside
this layout, which also wires in the global org bar and the app-wide Toast/Confirm dialogs.

## Architecture

A `<script setup>` component with no props, stores, or API calls. It composes:

- [AppTopbar](./AppTopbar.md) — top navigation/actions.
- [Orgbar](../components/Orgbar.md) — org selector + analysis/extraction/OAuth controls.
- `<router-view/>` — the active route view.
- [AppFooter](./AppFooter.md) — footer.
- `<Toast/>` and `<ConfirmDialog/>` — PrimeVue global services used across the app (e.g. by
  `useOrgAnalysis` toasts and `Orgbar` delete confirmation).

Markup uses the `layout-wrapper layout-static` shell classes from the SCSS in `assets/layout/`.

## How it's used / linkage

- **Used by** `src/router/index.js` as the parent `component` for the `/welcome`, `/org-stats`,
  `/migration-workspace`, and `/field-mapping/:mappingId` routes.
- **Children**: [AppTopbar](./AppTopbar.md), [AppFooter](./AppFooter.md),
  [Orgbar](../components/Orgbar.md).
- Auth pages (`/auth/*`) render **outside** this layout.
