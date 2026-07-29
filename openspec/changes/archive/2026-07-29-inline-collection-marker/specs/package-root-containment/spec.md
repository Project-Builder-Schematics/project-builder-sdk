# Delta for Package Root Containment

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.
(REQ-FTG-06 clause (e), which enforces this file's falsifiable criterion, is refined at
V3.3 in `fitness-guards` — no change needed HERE, the criterion text itself is
unaffected.)

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 finding F1): amends the falsifiable acceptance criterion
below to ALLOWLIST version-history/changelog-style notes, rather than trying to scrub
every historical mention from every signed spec file. Rationale for this choice over the
alternative (annotating each historical note "as historical at archive-sync"): this
repo's OWN established convention already treats a `(Previously: ...)` parenthetical or
a `V{n} → V{n+1}` changelog line as a legitimate, permanent record of a retired
concept's name — e.g. `package-root-containment`'s own signed history (before this
change) narrated ADR-0046 and prior REQ text by name across several such notes, and
every delta file in THIS change does the same for THIS retirement. Scrubbing those notes
at archive-sync would destroy exactly the audit trail the versioning convention exists
to preserve, and doing so file-by-file for every future retired concept would not scale.
Allowlisting the PATTERN once, here, is the more convention-consistent and less
destructive fix.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only, plus the
`marker-free-run-bootstrap` → `package-dir-run-anchor` capability rename (owner ruling
7; REQ-ID `REQ-MFB-01` unchanged) reflected in the successor pointers below.

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): "the engine owns
the boundary" is qualified — that is true only for path-carrying (by-reference)
directives; by-value/inline content has NO engine-side (or SDK-side) boundary control
at all, an important distinction this file's intro previously blurred. Adds a
falsifiable, mechanical post-archive-sync acceptance criterion.

