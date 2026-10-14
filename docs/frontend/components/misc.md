# misc components

Source: [sf-migrator/src/components](../../../src/components)

Small standalone components that don't belong to the dashboard or org-management groups.

## FloatingConfigurator.vue

Source: [sf-migrator/src/components/FloatingConfigurator.vue](../../../src/components/FloatingConfigurator.vue)

- **Purpose**: A fixed top-right widget providing a dark-mode toggle and access to the app
  configurator (theme/layout settings).
- **Architecture**: Presentational; uses the `useLayout` composable for dark-mode state and renders an
  `AppConfigurator`. **PrimeVue**: `Button`. No props/emits/stores/API.
- **Used by**: the [auth views](../views/auth.md) (Login, Register, Access, Error).

## Welcome.vue

Source: [sf-migrator/src/components/Welcome.vue](../../../src/components/Welcome.vue)

- **Purpose**: A minimal placeholder landing screen (a card with a "Welcome!" heading).
- **Architecture**: Static; no props/emits/stores/API.
- **Used by**: the router as the `/welcome` route (the default redirect target inside `AppLayout`).
