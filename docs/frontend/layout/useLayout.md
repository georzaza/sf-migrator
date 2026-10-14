# useLayout

Source: [sf-migrator/src/layout/composables/layout.js](../../../src/layout/composables/layout.js)

## Purpose

The shared layout/theme composable. It owns the app's reactive **layout config** and **layout state**
and exposes the dark-mode toggle, menu toggle, and theme getters used across the shell and theme UI.

## Architecture

Module-level `reactive` singletons (shared across all callers, not per-instance):

- **`layoutConfig`** — `{ preset: 'Aura', primary: 'emerald', surface: null, darkTheme: false,
  menuMode: 'static' }`.
- **`layoutState`** — menu/sidebar visibility flags (`staticMenuDesktopInactive`, `overlayMenuActive`,
  `configSidebarVisible`, `activeMenuItem`, …).

`useLayout()` returns these plus helpers:

| Member | Description |
| --- | --- |
| `toggleDarkMode()` | Toggles `app-dark` on `<html>`, using `document.startViewTransition` when available. |
| `toggleMenu()` | Toggles overlay/static/mobile menu based on mode + viewport width. |
| `setActiveMenuItem(item)` | Tracks the active menu item. |
| `isDarkTheme` / `isSidebarActive` / `getPrimary` / `getSurface` | Computed getters. |

## How it's used / linkage

- **Consumed by** [AppTopbar](./AppTopbar.md), [AppConfigurator](./AppConfigurator.md),
  [FloatingConfigurator](../components/misc.md), and the dashboard charts
  ([DCharts](../components/dashboard.md)) for theme-aware colors.
- The dark selector (`.app-dark`) matches the PrimeVue config in `main.js`
  (see [frontend/README.md](../README.md)).
- Self-contained; no stores or API.
