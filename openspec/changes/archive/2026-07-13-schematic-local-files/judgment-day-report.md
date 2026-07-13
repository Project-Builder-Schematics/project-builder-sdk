# Judgment-Day Report — schematic-local-files

**Verdict: APPROVED** (iteration 3 of 3; owner-authorized over the nominal 2-iteration budget)
**adversarial_review**: required (L + sensitive path-traversal/code-execution seam) → satisfied.

Blind dual-judge protocol: each iteration ran two independent judges receiving ONLY the signed
spec + acceptance criteria + the code diff — never the orchestrator transcript, prior findings, or
builder narration. Judges built their own fixtures and ran mutation probes against the real code.

## Iteration ledger

| Iter | Judge 1 | Judge 2 | Outcome |
|------|---------|---------|---------|
| 1 | A: APPROVED | B: **BLOCK** | Real defect → fixed |
| 2 | C: APPROVED | D: **BLOCK** | Two real defects → fixed |
| 3 | E: APPROVED | F: APPROVED | **APPROVED — ship** |

## Defects found and fixed (both missed by the council AND both verify-final passes)

1. **Iter 1 (Judge B) — classifier budget under-measurement.** `classifyTransport` measured the
   REQ-CCL-02 budget against `JSON.stringify(content)` (content string only), not the prospective
   `create` directive (envelope + wrapper + `pathTemplate` + `options`). A file whose content fit
   under cap but whose emitted directive exceeded it classified by-value → the run failed
   `changes-too-large` instead of routing by-reference → **success became failure at the boundary**.
   Fixed (`d759961`): measure `serializedBatchSize([prospectiveDirective])`. Verified by worktree
   pre/post regression proof.

2. **Iter 2 (Judge D) — BOM stripping.** A `/simplify` D9 regression: the content decode moved from
   `buf.toString("utf-8")` (BOM-preserving) to `TextDecoder("utf-8", {fatal:true})` (BOM-stripping,
   `ignoreBOM` defaults false). A BOM-prefixed file's `create.template` lost its BOM → violated
   REQ-FEH-01.1 "exact content". Fixed (`09b9179`): `ignoreBOM: true` (single-pass, still fatal).

3. **Iter 2 (Judge D) — raw Node error escaping the AuthoringError contract.** `walkFolder`'s root
   `readdirSync` was unwrapped: `scaffold({from})` pointing at a regular file (`ENOTDIR`) or a
   missing folder (`ENOENT`) threw a raw `Error` leaking an absolute path. Fixed (`059c4d3`): wrap in
   `AuthoringError` (`invalid-input`) with a package-relative message. Required an owner-ratified
   REQ-PRC-10.3 amendment (V4→V5) + a new REQ-PRC-10.3b, since the old spec text pinned the buggy
   missing-folder behavior as intentional.

## Why this matters (process note)

Every one of these three defects survived the full 4-persona blind council AND two independent
final-verify passes — because in each case the code was internally consistent with its own tests
(they shared the same wrong mental model). They died only under a FRESH, independent, blind
adversarial pass that never saw the prior reasoning, re-run after each fix. The value was in the
composition, not any single reviewer.

## Non-blocking observation (Judge F, iter 3) — archive followup

A `rename` value whose `..` segments are fully absorbed by a multi-segment `to` lands the file at
the workspace root rather than under `to`. This is **within contract** (REQ-FSC-02 permits remap,
REQ-PRC-09's workspace boundary holds, the engine post-render check is the real control) — NOT a
defect. Only the internal Executor-Context §5 note ("a rename smuggling `../` … is caught") is
imprecise; worth a one-line correction at archive.

## Standing caveat carried to steward reckoning

The engine-side copy-apply pass (PC-PROTO-01) is UNBUILT. The SDK proves EMISSION only (REQ-BRC-04
evidence-boundary). Green fake/conformance tests do NOT prove the engine copies files. Steward
reckoning must judge the SDK half on its own contract and must not read green as end-to-end delivery.
