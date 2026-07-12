# Delta for foundations-skeleton

**Spec version**: V4
**Status**: signed (owner, 2026-07-12 — V4: owner-authorized micro-unfreeze — reconcile
REQ-FIT-01 walk semantics to the verify-plan-5 ratified ruling and REQ-PKG-01's exports
enumeration to the shipped 5-entry reality; no behavioral change; re-sign authorized for
exactly this scope)
**Change**: `stage-5-first-dialect`

## MODIFIED Requirements

### REQ-PKG-01: Subpath exports, no kit leak

`package.json#exports` MUST expose `.` (umbrella → commons surface), `./commons`,
`./conformance`, `./testing`, `./typescript`, and MUST NOT expose `./core`/`./internal`/
`./kit`. The dialect subpath is now WIRED — exactly `./typescript` (frozen, ADR-0014
amendment; `typescript-dialect` REQ-TSD-01) — no other dialect subpath exists and no general
dialect-naming convention is established by this wiring.

(Previously: "The reserved dialect subpath is documented, NOT wired." — this change is the
trigger event ADR-0014 anticipated. V4: added `./testing` to the enumeration — it landed on
`main` via `stage-4b-testing-harness` ahead of this branch and was omitted from the original
V1-V3 text; this REQ never claimed exhaustiveness, but the enumeration itself was stale.)

- GIVEN the package, WHEN a consumer imports `@pbuilder/sdk/core`, THEN resolution fails;
  AND `@pbuilder/sdk/commons` resolves.
- GIVEN the package, WHEN a consumer imports `@pbuilder/sdk/typescript`, THEN resolution
  succeeds (NEW scenario).

### REQ-STD-01: Public-repo standards + contributor on-ramp doc

CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (MUST state the explicit-trust posture: importing any
dialect/op-pack runs its code with full process privilege; no sandbox/signing in v1; vet
before importing), issue/PR templates, CI runs on forks/PRs. SECURITY.md MUST ALSO carry a
`.raw()`-SPECIFIC verbatim trust sentence (full-privilege, not-a-sandbox, seam-is-the-only-
guarantee) PLUS a "conformance ≠ safety" caveat (passing the conformance kit,
`dialect-conformance`, is not a security attestation). A guard test MUST pin BOTH the general
explicit-trust sentence and the new `.raw()`-specific sentence + caveat as EXACT substrings.
`docs/authoring-a-dialect.md` graduates from a titled stub to REAL, ACCURATE content per
`dialect-authoring-standards` REQ-DAS-01/02 — the guard test also asserts the file exists
with its mandated sections.

(Previously: the doc was a stub with content deferred to T-M2 and the guard covered only the
general explicit-trust sentence; this change lands the guard test itself, closing
pending-changes row W5.)

- GIVEN the repo, THEN `docs/authoring-a-dialect.md` exists with the REQ-DAS-01 mandated
  sections; AND SECURITY.md states the explicit-trust posture verbatim.
- GIVEN SECURITY.md, THEN it ALSO contains the `.raw()`-specific trust sentence and the
  "conformance ≠ safety" caveat verbatim, and a guard test fails RED if either substring is
  removed (NEW scenario).

### REQ-FIT-01: commons imports zero AST libs, TRANSITIVELY

Import-GRAPH walk over `src/commons/**`'s relative-import closure (not just each file's own
direct specifiers): the walk FOLLOWS every relative-import edge to any depth — legitimate
non-core SDK-internal targets reached this way (e.g. `../core`, `../dry-run`) are traversal
edges, NOT violations — and FAILS on any BARE non-builtin specifier reached at ANY depth
through that chain (esp. ts-morph/postcss/cheerio/babel). The invariant is "zero external
packages reachable from commons", NOT "commons only imports core" — a target-allow-list
reading (relative imports must resolve into core) is REJECTED, since it would flag today's
legitimate `../dry-run` imports as violations. MUST land and be GREEN (walking-skeleton slice
S-000) BEFORE ts-morph enters `package.json#dependencies` — this ordering is load-bearing,
not incidental.

