# storageUtils2

Source: [sf-migrator/src/utils/storageUtils2.js](../../../src/utils/storageUtils2.js)

## Purpose

Provides a static reference table of **per-record storage sizes** (in KB) for common Salesforce
objects, used to estimate data storage consumption in the org-stats UI.

## Architecture

Exports a single constant `recordSizes` — an array of `{ name, size }` entries sourced from
Salesforce's published storage allocation guidance (e.g. most records = 2 KB, Campaigns = 8 KB,
Person Accounts = 4 KB). Pure data; no logic.

## How it's used / linkage

- Combined with record counts (e.g. from `get-org-stats` storage data) to estimate storage usage by
  object in the stats/dashboard views.
- No imports; reference data only.