This capability RETIRES WHOLESALE. The dual-anchor containment model it pinned
(RESOLUTION anchor vs CONTAINMENT ceiling) is a misplaced SDK-side responsibility — the
SDK cannot parse the manifest (charter L2), so it guarded a boundary it cannot define,
via a presence-marker hack that inline-collection CLI projects break. Direction (owner
ruling 4): full removal of SDK-side containment; the SDK generates IR, and — for
PATH-CARRYING (by-reference) directives ONLY — the engine owns the boundary at apply
time (`by-reference-copy-wire` REQ-BRC-02, unchanged, already live). By-value/inline
content (bytes crossing the wire) has NO boundary control on EITHER side — never
engine-owned, never SDK-owned — only the `ir-path-well-formedness`/
`package-source-io-hygiene` lexical/hygiene screens, which are explicitly NOT a security
boundary (see `package-source-io-hygiene` REQ-PSH-04's residual-risk statement). Every
requirement below is retired; none survives in this family. Per the Re-home REQ-ID
Rule, requirements whose CONCERN survives get a NEW REQ-ID in an explicit destination
family — never the same REQ-ID carrying normative text in two places.

**Falsifiable acceptance criterion (post-archive-sync)**: `rg
'package-root-containment|REQ-PRC-|source-outside-package' openspec/specs/` MUST return
ZERO hits once this change archives and its delta syncs into the main specs — EXCEPT
hits inside an explicit version-history marker: a `(Previously: ...)` parenthetical, or a
`V{n} → V{n+1} (...)` changelog line, in any signed family spec (this change's own
retirement narration, and every other family's pre-existing historical notes, are
exactly this shape). A hit OUTSIDE such a marker — i.e., in a file's LIVE normative
Requirements/Purpose/Sensitive-Areas text — still fails the criterion; this is what the
`by-reference-copy-wire` and `scenario-matrix` V3.2 amendments above exist to clean up.
Permitted hits OUTSIDE `openspec/specs/` entirely — superseded ADRs
(`openspec/decisions/`) and the CHANGELOG — are unaffected by this allowlist, they were
already permitted.

## REMOVED Requirements

### REQ-PRC-01: Two Distinct Anchors

(Reason: the RESOLUTION/CONTAINMENT anchor distinction this REQ pinned no longer
applies — `packageDir` is the sole anchor. Successor: `package-dir-run-anchor`
REQ-MFB-01.)

### REQ-PRC-02: Ceiling Fixed Once at Run Boundary, Never Re-Walked, Never Wire-Authoritative

(Reason: no ceiling is derived, so "fixed once" is moot. The "never wire-authoritative"
clause was never this domain's independent control — `by-reference-copy-wire`
REQ-BRC-02 already pins the engine's re-derivation independently and is UNCHANGED by
this retirement. No successor REQ needed here.)

### REQ-PRC-03: Missing `collection.json` Ancestor → Fail-Loud

(Reason: this is the EXACT failure mode this change deletes — the bug report itself.
No successor; its inverse is proven by `package-dir-run-anchor` REQ-MFB-01.1.)

### REQ-PRC-04: Source Containment — Realpath, Segment-Aware, Regular-Files Allow-List

(Reason: SPLIT. The realpath/segment-aware ceiling comparison (scenarios .1 `../`
traversal, .2 symlink-outside-ceiling, .5 sibling-prefix segment-aware, .6 absolute,
.7 lexically-inside-realpath-outside symlink) has no successor — ceiling comparison no
longer exists; `../`/absolute rejection is now the LEXICAL screen,
`ir-path-well-formedness` REQ-IPF-01. The regular-file allow-list (scenarios .3
directory-as-source, .4 FIFO) is re-homed to `package-source-io-hygiene` REQ-PSH-01 —
this was always IO hygiene, never containment. Symlink-based escape from `packageDir`
past the lexical screen (formerly caught by realpath comparison) is now an ACCEPTED,
documented residual — see the security residual-risk paragraph.)

### REQ-PRC-05: Package-Relative Error Messages

(Reason: the package-relative/no-echo message property survives as a property OF the
successor requirements, not as an independent REQ. Successors: `package-source-io-hygiene`
REQ-PSH-01/02/03 and `ir-path-well-formedness` REQ-IPF-01/02 each state their own
package-relative/no-echo obligation directly.)

### REQ-PRC-06: Destination Containment Post-Render is a Seam Contract

(Reason: this REQ's SDK-side half was the lexical destination guard, now REQ-IPF-02
below. The engine's post-render seam obligation was never independently owned here — it
is `by-reference-copy-wire` REQ-BRC-08, unchanged by this retirement. No new successor
REQ is needed for the seam contract itself.)

### REQ-PRC-07: No Existence Oracle for Out-of-Ceiling Paths

(Reason: the "in-ceiling vs out-of-ceiling" distinction this REQ protected no longer
exists — there is no ceiling. The existence/permission oracle this REQ closed is now an
ACCEPTED, documented residual under the new model (a lexically-rejected path never
reaches an existence probe at all; a non-rejected path's existence/readability
differences are accepted per the security residual-risk paragraph). No successor REQ.)

### REQ-PRC-08: Containment and Eligibility Validated Before Any Content Read

(Reason: the ORDERING invariant survives as a property of the successor checks —
`package-source-io-hygiene` REQ-PSH-01/02/03 and `ir-path-well-formedness` REQ-IPF-01
each already state their own before-any-read ordering. No independent successor REQ.)

### REQ-PRC-09: SDK Emit-Time Lexical Destination Guard

(Reason: SURVIVES per owner ruling 2 — re-homed verbatim in substance. Successor:
`ir-path-well-formedness` REQ-IPF-02.)

### REQ-PRC-10: Scaffold Walk ROOT Is Containment-Checked Before Enumeration

(Reason: SPLIT. Scenarios .1/.2 (lexically-escaping / symlinked-realpath-escaping root
rejects before enumeration) have no successor — the ceiling comparison they relied on
is gone; the check-before-walk ordering they protected is now provided by
`ir-path-well-formedness` REQ-IPF-01's lexical screen at the scaffold-root call site
(REQ-IPF-01.3). Scenarios .3/.3b (missing/non-directory in-ceiling root rejects
`AuthoringError`, package-relative, no raw Node error) are re-homed — the "in-ceiling"
framing drops, but the no-echo/`AuthoringError` ordering property survives. Successor:
`folder-scaffold` REQ-FSC-10.)

## Sensitive Areas Coverage

No sensitive areas covered — this capability is fully retired; its concerns are
redistributed across `package-dir-run-anchor`, `package-source-io-hygiene`,
`ir-path-well-formedness`, and `folder-scaffold`, each carrying its own Sensitive Areas
Coverage table.
