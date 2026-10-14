# TRANSFORMATIONS — ETL Transformation Roadmap

**Status**: design + foundation in progress
**Last updated**: 2026-10-10

This document is the source-of-truth roadmap for the SF Migrator transformation
layer. It records what a *complete* ETL mapping engine must cover, how we model it,
and which parts are built vs. planned. Mappings are the source of truth: a mapping
is an analyzable data structure that drives extraction (which fields to query),
transform (how to compute target values), and load (ordering + reference
resolution).

---

## Design principle: two layers

There are two fundamentally different kinds of "transformation", and they live in
two different layers. Conflating them is what makes mapping engines hit walls.

### Layer 1 — Expression tree (value computation)

*Given one record's inputs, compute one output value.* Stored as a typed,
composable **node tree** (JSONB), not an opaque string. A DSL string and a visual
builder are just editors that serialize to/from this tree. Adding a capability =
registering one node type with four concerns:

- `validate(node, ctx)` — structural + semantic validation
- `evaluate(node, record, ctx)` — compute the value for a record
- `collectFields(node, set)` — which source field paths it reads (drives extraction)
- `outputType(node, ctx)` — inferred result type (drives design-time checks)

The `custom` node is a universal escape hatch — one node among many, not a
privileged path. With `field` + `const` + functions + `if` + comparison/arithmetic
+ `coalesce` + `valueMap` + `custom`, Layer 1 is **complete for value logic**.

### Layer 2 — Pipeline operators (data flow / shape)

Operations across *rows* and *datasets* that an expression tree cannot express.
The operator set is small and closed (relational algebra + a few ETL extensions),
so it does not grow unboundedly. Expression trees are embedded inside each
operator.

Expression tree (unbounded value logic) + fixed ~10-operator pipeline algebra
(unbounded data-flow logic) = genuinely all ETL transformations.

---

## Capability matrix

### Layer 1 — value transforms (node types)

| Capability | Node kind | Status | Notes |
| --- | --- | --- | --- |
| Direct copy (as-is) | `field` | ✅ built | Folds legacy `as-is` mapping. |
| Chained relationship fields | `field` (dotted path) | ✅ built | `{Account.Owner.Name}`; path traversal already supported. |
| Constant / static value | `const` | ✅ built | Folds legacy `constant` mapping. |
| Concatenation (arbitrary N) | `concat` | ✅ built | Folds legacy `||`. |
| Substring | `func:SUBSTR` | ✅ built | Folds legacy `SUBSTR`. |
| Datetime ↔ date | `func:DATE` / `func:DATETIME` | ✅ built | Format coercion. |
| Add time to a date | `func:ADDDAYS` (+ADDHOURS…) | ✅ built | Date arithmetic. |
| Length | `func:LEN` | ✅ built | For length-based conditions. |
| Case / trim | `func:UPPER/LOWER/TRIM` | ✅ built | String helpers. |
| Arithmetic (`sourceField + 1`) | `binop` | ✅ built | `+ - * /`. |
| Comparison | `compare` | ✅ built | `= != < <= > >=`. |
| Conditional (if / else) | `if` | ✅ built | `IF(cond, then, else)`. |
| First non-null / default | `coalesce` | ✅ built | "Default to X if blank". |
| Value map / picklist translation | `valueMap` | ✅ built | Dictionary + default. |
| Custom (escape hatch) | `custom` | 🚧 planned | Sandboxed named function from a registry. |

### Layer 2 — pipeline operators (record shape / sets)

| Capability | Operator | Status | Notes |
| --- | --- | --- | --- |
| 1 row → 1 row (project) | `map` | ✅ built | The stg1→stg2 transform (current). |
| Drop rows by predicate | `filter` | 🚧 planned | Row-level rejection at transform stage. |
| 1 row → N rows (e.g. Phone1/Phone2 → ContactPointPhone) | `explode` / `unpivot` | ✅ built | `RecordExpansion` object-level transform; see below. |
| N rows → 1 row (rollups) | `aggregate` | 🚧 planned | Group + aggregate across rows. |
| Resolve lookup to target Id / External Id | `join` / `lookup` | 🚧 planned | Load-stage reference resolution. |
| Deduplicate / pick best | `dedup` / `window` | 🚧 planned | Needs the whole set. |
| Surrogate keys / running totals | `window` / `sequence` | 🚧 planned | Needs order/state across rows. |
| Sort before load | `sort` | 🚧 planned | Set-level ordering. |
| Route one source → many targets | `split` / `fan-out` | 🚧 planned | Branching data flow. |

Because the staging DB (Postgres `stg1_*` / `stg2_*`) is itself a set engine, most
Layer-2 operators compile to SQL joins / group-bys / window functions rather than a
hand-built dataflow engine.

---

## Cross-cutting concerns (not pure transforms)

| Concern | Status | Notes |
| --- | --- | --- |
| Null / default handling | ✅ via `coalesce` | Distinct from `constant`. |
| Type coercion & truncation | 🚧 partial | Advisory type warnings exist in `validationService`; runtime coercion planned. |
| Record-type / owner remapping | 🚧 planned | RecordTypeId / OwnerId rarely match across orgs. |
| Dedup / upsert external keys | 🚧 planned | Which field(s) form the match key. |
| Auto-map by name / similarity (≥90%) | 🚧 planned | Matching feature, separate from transform algebra. |
| Reference resolution across orgs | 🚧 planned | Dependency-graph driven at load stage. |

