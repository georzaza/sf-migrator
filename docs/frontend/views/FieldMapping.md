# FieldMapping

Source: [sf-migrator/src/views/FieldMapping.vue](../../../src/views/FieldMapping.vue)

## Purpose

Lets users create and manage **field-level** mappings for a given source/target object pair. Presents
a three-panel layout (source field, mapping options, target field) with a table of existing field
mappings below.

## Architecture

A route view keyed by the `:mappingId` route param (`useRoute`). It delegates all persistence to
[mappingStore](../stores/mappingStore.md) and uses PrimeVue `useToast` for feedback. Supports the
backend mapping types (`as-is`, `expression`, `constant`) via the options panel.

- **Store**: `useMappingStore` (`loadFieldMappings`, `createFieldMapping`, `deleteFieldMapping`, …).
- **Backend `action`s**: `get-field-mappings`, `create-field-mapping`, `delete-field-mapping`.
- **PrimeVue**: `DataTable` + `Column`, `Dropdown`, `Textarea`, `InputText`, `Button`, `Tag`, `Dialog`.

## How it's used / linkage

- **Route**: `/field-mapping/:mappingId` (inside `AppLayout`); typically reached from
  [MigrationWorkspace](./MigrationWorkspace.md).
- **Backend counterparts**: [mappingService](../../services/mappingService.md) /
  [mappingRepository](../../repositories/mappingRepository.md). Expression mappings are validated
  server-side via `utils/transformationRule.js`.
