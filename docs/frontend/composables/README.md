# composables

Source: [sf-migrator/src/composables](../../../src/composables)

Composables encapsulate reusable, stateful async logic built on the Composition API. They sit between
components and stores/API, owning side effects like polling, popups, and toasts.

## Catalog

| Composable | Responsibility | Primary consumer |
| --- | --- | --- |
| [useOrgAnalysis](./useOrgAnalysis.md) | Org analysis, extraction, OAuth popup + status polling | [Orgbar](../components/Orgbar.md) |
| [useAuth](./useAuth.md) | Login and `isLoggedIn()` session check | auth views + router guard |

## Notes

- `useOrgAnalysis` is **factory-style** (returns refs + functions) and must be called inside a
  component's `setup`, since it uses `useToast`.
- `useAuth` exports both a `useAuth()` factory (for `login`) and a standalone `isLoggedIn()` used by
  the router guard outside of components.