---

## Known hard limits (architecture cannot conjure these)

- **Missing External Ids on objects that do not support them** — if the target
  object has no external key and one cannot be created, no transform model can
  resolve the reference. Needs a pre-scan to flag objects for manual migration.
- **Bulk API constraints** — some payloads (e.g. signatures) may require the REST
  API instead of Bulk.
- **External enrichment / non-deterministic matching** — expressible via `custom`,
  but these are I/O and matching concerns, not expressiveness gaps.

---

## Storage model

`FieldMapping.transform` (JSONB, nullable) holds the canonical Layer-1 node tree.
Legacy columns (`mappingType`, `transformationRule`, `constantValue`) remain for
backward compatibility; when `transform` is null the tree is derived on the fly via
`mappingToTree()` so nothing breaks. New mappings should populate `transform`.

Node tree JSON shapes:

```jsonc
{ "kind": "field",   "path": "Account.Owner.Name" }
{ "kind": "const",   "value": "ACTIVE" }
{ "kind": "concat",  "parts": [ <node>, <node>, ... ] }
{ "kind": "func",    "name": "SUBSTR", "args": [ <node>, <node>, <node> ] }
{ "kind": "binop",   "op": "+", "left": <node>, "right": <node> }
{ "kind": "compare", "op": "<", "left": <node>, "right": <node> }
{ "kind": "if",      "cond": <node>, "then": <node>, "else": <node> }
{ "kind": "coalesce","args": [ <node>, <node>, ... ] }
{ "kind": "valueMap","input": <node>, "table": { "A": "Active" }, "default": <node|null> }
{ "kind": "custom",  "name": "myFn", "args": [ <node>, ... ] }   // planned
```

Implementation: [SERVER/src/utils/transformTree.js](../SERVER/src/utils/transformTree.js).

## Record expansion (explode / Layer 2)

`RecordExpansion` ([model](../SERVER/models/RecordExpansion.js),
[service](../SERVER/src/services/recordExpansionService.js)) implements 1-source-row
→ N-target-rows. It is an object-level transform keyed by `(sourceObjectId,
targetObjectId)` — not a `FieldMapping` — so it sidesteps the one-mapping-per-
target-field constraint. Each **variant** yields one target row:

```jsonc
{
  "variants": [
    {
      "key": "phone1",
      "filter": { "kind": "field", "path": "Phone1" },        // emit only when truthy (null = always)
      "fields": {
        "TelephoneNumber": { "kind": "field", "path": "Phone1" },
        "Name":            { "kind": "const", "value": "Primary" }
      }
    },
    {
      "key": "phone2",
      "filter": { "kind": "field", "path": "Phone2" },
      "fields": {
        "TelephoneNumber": { "kind": "field", "path": "Phone2" },
        "Name":            { "kind": "const", "value": "Secondary" }
      }
    }
  ]
}
```

Field values and the optional `filter` are ordinary transform trees, evaluated by
the same engine. When a target object has an expansion, the transform stage
([transformService.js](../SERVER/src/services/transformService.js)) emits one stg2
row per passing variant per driving source row, and extraction planning pulls the
source fields the variant trees reference. A target owned by an expansion is fully
defined by its variants (its flat field mappings, if any, are not separately
emitted).

API actions: `get-record-expansions`, `upsert-record-expansion`,
`delete-record-expansion`. The variant builder UI is
[src/components/mapping/RecordExpansionDialog.vue](../src/components/mapping/RecordExpansionDialog.vue),
opened from the Migration Workspace ("Record Expansion (Explode)").

## Input surfaces (progressive disclosure)

The tree is the storage format; editors serialize to/from it.

- **Tier 0 — As-Is / Constant**: unchanged point-and-click; emits a single `field`
  or `const` node.
- **Tier 2 — Formula box** (built): the "Expression/Transform" type accepts a
  formula compiled to a tree by
  [SERVER/src/utils/expressionParser.js](../SERVER/src/utils/expressionParser.js).
  Supports field refs (`{Object.Field}` or bare `Object.Field`), `||` concat,
  `+ - * /`, comparisons, `IF(cond, then, else)`, `COALESCE(...)`, and the function
  table (`SUBSTR`, `LEN`, `UPPER`, `LOWER`, `TRIM`, `DATE`, `DATETIME`, `ADDDAYS`,
  `ADDHOURS`). On save the compiled tree is stored in `FieldMapping.transform` as
  the source of truth; the raw formula is retained for display/editing.
- **Tier 1 — Visual builder** (built): a recursive node editor
  ([src/components/mapping/TransformNodeEditor.vue](../src/components/mapping/TransformNodeEditor.vue))
  with function pickers, if/else, compare/math, concat/coalesce lists, and a
  value-map table. Composes the tree without syntax and sends it directly as
  `FieldMapping.transform`. Toggle between Formula and Builder in the
  Expression/Transform mapping type.
- **Tier 3 — Custom node** (planned): a sandboxed named function; one `custom`
  node among the rest.
