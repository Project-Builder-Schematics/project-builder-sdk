# Delta for Run-Boundary Input Validation

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 finding F1): no content deltas targeted this domain —
version/status bump only. F1 flagged this file's own V2→V3 header note (below) as an
orphaned `package-root-containment`/`REQ-PRC-` citation risk; resolved via the
`package-root-containment` delta's amended falsifiable criterion, which now allowlists
this exact shape of note (a `V{n} → V{n+1} (...)` changelog line narrating a retired
concept) — no edit needed HERE.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
REQ-RBV-04's driven branch set gains `folder-scaffold` REQ-FSC-10.4 (the new recursive
walk-failure no-echo scenario, ruling 8). Capability cross-reference updated:
`marker-free-run-bootstrap` → `package-dir-run-anchor` (owner ruling 7 rename; REQ-ID
`REQ-MFB-01` unchanged).

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): fixed a genuine
REQ-ID reuse bug — V1 labeled BOTH the retired missing-ancestor scenario AND its new
inverse replacement `REQ-RBV-06.1` in the same file. The retired scenario keeps `.1`
(retired-with-pointer, per id-stability); the new inverse scenario is now
`REQ-RBV-06.2`. REQ-RBV-06 now states the bootstrap read-set's ORDER explicitly
(reserved-name check, THEN schema validation — verified against `context.ts`'s
`defineFactory`, which calls `checkReservedNames` before `validateAtRunBoundary`).
REQ-RBV-04's driven branch set gains the scenarios introduced by this change's V2 edits.

## MODIFIED Requirements

### REQ-RBV-06: Pre-`als.run` Bootstrap Read-Set Is Exactly Two, in a Pinned Order — No Containment-Ceiling Read

The pre-`als.run` chokepoint `defineFactory` uses performs EXACTLY TWO reads, in this
ORDER: (1) reserved-name checking, THEN (2) schema validation (REQ-RBV-01) — matching
`context.ts`'s existing call order (`checkReservedNames` before `validateAtRunBoundary`).
NO third read resolving a package-root/containment-ceiling (`collection.json` ancestor
walk) exists at this site or anywhere else in the run — `package-root-containment`
REQ-PRC-02/03, which this REQ previously coordinated with, is RETIRED; `packageDir` is
the sole run anchor (`package-dir-run-anchor` REQ-MFB-01). There is no analogous
"opt-out" question for a containment read because no containment read exists to opt out
of.

(Previously: this REQ required package-root/containment-ceiling discovery to run at the
SAME pre-`als.run` chokepoint, fail closed on a missing `collection.json` ancestor, with
"no analogous opt-out for containment." That third read is deleted; the bootstrap
read-set SHRINKS from three to two. V1 of this delta did not state whether the
surviving two-read set was ORDERED; V2 pins it explicitly as ordered, matching the
code's own sequencing.)

#### Scenario REQ-RBV-06.1: [RETIRED, id kept as a pointer — not carried forward]

(Previously: this scenario proved a missing-ancestor rejection pre-empted the factory
body via a sentinel `throw`. That mechanism no longer exists. Its id is preserved here,
unused, per id-stability — it is NOT reassigned to new content. The new content lives at
REQ-RBV-06.2 below. Pointer: `package-dir-run-anchor` REQ-MFB-01.1 proves the INVERSE —
the same sentinel-ordering technique, opposite conclusion.)

#### Scenario REQ-RBV-06.2: Bootstrap read-set is exactly two, in order, verified by fs-io instrumentation

- GIVEN a factory run with fs-read instrumentation active at the pre-`als.run`
  chokepoint, in a package with NO `collection.json` anywhere on its ancestor chain
- WHEN the factory runs
- THEN exactly two reads occur before `fn(o)` executes, in order: the reserved-name
  check FIRST, then schema validation — no ancestor-directory read for any marker file
  occurs at any level, and the run does not fail merely because no `collection.json`
  exists

### REQ-RBV-04: Canary-Seeded No-Echo Verification (Cross-Domain, SEC-B1/QA-m2) — Extended to the New Source-Rejection Branches

The no-echo guarantee (REQ-RBV-02, and by the same mechanism REQ-TFO-04's
no-raw-content-echo and `reserved-lifecycle-names` REQ-RLN-02's rejection message) MUST
be verified by a DICTIONARY-SEEDED CANARY SCAN, not by checking for the absence of one
or two known literal strings. Test fixtures MUST seed a unique canary token into every
schema field name/value AND into the resolved-input value under test, then drive EVERY
rejection branch this change introduces (all REQ-RBV-01 sub-scenarios, REQ-TFO-04's bin
error path, REQ-RLN-02's rejection, AND — added by `inline-collection-marker` —
`package-source-io-hygiene` REQ-PSH-01/02/03's source-rejection branches,
`ir-path-well-formedness` REQ-IPF-01's lexical-rejection branches (including the
segment-aware edge cases), `folder-scaffold` REQ-FSC-10's walk-root AND recursive
mid-walk rejection branches, and the REQ-PSH-02.3/02.4/03.2 NUL-byte/broken-symlink/ELOOP
branches) and assert the canary token appears on NO error surface: not the message, not
`.stack`, not any structured field, not captured stdout, not captured stderr. Key NAMES
may legitimately appear in a rejection surface; VALUES must never appear.

(Previously: the enumerated branch set covered only `stage-4-typed-options`'s own
rejections. `inline-collection-marker` extends the driven-branch set to every new
rejection branch this change introduces across `package-source-io-hygiene`,
`ir-path-well-formedness`, and `folder-scaffold` — none of which existed when this REQ
was signed. `package-source-io-hygiene` REQ-PSH-04.1 is deliberately EXCLUDED — it is an
ACCEPT scenario, not a rejection, so there is no error surface to canary-scan. V3
(ruling 8) adds `folder-scaffold` REQ-FSC-10.4, the recursive walk-failure branch, to
the driven set.)

#### Scenario REQ-RBV-04.1: Canary scan across every rejection branch, including the new source/lexical/walk-root/recursive branches

- GIVEN a unique canary token seeded as a resolved-input VALUE and, separately, as a
  package-relative source/destination path fragment, driven through every rejection
  branch (REQ-RBV-01.1 through .7, REQ-TFO-04.1, REQ-RLN-02.1, `package-source-io-hygiene`
  REQ-PSH-01.1/.2/.3, REQ-PSH-02.1/.2/.3/.4, REQ-PSH-03.2, `ir-path-well-formedness`
  REQ-IPF-01.1/.2/.3/.4/.6, REQ-IPF-02.1, `folder-scaffold` REQ-FSC-10.1/.2/.3/.4)
- WHEN each rejection's full error surface (message, `.stack`, structured fields,
  captured stdout/stderr) is scanned for the canary token
- THEN it is found in none of them

#### Scenario REQ-RBV-04.2: Key names may appear, values never (asymmetry pin) [preservation-pin]

(Unchanged from the signed spec — preserved verbatim, no edit.)

- GIVEN a resolved input with an excess key literally named after the canary token
- WHEN the rejection is inspected
- THEN the KEY NAME may legitimately appear (naming the offending key is required per
  REQ-RBV-01.3) — the never-appears assertion is scoped to VALUES, never key names

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation at the run boundary) | REQ-RBV-06, REQ-RBV-04 (both modified by this change) | Yes |
