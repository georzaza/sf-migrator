# components

Source: [sf-migrator/src/components](../../../src/components)

Reusable UI. Some are "smart" (wire up stores/composables, e.g. `Orgbar`); most dashboard widgets are
"dumb" presentational components driven entirely by props.

> Files ending in `.old.vue` are legacy and intentionally undocumented.

## Catalog

| Component | Type | Purpose |
| --- | --- | --- |
| [Orgbar](./Orgbar.md) | smart | Org selector + add/edit/delete + analysis/extraction/OAuth triggers. |
| [OrgFormDialog](./OrgFormDialog.md) | smart | Add/edit org modal with URL validation. |
| [OAuthRedirectOverlay](./OAuthRedirectOverlay.md) | dumb | Full-screen overlay during OAuth. |
| [OrgStats](./OrgStats.md) | smart | Org capability/health stats dashboard. |
| [dashboard widgets](./dashboard.md) | dumb | `DCharts`, `DTableSortable`, `DWidgetStats`, `OrgOverview`. |
| [misc](./misc.md) | dumb | `FloatingConfigurator`, `Welcome`. |

## Relationships

```
Orgbar
  ├─ OrgFormDialog          (add/edit org)
  ├─ OAuthRedirectOverlay   (bound to useOrgAnalysis overlay state)
  └─ useOrgAnalysis + orgStore

OrgStatsView ─▶ OrgStats ─▶ (DWidgetStats / DCharts / DTableSortable)
auth views ─▶ FloatingConfigurator
```
