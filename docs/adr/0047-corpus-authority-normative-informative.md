# ADR-0047: Corpus Authority — Normative Core, Informative Shell

- Status: Accepted (2026-07-14, promoted at author-emulation-e2e-scaffold archive)
- Date: 2026-07-13
- Deciders: Daniel (Hyperxq)
- Origin: change `author-emulation-e2e-scaffold` (design §4.5).
- Builds on: REQ-GCC-01/02/06 (golden-corpus-contract spec), owner ruling D1
  (corpus is simultaneously regression baseline and v0 engine-handoff contract).

## Context

The committed corpus is both a regression baseline and a v0 engine-handoff contract
(owner D1); its real consumer (the engine) does not exist until `PC-PROTO-01`.
Over-pinning (rendered output, batch/chunk boundaries, timestamps as binding) would
make incidental changes false-fail and mislead the future engine about what actually
binds.

## Decision

Split corpus content into a NORMATIVE core and an INFORMATIVE shell. NORMATIVE
(`normative` subtree) = terminal outcome + ordered lowered-wire directive sequence
(`create`: op/pathTemplate/template/options/force; `copyIn`: op/from/to/force; walk
order per GCC-07) + the rejection attribution triple. INFORMATIVE (`informative`
subtree) = batch/chunk grouping. `formatVersion` is independent of the wire
`protocolVersion` (GCC-02). Rendered `{{}}`/`{= =}` output and by-reference bytes are
NEVER in the corpus (ITC-03). Records self-label their regions.

## Consequences

- (+) Chunk-boundary drift never reads as directive drift; an honest "shape only"
  handoff.
- (−) Walk order is NORMATIVE though upstream does not pin it (`walk.ts` sorts) —
  documented risk; upstream re-pinning would require a format revisit via ADR.
- (+) The v0/PROVISIONAL posture avoids premature polish on a contract with no real
  consumer yet.

## Alternatives Considered

- **Whole-file binding (grouping included)** — REJECTED: a legal re-chunk would
  false-fail; over-pinning.
- **Whole-file informative (nothing binds)** — REJECTED: no regression value;
  under-pinning.
- **Capture rendered output** — REJECTED: impossible (the fake never renders) and
  breaks the evidence boundary (BRC-04).
