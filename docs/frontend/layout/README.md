# layout

Source: [sf-migrator/src/layout](../../../src/layout)

The app's structural shell for authenticated routes plus the theme/dark-mode system. `AppLayout` is
the component the router mounts the protected routes into; the rest provide the top bar, footer, theme
configurator, and the shared `useLayout` composable.

## Layering

```
router (authenticated routes)
  └─ AppLayout.vue
       ├─ AppTopbar.vue ──▶ AppConfigurator.vue ──┐
       ├─ Orgbar.vue (see components/Orgbar.md)    ├─▶ useLayout (composables/layout.js)
       ├─ <router-view/> (the active view)         │
       ├─ AppFooter.vue                            │
       ├─ <Toast/> + <ConfirmDialog/>              │
       └─ FloatingConfigurator.vue (auth pages) ───┘
```

## Catalog

| File | Type | Purpose |
| --- | --- | --- |
| [AppLayout](./AppLayout.md) | shell | Root layout: topbar + org bar + router-view + footer + global Toast/ConfirmDialog. |
| [AppTopbar](./AppTopbar.md) | smart | Logo/nav, dark-mode toggle, configurator, and logout. |
| [AppFooter](./AppFooter.md) | dumb | Static footer (copyright/credits). |
| [AppConfigurator](./AppConfigurator.md) | smart | Theme preset / primary+surface palette / menu-mode picker. |
| [useLayout](./useLayout.md) | composable | Shared reactive layout/theme state (`composables/layout.js`). |

## Notes

- `useLayout` is the dark-mode/theme source consumed across the app (also by
  [FloatingConfigurator](../components/misc.md)).
- `AppTopbar` is the only layout piece that performs an API call (logout); the rest are presentational
  or theme-only.
