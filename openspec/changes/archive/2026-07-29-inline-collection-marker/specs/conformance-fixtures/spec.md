# Delta for Conformance Fixtures

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V1 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): this file was introduced at V1 during the V3.2 round (see below) and
is bumped directly to V3.3 here to join this change's spec-bundle lockstep, mirroring
how `golden-corpus-contract` (introduced mid-change) was earlier brought into lockstep
— no additional content delta beyond its V1 introduction.

New minimal delta file added at V3.2 (owner micro-unfreeze, ruling 13, pre-authorized;
plan-verify-2 finding F5). This is DELIBERATELY the smallest possible block — NO
behavioural scenario changes; REQ-CFX-16's five scenarios, fixture layout, and case
table are entirely UNCHANGED. Only its cross-reference sentence needs an archive-sync
annotation, so this delta does NOT use the MODIFIED-Requirements format (which would
require reproducing the ENTIRE ~90-line REQ-CFX-16 block per the "partial MODIFIED is
destructive" rule for one sentence) — it uses a Cross-Reference Amendment note instead,
mirroring the pattern already used for `folder-scaffold`'s Purpose Amendment and
`scenario-matrix`'s Sensitive Areas Coverage Amendment.

## Cross-Reference Amendment

REQ-CFX-16's prose (`openspec/specs/conformance-fixtures/spec.md:581`) states: "an
in-fixture `assets/` source needs ZERO schema changes; flagged for engine-team
awareness, same posture as `conformance-corpus` REQ-CCR-08's `collection.json` note."
`conformance-corpus` REQ-CCR-08 (the `collection.json` marker requirement) is RETIRED by
this change with no successor REQ (see the `conformance-corpus` delta). At
archive-sync, this sentence MUST be re-pointed: either (a) to the retirement pointer —
"...flagged for engine-team awareness; `conformance-corpus`'s prior `collection.json`
marker note this posture once echoed is retired by `inline-collection-marker`, no
successor concept applies here" — or (b) marked historical in place with a dated note.
Choice (a) is RECOMMENDED (consistent with this change's other cross-reference fixes,
which re-point rather than merely annotate), but either satisfies this amendment; no
behavioural scenario in REQ-CFX-16 is affected either way.

## Sensitive Areas Coverage

No sensitive areas covered — unchanged from the signed spec (this amendment touches
prose only).
