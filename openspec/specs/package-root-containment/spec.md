# Package Root Containment Specification — RETIRED

**Spec version**: V6
**Status**: RETIRED (owner, archive-sync 2026-07-29 — `inline-collection-marker`, ruling 4)
**Change**: `inline-collection-marker`

V5 → V6 (archive-sync, `inline-collection-marker`, 2026-07-29): this capability RETIRES WHOLESALE. Direction (owner ruling 4): the dual-anchor containment model this family pinned (a RESOLUTION anchor vs a CONTAINMENT ceiling, the latter found via an upward `collection.json` marker walk) is deleted entirely — it was a misplaced SDK-side responsibility guarding a boundary the SDK cannot itself define (the SDK cannot parse the manifest, charter L2), enforced via a presence-marker hack that broke inline-collection CLI projects lacking any ancestor `collection.json` (the bug this change fixes). `packageDir` is now the sole run anchor; for path-carrying (by-reference) directives the engine owns the boundary at apply time (`by-reference-copy-wire` REQ-BRC-02, unchanged, independently live); by-value/inline content has no boundary control on either side, never engine-owned, never SDK-owned — only lexical/hygiene screens apply, which are explicitly not a security boundary. Every requirement below is retired; per the Re-home REQ-ID Rule, no REQ-ID from this family is recycled — a requirement whose CONCERN survives gets a NEW REQ-ID in its destination family, never the same REQ-ID carrying normative text twice. (Previously: REQ-PRC-01 Two Distinct Anchors, no successor — `packageDir` is the sole anchor now; REQ-PRC-02 Ceiling Fixed Once/Never Wire-Authoritative, no successor — no ceiling is derived, and the wire-authoritative promise is independently `by-reference-copy-wire` REQ-BRC-02's; REQ-PRC-03 Missing-Ancestor Fail-Loud, inverse proven by `package-dir-run-anchor` REQ-MFB-01.1; REQ-PRC-04 Source Containment (realpath/segment-aware/regular-file allow-list), SPLIT — lexical `../`/absolute rejection re-homed to `ir-path-well-formedness` REQ-IPF-01, the regular-file allow-list re-homed to `package-source-io-hygiene` REQ-PSH-01, symlink-based escape past the lexical screen is now an accepted, documented residual; REQ-PRC-05 Package-Relative Error Messages, survives as a property of `package-source-io-hygiene` REQ-PSH-01/02/03 and `ir-path-well-formedness` REQ-IPF-01/02, each stating their own no-echo obligation directly; REQ-PRC-06 Destination Containment Post-Render Seam, SDK-side half re-homed to `ir-path-well-formedness` REQ-IPF-02, engine-side half unchanged at `by-reference-copy-wire` REQ-BRC-08; REQ-PRC-07 No Existence Oracle, no successor — there is no longer an in-ceiling/out-of-ceiling distinction to protect, now an accepted residual; REQ-PRC-08 Validated Before Any Content Read, survives as an ordering property of `package-source-io-hygiene` REQ-PSH-01/02/03 and `ir-path-well-formedness` REQ-IPF-01; REQ-PRC-09 SDK Emit-Time Lexical Destination Guard, re-homed verbatim in substance to `ir-path-well-formedness` REQ-IPF-02; REQ-PRC-10 Scaffold Walk ROOT Containment-Checked, SPLIT — the escaping/symlinked-root-rejects-before-enumeration half superseded by `ir-path-well-formedness` REQ-IPF-01's lexical screen at the scaffold-root call site, the missing/non-directory-root no-echo half re-homed to `folder-scaffold` REQ-FSC-10.)

V4 → V5 (judgment-day iteration 2 fix, owner-ratified and signed 2026-07-13): REQ-PRC-10.3 amended — a blind adversarial judge found the walk ROOT's missing/non-directory case reached `walkFolder`'s raw `readdirSync` unguarded, throwing a plain Node `Error` (ENOENT/ENOTDIR) instead of an `AuthoringError` — breaking the no-echo guarantee every other scaffold-family rejection holds (the raw error's message echoes the ABSOLUTE filesystem path) and the `AuthoringError` contract itself (`copyin-parity` asserts `instanceof AuthoringError` for every SDK-side rejection). Scenario REQ-PRC-10.3 now requires BOTH a missing `from` and a `from` that resolves to a regular file to reject `AuthoringError` (reason `invalid-input`) naming only the package-relative path. REQ-ID stable (10.3 amended in place, scenario added); no other REQ-PRC-10 scenario changes.

V3 → V4 (final-verify remediation, owner-ratified and signed 2026-07-13): REQ-PRC-10 added — `scaffold`'s walk ROOT (`from`) must be containment-checked BEFORE `walkFolder` enumerates it; the blind Council's final-verify pass found `runScaffold` walked an unvalidated root, letting an escaping/symlinked `from` enumerate (readdir/lstat, bounded by the 10k-entry cap) an out-of-ceiling subtree before any per-entry check could fire. REQ-IDs stable; additive only.

V2 → V3 (owner micro-unfreeze, 2026-07-12): scenario REQ-PRC-07.2 added — a symlink lexically inside the ceiling whose out-of-ceiling target does NOT exist still rejects fail-loud (kills the existence-oracle-via-ENOENT mutant). REQ-IDs stable.

V1 → V2 (blind council fixes applied): REQ-PRC-07 (no existence oracle — ruling 10 clause restored, B5); REQ-PRC-08 (validation-before-read ordering, S12); REQ-PRC-09 (SDK lexical destination guard, S17); REQ-PRC-04 reworded to an ALLOW-LIST regular-file control (S13) and gains scenarios .4 (non-regular-non-directory), .5 (sibling-prefix, S14), .6 (absolute source, S15), .7 (lexical-vs-realpath, S16); REQ-PRC-06 cross-refs the destination path-form/render seam clauses (S8). All V1 REQ-IDs preserved.

## Purpose

(Previously: pinned the dual-anchor containment model that kept `scaffold`/`copyIn`/
`create({templateFile})` from reading or writing outside the schematic package's own
boundary — two distinct anchors, a RESOLUTION anchor and a CONTAINMENT ceiling found by
walking upward for a marker file.) RETIRED — see this file's V5 → V6 entry above for the
full retirement narrative and per-requirement successor pointers, and the
`inline-collection-marker` change archive
(`openspec/changes/archive/2026-07-29-inline-collection-marker/`) for the complete
signed retirement delta.

## Requirements

None — every requirement in this family is RETIRED. See the V5 → V6 changelog entry
above for the per-requirement disposition and successor REQ-IDs (or the reasoned
absence of one).

## Sensitive Areas Coverage

No sensitive areas covered — this capability is fully retired; its concerns are
redistributed across `package-dir-run-anchor`, `package-source-io-hygiene`,
`ir-path-well-formedness`, and `folder-scaffold`, each carrying its own Sensitive Areas
Coverage table.
