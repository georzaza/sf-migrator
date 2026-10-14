# getKeyCount

Source: [sf-migrator/src/utils/getKeyCount.js](../../../src/utils/getKeyCount.js)

## Purpose

Counts how many times each distinct value of a given key appears across an array of objects — a small
grouping/tally helper for building chart and table aggregates.

## Architecture

A single pure function `getKeyCount(data, key)` that `reduce`s the array into a `{ value: count }`
map. No dependencies, no side effects.

```js
getKeyCount([{ t: 'a' }, { t: 'a' }, { t: 'b' }], 't') // → { a: 2, b: 1 }
```

## How it's used / linkage

- Intended for the org-stats / dashboard components to turn raw record arrays into frequency maps for
  charts (e.g. counts per object/type).
- No imports; safe to reuse anywhere on the client.
