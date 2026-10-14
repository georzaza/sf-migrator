# axiosInstance

Source: [sf-migrator/src/api/axiosInstance.js](../../../src/api/axiosInstance.js)

## Purpose

The app's single, pre-configured Axios client. Every store and composable imports this instance, so
base URL, credentials, headers, and logging are configured in exactly one place.

## Architecture

- **Instance config**
  - `baseURL: import.meta.env.VITE_API_URL` — backend origin (separate from the Vite dev origin).
  - `Content-Type: application/json; charset=utf-8`.
  - `withCredentials: true` — sends the `auth_token` cookie on every request (cookie-based auth).
  - `validateStatus: status => status < 500` — treats `4xx` as resolved (not thrown), so callers can
    inspect `401 { authUrl }` and validation errors in `.then` instead of `.catch`.
- **Request interceptor** — generates a short request ID (`crypto.randomUUID().slice(0,8)` with a
  `Math.random` fallback), sets it as the `X-Request-ID` header, and opens a `console.group` for the
  call. This pairs with the backend's [requestTracer](../../middleware/requestTracer.md) for
  end-to-end tracing.
- **Response interceptor** — logs status/success and closes the console group. It deliberately does
  **not** redirect on `401 + authUrl`; that case is handled by [useOrgAnalysis](../composables/useOrgAnalysis.md),
  which shows the OAuth overlay first.
- **Error interceptor** — logs message/status/url/action for `5xx` and network errors, then rejects.

## How it's used / linkage

- **Imported by** every Pinia store ([orgStore](../stores/orgStore.md),
  [metadataStore](../stores/metadataStore.md), [mappingStore](../stores/mappingStore.md)) and the
  composables ([useOrgAnalysis](../composables/useOrgAnalysis.md),
  [useAuth](../composables/useAuth.md)).
- **Talks to** the backend `/api`, `/auth`, and `/oauth2` route groups; the specific operation is
  chosen via an `action` request header rather than distinct URLs.
- **Pairs with** the backend `requestTracer` middleware, which echoes `X-Request-ID` back on the
  response for correlation.
