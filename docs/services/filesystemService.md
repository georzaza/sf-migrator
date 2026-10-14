# filesystemService

Source: [SERVER/src/services/filesystemService.js](../../SERVER/src/services/filesystemService.js)

## Purpose

A small persistence helper that writes and reads **JSON snapshots** to the local filesystem under
`data/{orgId}`. It gives the analysis pipeline a durable, human-inspectable record of describes and
stats without involving the database.

## Architecture

- **Per-org directory** — all artifacts live under `SERVER/data/{orgId}` (resolved relative to the
  service file via `import.meta.url`). Directories are created on demand with `mkdir({ recursive })`.
- **Timestamped filenames** — each write uses an ISO timestamp with `:`/`.` replaced by `-`, producing
  files like `{ts}_objects.json`, `{ts}_fields.json`, `{ts}_stats.json`. Writes never overwrite — each
  run appends a new snapshot.
- **Latest-wins reads** — `getLatestOrgStats` lists `*_stats.json`, sorts descending, and returns the
  newest. Missing directory/files resolve to `null` (treated as "no data yet") rather than throwing.
- **Promise-based fs** — uses `fs.promises` throughout.

## Key functions

| Function | Description |
| --- | --- |
| `saveOrgStatsToFile(orgId, stats)` | Write `{ts}_stats.json`; returns the file path. |
| `getLatestOrgStats(orgId)` | Read & parse the most recent stats snapshot, or `null`. |
| `saveObjectDescribes(orgId, objectDescribes)` | Write `{ts}_objects.json`. |
| `saveFieldDescribes(orgId, fieldDescribes)` | Write `{ts}_fields.json`. |

## How it's used / linkage

- **Consumed by**
  - [metadataService](./metadataService.md) — `saveObjectDescribes`, `saveFieldDescribes` during
    `analyzeAndSaveOrg`.
  - [orgStatsService](./orgStatsService.md) — `saveOrgStatsToFile` at the end of stats calculation.
  - [routes/api.js](../../SERVER/src/routes/api.js) — `getLatestOrgStats` for the `get-org-stats` action.
- **Depends on** Node `fs`/`path` and [lib/logger.js](../../SERVER/src/lib/logger.js) only — no
  Salesforce or database coupling.

## On-disk layout

```
SERVER/data/{orgId}/
  ├─ {timestamp}_objects.json     ← from metadataService
  ├─ {timestamp}_fields.json      ← from metadataService
  ├─ {timestamp}_stats.json       ← from orgStatsService
  └─ Extraction/                  ← written by extractionService (CSV + .query files)
```
