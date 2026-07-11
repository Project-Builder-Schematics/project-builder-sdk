# Delta for factory-package-shape

**Spec version**: V4
**Status**: signed (owner, 2026-07-11 — V4; final-loop deltas ratified)
**Change**: `stage-5-first-dialect`

## MODIFIED Requirements

### REQ-FPS-02: Package Surface Guard (FIT-14)

Adding `package.json#bin` for the codegen bin MUST NOT alter the exports map beyond this
change's own AUTHORIZED addition. The exports map's expected set is now FOUR entries — `.`,
`./commons`, `./conformance`, `./typescript` (the last added by `stage-5-first-dialect`,
`foundations-skeleton` REQ-PKG-01) — and MUST NOT gain a FIFTH. `package.json#dependencies`
MUST contain EXACTLY the pinned `ts-morph` entry (`typescript-dialect` REQ-TSD-06) and
nothing else — the zero-deps invariant becomes a one-deps invariant, still closed.

(Previously: the expected set was exactly three entries and `dependencies` was required to
stay absent/empty; `stage-5-first-dialect` is the first change authorized to grow both.)

#### Scenario REQ-FPS-02.1: exports map is exactly four entries, dependencies is exactly ts-morph

- GIVEN the published package's `package.json` after this change
- WHEN its `exports` map is inspected
- THEN it is EXACTLY `.`, `./commons`, `./conformance`, `./typescript` — no more, no less
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
| public-api (contract) — exports map growth to 4 entries | REQ-FPS-02 | Yes |
| security (third-party trust) — first `dependencies` entry (ts-morph) | REQ-FPS-02 | Yes |
