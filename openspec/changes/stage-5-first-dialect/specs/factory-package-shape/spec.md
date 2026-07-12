# Delta for factory-package-shape

**Spec version**: V5
**Status**: signed (owner, 2026-07-12 — V5: owner-authorized micro-unfreeze — reconcile
REQ-FPS-02's exports-map count to the shipped 5-entry reality; no behavioral change;
re-sign authorized for exactly this scope)
**Change**: `stage-5-first-dialect`

## MODIFIED Requirements

### REQ-FPS-02: Package Surface Guard (FIT-14)

Adding `package.json#bin` for the codegen bin MUST NOT alter the exports map beyond this
change's own AUTHORIZED addition. The exports map's expected set is FIVE entries — `.`,
`./commons`, `./conformance`, `./testing`, `./typescript` (`./testing` landed independently
on `main` via `stage-4b-testing-harness` ahead of this branch's own S-002 batch; `./typescript`
is this change's own addition, `foundations-skeleton` REQ-PKG-01) — and MUST NOT gain a
SIXTH. `package.json#dependencies` MUST contain EXACTLY the pinned `ts-morph` entry
(`typescript-dialect` REQ-TSD-06) and nothing else — the zero-deps invariant becomes a
one-deps invariant, still closed.

(Previously: the expected set was exactly three entries and `dependencies` was required to
stay absent/empty; `stage-5-first-dialect` is the first change authorized to grow both. V5:
reconciled the entry count from four to five — `./testing` landed on `main` via
`stage-4b-testing-harness` before this branch's own S-002 batch ran, a fact the original V4
text omitted; the shipped tests [`fit-09-pkg-exports-resolution.test.ts`,
`fit-14-package-surface.test.ts`] always asserted the correct five-entry reality.)

#### Scenario REQ-FPS-02.1: exports map is exactly five entries, dependencies is exactly ts-morph

- GIVEN the published package's `package.json` after this change
- WHEN its `exports` map is inspected
- THEN it is EXACTLY `.`, `./commons`, `./conformance`, `./testing`, `./typescript` — no
  more, no less
- AND a `bin` field is present pointing at the codegen executable
- AND `dependencies` contains EXACTLY one entry, `ts-morph`, exact-pinned (no caret/tilde)

#### Scenario REQ-FPS-02.2: Tarball contents — bin + typescript dist present, nothing else new (SEC-M2)

- GIVEN the package's publishable tarball listing (`bun pm pack --dry-run` or
  `npm pack --dry-run`) before and after this change
- WHEN the file lists are compared
- THEN the codegen bin's file(s) and the `dist/dialects/typescript/**` build output are present in
  the after-listing
- AND no OTHER file beyond what this change's own REQs declare has newly entered the
  tarball

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) — exports map growth to 5 entries | REQ-FPS-02 | Yes |
| security (third-party trust) — first `dependencies` entry (ts-morph) | REQ-FPS-02 | Yes |
