# Delta for Conformance Corpus Registry

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
change to this file's own content.

## REMOVED Requirements

### REQ-CCR-08: `collection.json` Package-Anchor Marker (SDK-Runner Requirement)

(Reason: `package-dir-run-anchor` REQ-MFB-01 deletes `resolvePackageRoot` and the
ancestor-marker walk entirely — `packageDir` is the sole run anchor for every fixture
invocation, `src/transport/runner.ts`'s unconditional `packageDir = dirname(<factory
module URL>)` no longer needs any ancestor marker to succeed. `conformance/collection.json`
is deleted along with its two scenarios REQ-CCR-08.1 (the marker letting resolution
succeed) and REQ-CCR-08.2 (a missing marker failing every fixture at exit 1) — both
describe behaviour of a mechanism that no longer exists. No successor REQ in this
family; the corresponding self-check obligation is dropped in the same way,
`conformance-self-check` REQ-CSC-02's amendment.)

## Sensitive Areas Coverage

No sensitive areas covered — unchanged from the signed spec.
