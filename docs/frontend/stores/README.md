# stores

Source: [sf-migrator/src/stores](../../../src/stores)

Pinia stores hold shared client state and act as the primary callers of
[api/axiosInstance](../api/axiosInstance.md). Two stores use the **Options API** style with
`persist: true` (localStorage), while the metadata/mapping stores use the **Setup (Composition)** style.

## Layering

```
views / components / composables ──▶ stores ──▶ axiosInstance ──▶ backend (/api, /auth)
```

## Store catalog

| Store | Style | Persisted | Responsibility |
| --- | --- | --- | --- |
| [orgStore](./orgStore.md) | Options | yes | Org list, selection, dialogs, CRUD, stats fetch |
| [metadataStore](./metadataStore.md) | Setup | no | Cache objects-by-org & fields-by-object, selection details |
| [mappingStore](./mappingStore.md) | Setup | no | Object & field mapping CRUD + derived getters |
| [userStore](./userStore.md) | Options | yes | Auth flag, email, username |
| [globalStore](./globalStore.md) | Options | yes | Reserved/empty placeholder |

## Conventions

- **Action header dispatch** — every store call sends an `action` header to `/api`; the response
  envelope is `{ success, message, data }`.
- **Loading/error** — the Setup-style stores expose `loading`/`error` refs; the Options-style stores
  keep state minimal.
- **Persistence** — `persist: true` snapshots state to localStorage, so org/user selection survives
  reloads.
