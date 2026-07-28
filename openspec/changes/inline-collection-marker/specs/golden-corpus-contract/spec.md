# Delta for Golden Corpus Contract

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V1 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
this file was introduced at V2 of the overall change spec (see below) and is bumped
directly to V3 here to keep this change's spec bundle in lockstep at the shared
sign-off point — no additional content delta beyond its V1/V2 introduction.

New delta file added at V2 of this change's spec (blind spec council — BA/QA/security,
`yes-with-edits` ×3, security-blocking): `golden-corpus-contract` was NOT among the
originally-pinned families, but its REQ-GCC-08 cites the now-retired
`package-root-containment` REQ-PRC-06 as a literal the coverage manifest MUST contain.
Left unfixed, the manifest would be required to cite a REQ-ID that no longer exists
anywhere in `openspec/specs/` after this change archives — the change would fail its
own final-verify gate against its own coverage-completeness check.

## MODIFIED Requirements

### REQ-GCC-08: Coverage Manifest — Two Ledgers Plus Friction, Completeness Defined

The corpus MUST be accompanied by a coverage manifest containing: (a) an EXERCISED
ledger mapping REQ-IDs to matrix rows; (b) a NOT-EXERCISED ledger of honest gaps; and
(c) the `FRICTION` section (`author-emulation-generator` REQ-AEG-06). "Complete" is
this literal checklist — `sdd-verify --mode=final` MUST fail if any item is missing
(D2 mechanical check):

1. EXERCISED lists EVERY `schematic-local-files` REQ-ID cited anywhere in the
   `scenario-matrix` table, each mapped to its row id(s).
2. NOT-EXERCISED contains the literal entries `module-wiring`, `tsconfig-AST`
   (gap source: `author-emulation-generator` REQ-AEG-02), and `template rendering`
   (gap source: `ir-transcript-capture` REQ-ITC-03's evidence boundary).
3. NOT-EXERCISED contains the literal engine-gated entry `REQ-BRC-08`.
4. The `FRICTION` section exists (≥1 entry or the literal `none observed`).

(Previously: item 3 also required the literal `REQ-PRC-06` (`scenario-matrix`
REQ-SCM-02) alongside `REQ-BRC-08`. `package-root-containment`, the family that defined
REQ-PRC-06, is retired wholesale by `inline-collection-marker` with NO successor REQ for
that specific citation (its SDK-side half re-homes to `ir-path-well-formedness`
REQ-IPF-02, which is SDK-testable and therefore does NOT belong in an engine-gated
NOT-EXERCISED ledger; its engine-side half was always `by-reference-copy-wire`
REQ-BRC-08's obligation, unchanged). Requiring the manifest to keep citing a retired,
non-existent REQ-ID would be a genuine drift the moment this change archives — dropped,
not merely deprioritized. The "five literals" total in REQ-GCC-08.1 below is now "four"
(items 2's three plus item 3's one).)

#### Scenario REQ-GCC-08.1: Manifest passes the four-point completeness checklist [red-today]

- GIVEN the coverage manifest
- WHEN checked against the four checklist items above
- THEN all four hold; removing any single matrix-cited REQ-ID from EXERCISED, or any
  of the FOUR literals from NOT-EXERCISED (`module-wiring`, `tsconfig-AST`, `template
  rendering`, `REQ-BRC-08`), or the FRICTION section, fails the check

(Previously: "any of the five literals" — `REQ-PRC-06` was the fifth; see the REQ-level
note above for why it is dropped, not merely renamed.)

## Sensitive Areas Coverage

No sensitive areas covered — unchanged from the signed spec (this is a documentation/
manifest-completeness contract, no runtime authority).
