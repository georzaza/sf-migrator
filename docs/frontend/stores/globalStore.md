# globalStore

Source: [sf-migrator/src/stores/globalStore.js](../../../src/stores/globalStore.js)

## Purpose

A reserved, currently-empty Pinia store intended for app-wide global state. It exists as a placeholder
with persistence already enabled so cross-cutting flags can be added without re-wiring.

## Architecture

Options-API store (`defineStore('global', ...)`) with `persist: true`. `state` and `actions` are
empty.

## How it's used / linkage

- Not actively consumed yet. When global UI state is needed (e.g. theme, feature flags, current
  project context), add it here to get persisted, app-wide reactivity.
- **Depends on** Pinia + `pinia-plugin-persistedstate` (configured in `main.js`).
