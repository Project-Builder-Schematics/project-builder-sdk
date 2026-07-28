# Delta for Conformance Self-Check

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only, plus the
`marker-free-run-bootstrap` → `package-dir-run-anchor` capability rename (owner ruling
7; REQ-ID `REQ-MFB-01` unchanged).

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): no substantive
change to this file's own content — adds per-scenario RED/preservation markers per the
council's cross-cutting marker requirement.

REQ-CSC-02.3 is owned by THIS family (`conformance-self-check/spec.md:70`) — the
council synthesis's earlier attribution to `conformance-fixtures` was corrected during
propose (`rg "REQ-CSC-02.3" openspec/specs/` returns exactly one hit repo-wide).

## MODIFIED Requirements

### REQ-CSC-02: Seed/Expected/Schematic/Factory Reference Resolution

For every case in every `manifest.json`, when `seed`/`expected` names a directory string
(not the literal `"zero-effect"`/`"empty"`/`null`), the self-check MUST assert that
directory exists under the fixture. When `lowering.mode === "schematic"`, the self-check
MUST assert `schematic/schema.json` and at least one file under `schematic/files/`
exist. The self-check MUST ADDITIONALLY assert that `manifest.json#factory.module`
resolves to an existing file relative to the fixture directory (default `factory.ts`) —
a listed factory pointer that does not resolve on disk is a hard failure of the same
class as a dangling `seed`/`expected` reference.

(Previously: this REQ ADDITIONALLY asserted that `conformance/collection.json`
(`conformance-corpus` REQ-CCR-08) EXISTS and resolves as an ancestor for every fixture —
a corpus lacking this marker made every runner-driven fixture invocation fail at exit 1
before its factory ever ran. `inline-collection-marker` deletes the marker mechanism
entirely (`package-dir-run-anchor` REQ-MFB-01: `packageDir` is the sole run anchor,
no ancestor walk exists) — there is no longer any marker for a fixture invocation to
require, so this clause and its scenario REQ-CSC-02.3 are DROPPED, not merely relaxed.
The seed/expected/schematic/factory reference-resolution checks above are unchanged.)

#### Scenario REQ-CSC-02.1: Dangling expected reference fails [preservation-pin]

- GIVEN a case with `expected: "expected"` but no `expected/` directory on disk
- WHEN the self-check runs
- THEN it fails, naming the fixture and case

#### Scenario REQ-CSC-02.2: Missing factory.ts file fails [preservation-pin]

- GIVEN a fixture's `manifest.json#factory.module` names `"factory.ts"` but no such file
  exists in the fixture directory
- WHEN the self-check runs
- THEN it fails, naming the fixture and the unresolved factory path

(Previously — RETIRED, not carried forward: scenario REQ-CSC-02.3 asserted a missing
`conformance/collection.json` failed the whole corpus. No successor scenario exists —
the marker this scenario guarded no longer exists, so there is nothing left to fail on.)

## Sensitive Areas Coverage

No sensitive areas covered — unchanged from the signed spec (structural-only: parses
JSON and checks the filesystem).
