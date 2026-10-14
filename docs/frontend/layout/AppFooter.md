# AppFooter

Source: [sf-migrator/src/layout/AppFooter.vue](../../../src/layout/AppFooter.vue)

## Purpose

A static footer shown at the bottom of the authenticated layout — copyright year, developer credit,
and the app name.

## Architecture

A minimal `<script setup>` component. Its only logic is computing the current year
(`new Date().getFullYear()`). No props, emits, stores, or API. Styling is scoped, using theme CSS
variables (`--primary-color`, `--text-color-secondary`, …) with a responsive stacked layout on small
screens.

## How it's used / linkage

- Rendered by [AppLayout](./AppLayout.md). Purely presentational.
