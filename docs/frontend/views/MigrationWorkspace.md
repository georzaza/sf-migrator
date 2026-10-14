# MigrationWorkspace

Source: [sf-migrator/src/views/MigrationWorkspace.vue](../../../src/views/MigrationWorkspace.vue)

## Purpose

The primary workspace for mapping Salesforce **objects** between a source and a target org. Users pick
source/target orgs, search/browse objects via autocomplete, and create object mappings — laid out as
three columns (source, mapping options, target).

## Architecture

A route view (no props/emits) using `<script setup>`. It reads org selection from
[orgStore](../stores/orgStore.md), performs object mapping creation through
[mappingStore](../stores/mappingStore.md), and surfaces feedback with PrimeVue `useToast`. Navigation
uses `useRoute`/`useRouter` (e.g. to drill into field mapping).

- **Stores**: `useOrgStore`, `useMappingStore`.
- **Backend `action`**: `create-mapping` (POST), plus mapping loads via the store.
- **PrimeVue**: `Dropdown`, `AutoComplete`, `Button`, `Message`, `Tag`, `Textarea`, `InputText`.

## How it's used / linkage

- **Route**: `/migration-workspace` (inside `AppLayout`).
- **Navigates to** [FieldMapping](./FieldMapping.md) (`/field-mapping/:mappingId`) to edit field-level
  mappings of a created object pair.
- **Backend counterparts**: [mappingService](../../services/mappingService.md) via `routes/api.js`.