(Previously: scanned each commons file's own direct import specifiers only — a relative
import that ITSELF imported an AST lib, transitively, was invisible to the scanner. This
closes tracked debt row W2. V4: reconciled the walk-semantics description to the
verify-plan-5 ratified ruling — a target-allow-list reading was drafted then explicitly
REJECTED before sign-off; the shipped scanner always implemented the ratified "zero external
packages reachable" invariant, not the target-allow-list text this REQ previously carried.)

- EVERY FIT REQ (shared, unchanged): a meta-test MUST demonstrate the function fails RED
  against a deliberate violation.
- NEW: GIVEN a fixture where `src/commons/leaf.ts` has no direct AST import but relatively
  imports `src/commons/helper.ts`, which DOES import `ts-morph`, WHEN the scanner runs, THEN
  it fails RED — the TRANSITIVE planted red-proof (proves the walk, not just direct-import
  scanning).

### REQ-FIT-03: Per-subpath payload budgets

`bun build` of the `/commons` entry MUST stay under **50 KB** minified AND contain no AST-lib
module specifier (unchanged). The NEW `/typescript` entry gets its OWN budget line, sized in
design to accommodate the pinned ts-morph dependency and codified as a committed numeric
constant — NOT an exemption from budgeting. Both entries MUST ship a fixture AST-import
(commons) / oversized-bundle (typescript) proving each budget fires red independently.

(Previously: a single `/commons` budget; no other subpath existed to budget.)

- GIVEN `/commons`'s build output, THEN it stays under 50 KB minified (unchanged).
- NEW: GIVEN `/typescript`'s build output, THEN it stays under its own committed budget
  constant; a fixture exceeding it fails red.

### REQ-FIT-04: public `.d.ts` semver gate

Committed baseline + CI diff; a breaking export change without a version bump fails. The
baseline pair set MUST include a NEW `typescript.index.d.ts` baseline for the `./typescript`
subpath (alongside the existing `index`/`commons.index`/`conformance.index`/`core.*` pairs)
— its FIRST commit is additive by definition (a brand-new subpath); subsequent changes to it
are gated the same as every other baseline.

(Previously: no `./typescript` baseline existed because the subpath was unwired.)

- GIVEN the `./typescript` subpath's emitted `.d.ts`, THEN a committed
  `typescript.index.d.ts` baseline exists and CI diffs against it on every change (NEW
  scenario).

### REQ-FIT-05: only serializable bytes cross the seam

`JSON.parse(JSON.stringify(directive))` deep-equals. Extends to the COALESCED dialect
`modify` directive path (`modify-coalescing` REQ-MC-01/02): the directive's `content` MUST
be a plain resolved string by construction (`DirectiveFactory` stays AST-blind, ADR-0006) —
this REQ's assertion runs against dialect-produced directives too, not only hand-built ones.

(Previously: asserted only against `DirectiveFactory`'s hand-built directive shapes; no
dialect-produced directive existed yet.)

- GIVEN a coalesced `modify` directive produced by a real TypeScript-dialect chain, THEN
  `JSON.parse(JSON.stringify(directive))` deep-equals the directive (NEW scenario).

### REQ-FIT-06: every public export carries a JSDoc `@example` — gate covers every WIRED public subpath

The `@example` gate MUST cover every WIRED public subpath uniformly — it is not left to
authoring convention per-subpath. `./typescript`'s entry verb, `find` (`dialect-generics`
REQ-DG-01.2), is gate-covered by this SAME fitness function, exactly as `./commons`'s and
`./conformance`'s public exports already are: the new subpath's `@example` obligation is
enforced structurally the moment the subpath is wired, not deferred to convention.

(Previously: the gate covered `./commons`/`./conformance`/`core` public exports; no dialect
subpath existed to cover.)

- GIVEN `@pbuilder/sdk/typescript`'s `find`, THEN it carries a JSDoc `@example` demonstrating
  a runnable chain, gated by the SAME REQ-FIT-06 fitness function as every other public
  export (NEW scenario).
- GIVEN a fixture where `find`'s `@example` is removed, WHEN REQ-FIT-06's fitness function
  runs, THEN it fails RED — proving `./typescript` is gate-covered, not convention-covered.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — `.raw()` trust sentence | REQ-STD-01 | Yes |
| security (third-party trust) — dialect leaf isolation | REQ-FIT-01, REQ-FIT-03 | Yes |
| public-api (contract) — new subpath surface | REQ-PKG-01, REQ-FIT-04, REQ-FIT-06 | Yes |
