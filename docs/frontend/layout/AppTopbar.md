# AppTopbar

Source: [sf-migrator/src/layout/AppTopbar.vue](../../../src/layout/AppTopbar.vue)

## Purpose

The top navigation bar for authenticated routes: app logo/title (links to `/org-stats`), a dark-mode
toggle, the theme configurator, and the **logout** action.

## Architecture

A "smart" `<script setup>` component.

- **Composable**: [useLayout](./useLayout.md) — `toggleDarkMode`, `isDarkTheme` for the sun/moon toggle.
- **Stores**: [userStore](../stores/userStore.md), [orgStore](../stores/orgStore.md) — reset on logout.
- **Router**: `useRouter` — redirects to the login route after logout.
- **Child**: [AppConfigurator](./AppConfigurator.md) (theme picker).
- **Logout flow** (`logout()`): clears `localStorage`/`sessionStorage`, calls `userStore.$reset()` and
  `orgStore.$reset()`, then GETs `/auth/logout` (`action: logout`) via
  [axiosInstance](../api/axiosInstance.md) and finally routes to `login` regardless of outcome.

## Backend `action`s

- `logout` (GET `/auth/logout`).

## How it's used / linkage

- Rendered by [AppLayout](./AppLayout.md).
- **Backend counterpart**: `/auth/logout` route **(no doc — read source)**; clears the session cookie.
- **Theme**: shares dark-mode state with [FloatingConfigurator](../components/misc.md) via
  [useLayout](./useLayout.md).
