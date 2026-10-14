# auth views

Source: [sf-migrator/src/views/auth](../../../src/views/auth)

The standalone authentication pages, rendered outside `AppLayout`. All four embed
[FloatingConfigurator](../components/misc.md) for theme/dark-mode toggling.

## Login.vue

Source: [sf-migrator/src/views/auth/Login.vue](../../../src/views/auth/Login.vue)

- **Purpose**: Username/email + password login form.
- **Flow**: calls [useAuth](../composables/useAuth.md) `login()`; on success routes to
  `/migration-workspace`, on failure routes to `/auth/access` and toasts the error.
- **Stores**: [userStore](../stores/userStore.md). **PrimeVue**: `InputText`, `Password`, `Checkbox`,
  `Button`, `Toast`. **Route**: `/auth/login`.

## Register.vue

Source: [sf-migrator/src/views/auth/Register.vue](../../../src/views/auth/Register.vue)

- **Purpose**: Account creation (email, password, username, name) with validation.
- **Flow**: POST `/auth/register`, then auto-login via [useAuth](../composables/useAuth.md).
- **Stores**: [userStore](../stores/userStore.md). **PrimeVue**: `InputText`, `Password`, `Button`,
  `Toast`. **Route**: `/auth/register`.

## Access.vue

Source: [sf-migrator/src/views/auth/Access.vue](../../../src/views/auth/Access.vue)

- **Purpose**: "Access denied" page shown when an unauthenticated user hits a protected route (and as
  the login-failure landing). **PrimeVue**: `Button`. **Route**: `/auth/access`.

## Error.vue

Source: [sf-migrator/src/views/auth/Error.vue](../../../src/views/auth/Error.vue)

- **Purpose**: Generic error page with a link back to the dashboard. **Currently not routed** — its
  route is commented out in `src/router/index.js`.

## Linkage

- **Depends on** [useAuth](../composables/useAuth.md) and [userStore](../stores/userStore.md).
- **Router**: the global `beforeEach` guard treats `/auth/*` as public and redirects unauthenticated
  users to `/auth/login`.
- **Backend counterparts**: `/auth` routes ([userRepository](../../repositories/userRepository.md)).
