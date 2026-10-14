# OrgStatsView

Source: [sf-migrator/src/views/OrgStatsView.vue](../../../src/views/OrgStatsView.vue)

## Purpose

A thin route wrapper that renders the [OrgStats](../components/OrgStats.md) dashboard component. It
exists so org statistics have a dedicated route while the heavy lifting stays in the component.

## Architecture

Minimal `<script setup>` view with no props, stores, or API calls — it simply mounts `OrgStats`.

## How it's used / linkage

- **Route**: `/org-stats` (inside `AppLayout`).
- **Renders** [OrgStats](../components/OrgStats.md), which loads and visualizes the org capability/
  health metrics.
