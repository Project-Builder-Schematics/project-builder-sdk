# Read Trichotomy Helper Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-2-error-attribution`
**Domain**: NEW — **DROPPABLE** (CQ-1 debt; independent of the error-contract
freeze; may ship in a later slice or be re-deferred without blocking 2.1/2.2/2.4)

## Purpose

`find(path).read()` returns `string | undefined | ""` (content / absent /
empty). Today authors branch manually with strict `=== undefined` /
`=== ""` comparisons (documented in JSDoc only) — truthiness-coalescing
(`if (!content)`) silently merges `undefined`, `""`, `"0"`, and `"false"` and
reintroduces the absent-vs-empty bug ADR-0016 fixed at the port level. This
capability gives authors a named, branchable classification instead of
manual comparisons. This is a SUCCESS-PATH helper — it never throws and is
not part of the error-attribution contract.

## Requirements

### REQ-RT-01: Trichotomy Classifier — `classifyContent`

`commons` MUST export a pure function named **`classifyContent`** taking the
`string | undefined` result of a `.read()` call, AND the exported union type
**`ContentState = "absent" | "empty" | "present"`** as its return type —
exported so authors get exhaustive-switch parity with `reason`/`origin`
(the same closed-union consumption pattern, REQ-AEC-04.3).

- `undefined` → `"absent"`
- `""` → `"empty"`
- any other string → `"present"`

The function MUST NOT throw for any string or `undefined` input.

#### Scenario REQ-RT-01.1: Absent classifies correctly

- GIVEN `read()` resolved `undefined`
- WHEN classified via `classifyContent`
- THEN the result is `"absent"`

#### Scenario REQ-RT-01.2: Empty classifies correctly

- GIVEN `read()` resolved `""`
- WHEN classified via `classifyContent`
- THEN the result is `"empty"`

#### Scenario REQ-RT-01.3: Present classifies correctly

- GIVEN `read()` resolved `"some content"`
- WHEN classified via `classifyContent`
- THEN the result is `"present"`

#### Scenario REQ-RT-01.4: ContentState is exported and switch-exhaustive

- GIVEN a consumer importing `ContentState` from `@pbuilder/sdk/commons`
- WHEN it writes a `switch` over a `classifyContent` result covering
  `"absent"`, `"empty"`, `"present"`
- THEN the switch typechecks as exhaustive (a `never` default arm compiles)

### REQ-RT-02: Falsy-Trio Mutant Killers

`classifyContent` MUST classify each of the following as `"present"` — these
are strings that a truthiness-coalescing (`if (!content)`) implementation
would misclassify:

- `"0"`
- `"false"`
- `"   "` (whitespace-only)

#### Scenario REQ-RT-02.1: The literal string "0" is present, not absent

- GIVEN `read()` resolved the string `"0"`
- WHEN classified
- THEN the result is `"present"` (a `!content` mutant would wrongly return
  `"absent"` or `"empty"`)

#### Scenario REQ-RT-02.2: The literal string "false" is present, not absent

- GIVEN `read()` resolved the string `"false"`
- WHEN classified
- THEN the result is `"present"`

#### Scenario REQ-RT-02.3: A whitespace-only string is present, not empty

- GIVEN `read()` resolved `"   "`
- WHEN classified
- THEN the result is `"present"` — NOT `"empty"` (only the exact empty
  string `""` is empty)

### REQ-RT-03: Doc Discoverability

`classifyContent` MUST carry a JSDoc `@example` showing the read-and-branch
flow (`switch (classifyContent(await find(p).read()))` with the three
cases), and `find()`'s JSDoc MUST point to `classifyContent` as the
recommended alternative to manual `=== undefined` / `=== ""` discipline.

#### Scenario REQ-RT-03.1: classifyContent carries a branching @example

- GIVEN `classifyContent`'s emitted JSDoc
- WHEN its `@example` block is inspected
- THEN it shows a `switch` over the three `ContentState` cases fed by a
  `read()` result

#### Scenario REQ-RT-03.2: find() JSDoc points to the helper

- GIVEN `find()`'s JSDoc
- WHEN inspected
- THEN it references `classifyContent` as the branchable alternative to
  manual strict comparisons
