# Transformation Formulas — User Guide

This guide explains the **formula language** you can type into the *Expression/Transform* box when mapping a source field to a target field. A formula takes the values from one source record and computes the value to load into the target.

You don't need to be a programmer. If you've ever written a spreadsheet formula, this will feel familiar.

---

## The basics

A formula is a single expression, for example:

```text
{Account.BillingCity} || '_' || {Account.Name}
```

For a record where `BillingCity` is `Athens` and `Name` is `Acme`, this produces:

```text
Athens_Acme
```

There are only four building blocks you need to know:

1. **Fields** — values read from the source record.
2. **Text and numbers** — fixed values you type in.
3. **Operators** — `||`, `+`, `-`, `*`, `/`, and comparisons.
4. **Functions** — named helpers like `UPPER(...)` or `IF(...)`.

---

## 1. Fields (reading source data)

A field reference pulls a value out of the current record. Write it with the object name, a dot, and the field name:

```text
Account.Name
```

You may also wrap it in curly braces. Both forms mean exactly the same thing; braces just make long formulas easier to read:

```text
{Account.Name}
```

You can follow relationships with more dots:

```text
Account.Owner.Name
```

If a field is empty or missing, it is treated as blank.

---

## 2. Text and numbers (constant values)

- **Text** must be wrapped in quotes — single or double:

  ```text
  'Active'
  "Active"
  ```

- **Numbers** are written plainly, no quotes:

  ```text
  42
  3.5
  ```

---

## 3. Operators

### Join text with `||`

`||` glues pieces of text together (concatenation):

```text
{Account.Name} || ' - ' || {Account.BillingCity}
```
→ `Acme - Athens`

### Math with `+ - * /`

Works on numeric fields and numbers:

```text
{Account.NumberOfEmployees} + 1
{Account.NumberOfEmployees} * 2
{Account.NumberOfEmployees} / 10
```

Use parentheses to control the order:

```text
({Account.NumberOfEmployees} + 10) * 2
```

> Multiplication and division happen before addition and subtraction, just like
> in math. If a value needed for the calculation is empty, the result is blank.

### Comparisons

These ask a yes/no question and return **true** or **false**. They are mostly used inside `IF(...)` (see below):

| Operator | Meaning |
| --- | --- |
| `=` | equal to |
| `!=` | not equal to |
| `<` | less than |
| `<=` | less than or equal |
| `>` | greater than |
| `>=` | greater than or equal |

```text
{Account.NumberOfEmployees} > 100
{Account.BillingCity} = 'Athens'
```

---

## 4. Functions

A function has a name followed by parentheses containing its inputs (arguments), separated by commas. Function names are **not** case-sensitive, so `UPPER` and `upper` are the same.

### Text functions

| Function | What it does | Example | Result |
| --- | --- | --- | --- |
| `UPPER(text)` | Makes text uppercase | `UPPER({Account.Name})` | `ACME` |
| `LOWER(text)` | Makes text lowercase | `LOWER({Account.Name})` | `acme` |
| `TRIM(text)` | Removes leading/trailing spaces | `TRIM({Account.Name})` | `Acme` |
| `LEN(text)` | Counts the characters | `LEN({Account.Name})` | `4` |
| `SUBSTR(text, start, end)` | Extracts part of the text | `SUBSTR({Account.Name}, 1, 3)` | `Acm` |

> **`SUBSTR` positions start at 1** and include both the start and end
> positions. `SUBSTR('Acme', 1, 3)` returns characters 1 through 3 → `Acm`.

### Date functions

These expect a date/datetime field. If the input isn't a valid date, the result is blank.

| Function | What it does | Example |
| --- | --- | --- |
| `DATE(value)` | Keeps the date only | `DATE({Account.CreatedDate})` |
| `DATETIME(value)` | Keeps date and time | `DATETIME({Account.CreatedDate})` |
| `ADDDAYS(date, n)` | Adds `n` days to a date | `ADDDAYS({Account.CreatedDate}, 30)` |
| `ADDHOURS(datetime, n)` | Adds `n` hours | `ADDHOURS({Account.CreatedDate}, 12)` |

### `IF(...)` — choose between two values

`IF(condition, valueIfTrue, valueIfFalse)` checks a condition and returns one of two values:

```text
IF({Account.NumberOfEmployees} > 1000, 'Enterprise', 'SMB')
```
→ `Enterprise` when there are more than 1000 employees, otherwise `SMB`.

You can nest `IF` to handle more than two cases:

```text
IF({Account.NumberOfEmployees} > 1000, 'Enterprise',
   IF({Account.NumberOfEmployees} > 100, 'Mid-Market', 'SMB'))
```

### `COALESCE(...)` — first value that isn't blank

`COALESCE` returns the first argument that has a value. Great for fallbacks and
defaults:

```text
COALESCE({Account.BillingCity}, 'Unknown')
```
→ the city, or `Unknown` if the city is blank.

```text
COALESCE({Account.Description}, {Account.Name}, 'N/A')
```
→ tries Description, then Name, then the literal `N/A`.

---

## Putting it together

Functions, operators, fields and constants can all be combined freely. A few worked examples:

**Label accounts by size, falling back to a default city:**

```text
IF({Account.NumberOfEmployees} > 500,
   UPPER({Account.Name}) || '_' || COALESCE({Account.BillingCity}, 'HQ'),
   LOWER(SUBSTR({Account.Name}, 1, 5)))
```

**Build a code from several fields:**

```text
COALESCE({Account.BillingCity}, 'City') || '-' ||
SUBSTR(UPPER(TRIM({Account.Name})), 1, 8) || '-' ||
({Account.NumberOfEmployees} * 2)
```

**Blank out long account numbers, otherwise build a key:**

```text
IF(LEN({Account.AccountNumber}) > 8, 'NULL',
   {Account.BillingCity} || '_' || {Account.Name})
```

---

## Quick reference

| Category | Syntax | Notes |
| --- | --- | --- |
| Field | `Account.Name` or `{Account.Name}` | Braces are optional |
| Text constant | `'hello'` or `"hello"` | Always quoted |
| Number constant | `42`, `3.5` | No quotes |
| Join text | `a \|\| b` | Concatenation |
| Math | `+ - * /` | Use `( )` to group |
| Compare | `= != < <= > >=` | Returns true/false |
| Choose | `IF(cond, then, else)` | Nest for more cases |
| Default | `COALESCE(a, b, …)` | First non-blank wins |
| Text helpers | `UPPER LOWER TRIM LEN SUBSTR` | |
| Date helpers | `DATE DATETIME ADDDAYS ADDHOURS` | Need a date input |

---

## Tips & common mistakes

- **Quote your text.** `Active` is read as a field path; `'Active'` is the word Active.
- **Braces wrap one field only.** `{Account.Name}` is fine, but `{Account.Name || 'x'}` is not — put the braces around the field, not the whole expression: `{Account.Name} || 'x'`.
- **Empty values become blank**, not errors. Math or dates on a blank value simply produce a blank result.
- **Commas separate arguments** inside functions: `IF(a, b, c)`.
- **`IF` needs exactly three parts**: the condition, the true value, and the false value.
