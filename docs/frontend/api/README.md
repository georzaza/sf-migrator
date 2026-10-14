# api

Source: [sf-migrator/src/api](../../../src/api)

The single HTTP layer for the frontend: one configured Axios instance that every store and composable
imports. There are no per-resource API modules — endpoints are selected via an `action` header, so the
Axios instance is the only file here.

## Files

| File | Purpose |
| --- | --- |
| [axiosInstance.md](./axiosInstance.md) | Configured Axios singleton with request-ID tracing interceptors. |
