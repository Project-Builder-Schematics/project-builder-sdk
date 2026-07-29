# Delta for By-Reference Copy Wire

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 finding F1): adds MODIFIED REQ-BRC-08 — its scenario
REQ-BRC-08.2 cited the now-retired `package-root-containment` REQ-PRC-06 as "the
post-render containment check"; reworded to cite REQ-BRC-08 itself (the engine's own
post-render obligation is self-contained, it never needed the retired REQ-PRC-06 label).
The "Seam Obligations Status" retirement note below is extended: at archive-sync, the
main family spec's status paragraph MUST also drop its own `package-root-containment`
REQ-PRC-06 mention (REQ-BRC-08 stays gated on its own citation alone).

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only.

This family is NOT retiring — REQ-BRC-06/07 depend on checks that survive the
containment removal (owner-corrected: the council synthesis's original attribution was
wrong to list this family among retirements; it re-anchors on new destination REQ-IDs
instead).

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3, security-blocking):
adds MODIFIED REQ-BRC-02 (a rationale-only rewrite — its body cited the now-retired
`package-root-containment` REQ-PRC-02; the substantive engine-independence promise is
unchanged) and retires the main family spec's "Seam Obligations Status" ENGINE-GATED
note for REQ-BRC-02, with dated evidence: owner ruling 1 (2026-07-28, this change)
affirms REQ-BRC-02's re-derivation is LIVE today, superseding the 2026-07-13
archive-time status ("committed-next scheduled," not yet shipped).

## MODIFIED Requirements

### REQ-BRC-02: Engine Re-Derives Containment Ceiling — SDK Value Never Wire-Authoritative

The SDK MUST NOT place any resolved anchor value on the wire as an authoritative
containment root the engine trusts. The engine independently re-derives its own ceiling
from its own invocation context and re-checks containment at apply time — the ONLY real
security control.

(Previously: cited the SDK's "own resolved containment ceiling (`package-root-containment`
REQ-PRC-02)" — that REQ is retired along with the whole family; the SDK no longer
resolves ANY ceiling value, so there is nothing ceiling-shaped left to place on the wire
in the first place. Rationale-only rewrite: the substantive promise — the engine is the
sole authority, never trusting an SDK-supplied root — is UNCHANGED. No scenario content
changes.)

#### Scenario REQ-BRC-02.1: No SDK-resolved root value appears on the wire as authoritative [SEAM] [preservation-pin]

- GIVEN a by-reference directive emitted by the SDK
- WHEN its wire shape is inspected
- THEN it carries no field presented as an authoritative containment root for the
  engine to trust as-is — this documents the seam contract; the engine's own
  re-derivation is exercised in the engine's suite, not here

### REQ-BRC-06: Missing Source Surfaces `source-not-found` — End-to-End Obligation

A by-reference directive whose package-local source does not exist MUST surface an
`AuthoringError` with reason `source-not-found` through the harness run
(`author-test-harness` REQ-ATH-15.2). The SDK-side guarded existence check
(`package-source-io-hygiene` REQ-PSH-02) is the legitimate origin of this rejection —
the fake is NOT required to re-check package disk; this REQ pins the author-visible
outcome, not the enforcement site.

(Previously: cited `package-root-containment` REQ-PRC-04/08 as the legitimate origin.
That family is retired; the origin re-anchors on `package-source-io-hygiene` REQ-PSH-02,
which carries the same existence-check obligation forward. The "out-of-ceiling paths
reject `source-outside-package` before any existence probe" clause is dropped — there is
no ceiling, and `source-outside-package` itself is retired, REQ-AEC-10.)

#### Scenario REQ-BRC-06.1: Missing package-local source surfaces source-not-found through the harness [preservation-pin]

- GIVEN a factory emitting a by-reference copy for a source path that does not exist in
  the package
- WHEN run via the harness
- THEN the run rejects with an `AuthoringError` whose reason is `source-not-found`
  (`authoring-error-contract` REQ-AEC-10)

### REQ-BRC-07: Emitted Source Path Is Package-Relative, Never Absolute

