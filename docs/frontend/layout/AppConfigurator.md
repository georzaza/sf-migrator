# AppConfigurator

Source: [sf-migrator/src/layout/AppConfigurator.vue](../../../src/layout/AppConfigurator.vue)

## Purpose

The theme configurator popover: lets the user switch the PrimeVue **preset** (Aura / Lara / Nora),
pick a **primary color** and **surface palette**, and choose the **menu mode** (static / overlay).

## Architecture

A "smart" `<script setup>` component that drives PrimeVue's theming at runtime.

- **Composable**: [useLayout](./useLayout.md) — reads/writes `layoutConfig` (`preset`, `primary`,
  `surface`, `menuMode`) and `isDarkTheme`.
- **PrimeVue theming**: uses `$t`, `updatePreset`, `updateSurfacePalette` from `@primeuix/themes`, with
  the `Aura`/`Lara`/`Nora` presets.
- **Palettes**: large in-file tables of primary colors and surface palettes; `getPresetExt()` builds
  the semantic primary token set (special-casing the `noir` palette to map onto surface tokens).
- **Handlers**: `updateColors`/`applyTheme` apply primary/surface changes; `onPresetChange` re-applies
  the whole preset; `onMenuModeChange` updates layout mode. Changes persist in the shared
  `layoutConfig` reactive object.

## How it's used / linkage

- Rendered inside [AppTopbar](./AppTopbar.md) and by
  [FloatingConfigurator](../components/misc.md) (on the auth pages).
- **Depends on** [useLayout](./useLayout.md) for shared theme state; no API or Pinia store.
