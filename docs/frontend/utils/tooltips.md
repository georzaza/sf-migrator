# tooltips

Source: [sf-migrator/src/utils/tooltips.js](../../../src/utils/tooltips.js)

## Purpose

Centralizes the **explanatory copy** shown alongside org-stats metrics — the title, insights, unit,
and a stable `key` for each platform metric (custom objects, custom fields, record types, Apex
triggers/classes, flows, LWC/Aura, API usage, etc.). Keeping this text in one place keeps the stats UI
consistent and easy to update.

## Architecture

A `Tooltips` class whose constructor builds `this.platformTooltips` via
`initializePlatformTooltipsMap()`. Each entry has the shape
`{ title, description, insights, unitMeasure, key }`. The `key` links a tooltip to its corresponding
metric/widget. The insights text is migration-oriented (IQVIA OCE context).

## How it's used / linkage

- Consumed by the stats components ([OrgStats](../components/OrgStats.md) and the
  [dashboard widgets](../components/dashboard.md)) to render metric descriptions and hover insights.
- Self-contained; no external imports.