The by-reference directive's source path MUST be emitted PACKAGE-RELATIVE — never an
absolute filesystem path. An absolute path on the wire would leak the author's
filesystem layout to the engine AND invite the engine to trust an SDK-resolved location
(violating REQ-BRC-02's re-derivation posture). The enforcing mechanism is
`ir-path-well-formedness` REQ-IPF-01/03's lexical screen: an absolute source is rejected
before any directive is built, so a package-relative path is the only form that can ever
reach emission.

(Previously: this guarantee relied implicitly on `package-root-containment`'s
realpath-based source resolution flow, which resolved every source relative to the
package before any wire encoding. That family is retired; the guarantee is now enforced
directly by the ruling-5 lexical screen, `ir-path-well-formedness` REQ-IPF-01/03.)

#### Scenario REQ-BRC-07.1: No absolute filesystem path appears in the emitted directive [preservation-pin]

- GIVEN by-reference directives emitted via `copyIn` and via a by-reference `scaffold`
  entry
- WHEN each directive's full serialized form is scanned
- THEN no absolute filesystem path appears anywhere in it — the source field is
  package-relative

### REQ-BRC-08: Engine Path-Form and Render Hardening — Seam Contract

The engine MUST reject, fail-closed, source AND rendered-destination paths in
non-canonical filesystem forms: UNC (`\\host\share`), device namespace (`\\.\`, `\\?\`),
reserved DOS device names (`CON`, `NUL`, `COM1`, …), and drive-relative (`C:foo`) forms.
The engine's `pathTemplate` render MUST be SINGLE-PASS: substituted token values are
treated as LITERAL path segments — never re-scanned for tokens, traversal sequences, or
path-form reinterpretation after substitution. These are contract obligations on the
engine seam, not SDK-runnable tests.

(Previously: scenario REQ-BRC-08.2 cited "the post-render containment check, REQ-PRC-06"
— `package-root-containment` REQ-PRC-06 is retired with no successor REQ (see that
family's delta). REQ-BRC-08 IS the engine's own post-render/path-form hardening
obligation; it never needed an external citation for its own post-render check. Reworded
to be self-referential. No behavioural change — this is a citation fix only, plan-verify
finding F1.)

#### Scenario REQ-BRC-08.1: Non-canonical path forms rejected at apply time [SEAM] [ENGINE-GATED] [preservation-pin]

- GIVEN a by-reference directive whose source or rendered destination is a UNC,
  device-namespace, reserved-DOS-name, or drive-relative path
- WHEN the engine applies it
- THEN the engine MUST reject it fail-closed — documented seam contract, exercised
  in the engine's own suite

#### Scenario REQ-BRC-08.2: Substituted token values are literal — no second render pass [SEAM] [ENGINE-GATED] [preservation-pin]

- GIVEN a `pathTemplate` whose token value substitutes to a string containing `../`
  or `{= =}`-shaped text
- WHEN the engine renders it
- THEN the substituted value is treated as a literal segment (subject to the engine's
  own post-render containment check, REQ-BRC-08 itself — no longer cross-citing the
  retired `package-root-containment` REQ-PRC-06) and is NEVER re-scanned as template or
  traversal syntax — single-pass render, documented seam contract

## Seam Obligations Status — Retirement of the ENGINE-GATED Note for REQ-BRC-02 (owner ruling 1, 2026-07-28)

The main family spec's "Seam Obligations Status (as of archive, 2026-07-13)" section
lists REQ-BRC-02 (alongside REQ-BRC-08 and the now-retired `package-root-containment`
REQ-PRC-06) as ENGINE-GATED — registered in `openspec/pending-changes.md` §"From
`schematic-local-files`", tied to PC-PROTO-01, "committed-next scheduled" as of the
2026-07-13 archive (i.e., NOT yet shipped at that time). **This status is superseded for
REQ-BRC-02 specifically**, on a STRENGTHENED basis (dated correction, 2026-07-28,
ruling-6 umbrella — upgraded from "ruling 1 owner assertion" to first-hand verification):
**the owner verified FIRST-HAND (2026-07-28) that the engine's apply process implements
ceiling validation — it validates the resolved path and rejects with an error on
escape.** The ENGINE-GATED marker and `pending-changes.md` row 268 were STALE relative to
the shipped engine, not merely "scheduled." At archive, this section's REQ-BRC-02 row
MUST be updated to reflect LIVE status with this first-hand verification as evidence;
REQ-BRC-08 and the pending-changes.md rows for it remain ENGINE-GATED (this verification
speaks only to REQ-BRC-02's ceiling validation) — this is a narrow, evidenced correction,
not a blanket "everything shipped" claim.

**Extended at V3.2 (plan-verify-2 finding F1)**: the SAME main-spec paragraph's opening
sentence — "REQ-BRC-02, REQ-BRC-08, and `package-root-containment` REQ-PRC-06 are
ENGINE-GATED" — MUST also drop its `package-root-containment` REQ-PRC-06 mention at
archive-sync, for the same reason REQ-BRC-08.2's citation was reworded above: REQ-PRC-06
is retired with no successor, and REQ-BRC-08 was never DEPENDENT on that citation to
remain gated — it stays gated on its own terms. The rewritten sentence reads: "REQ-BRC-02
[now LIVE, see above] and REQ-BRC-08 are ENGINE-GATED."

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (containment, new disk-read surface) | REQ-BRC-02 (rationale rewrite), REQ-BRC-06, REQ-BRC-07, REQ-BRC-08 (citation fix) | Yes |
| public-api (wire contract) | REQ-BRC-01, REQ-BRC-03 (unchanged) | Yes |
