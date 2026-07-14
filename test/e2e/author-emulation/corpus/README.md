# Author-Emulation Corpus

## What This Corpus Is

Each file in this directory is the committed transcript of one factory run, captured at
the `EngineClient` seam via `test/support/ir-transcript.ts`. Every file is SIMULTANEOUSLY
the byte-exact regression baseline for its scenario AND the v0/**PROVISIONAL**
engine-handoff contract (owner ruling D1) — there is no separate "golden" file and
"corpus" file; drift between the two is impossible by construction (REQ-GCC-01). The
handoff stays provisional until a real consuming engine exists (`PC-PROTO-01`).

This is the third golden idiom in this SDK's test suite, alongside `test/golden-ir/`
(in-source `Directive` literals) and `test/dialects/typescript/golden/` (byte-print
files) — a genuinely different unit: the whole-run lowered-directive sequence, not a
single directive or a single rendered file (ADR-0048).

### `scaffold` Has No Wire Op — Its Lowering Into `create`/`copyIn` Is the Corpus Truth

`scaffold` is an author-facing verb only — there is no `scaffold` entry in the wire
`Directive` union (`src/core/wire.ts`). When a schematic calls `scaffold(...)`, the SDK
WALKS the source tree and LOWERS each entry into one of the two wire directives this
corpus knows: `create` (a file to be rendered, by-value or via `templateFile`) or
`copyIn` (a file classified by-reference — binary or oversized, copied without a content
read). A corpus record for a `scaffold` scenario therefore never contains a `scaffold`
directive — it contains the ordered sequence of `create`/`copyIn` directives that
lowering produced. Reading a raw corpus file is reading the ANSWER to "what did this
scaffold call actually do at the wire?", not a re-statement of the author's call.

## Normative Status

Each record self-labels its two regions via top-level keys, so a raw reader of the file
(without this README) can tell what binds:

- **`normative`** — BINDS. The terminal `outcome` (`"committed"` | `"rejected"`), the
  ordered sequence of lowered wire directives (walk order, REQ-GCC-07), and — for
  rejected scenarios — the `AuthoringError` attribution triple (`reason`/`verb`/`path`,
  no free-text message). A change here is a real behavioural regression.
- **`informative`** — captured, but not necessarily diff-failing. Currently just
  `batchGrouping`: how many `session.flush()` calls occurred and how directives were
  distributed across them. A legal re-chunk (same directives, different flush cadence)
  changes this region without changing the normative one (REQ-GCC-03).

`formatVersion` (this corpus's own format number, currently `0`) and `protocolVersion`
(the wire envelope's own version, from `src/core/wire.ts`) are **independent fields with
independent values** (REQ-GCC-02) — a wire protocol bump never forces a corpus format
bump, and vice versa; no code path derives one from the other, and no reader may reject
a corpus file by comparing the two.

## How It Is Regenerated

Corpus files are regenerated ONLY by running `scripts/regen-corpus.ts` — a maintainer
script that lives OUTSIDE the test-imported graph and is never imported by any test file
or runnable via the CI test command. Tests only READ and COMPARE; no test or test helper
ever writes to this directory (REQ-GCC-05, mechanically enforced by `fit-27-*`).
Regenerating is a deliberate, reviewed, out-of-band action — never an automatic
"make the test pass" step.

## The NOT-EXERCISED Ledger

`coverage-manifest.md` (next to this file) lists REQ-IDs and behaviours this corpus
deliberately does NOT exercise — honest gaps, not oversights. Some are structural (e.g.
`template rendering` — this SDK's test fakes never render `{{}}`/`{= =}` output, so no
assertion here ever inspects rendered bytes); some are engine-gated (they wait on a real
consuming engine, `PC-PROTO-01`).

## Reference

Spec: `openspec/changes/author-emulation-e2e-scaffold/specs/golden-corpus-contract/spec.md`
(REQ-GCC-01..12) and `specs/ir-transcript-capture/spec.md` (REQ-ITC-01..05). Design:
`openspec/changes/author-emulation-e2e-scaffold/design.md` (§4.3 data model, ADR-0047,
ADR-0048, ADR-0049).

**Family-prefix reservation**: this change owns the `m-*` matrix-id prefix (plus the
non-matrix `s-00` skeleton). A future mutation-family e2e change (e.g. a modify-family
change) MUST reserve its own prefix (e.g. `mod-*`) rather than reusing `m-*`, so two
families' scenario ids can never collide in this shared corpus directory.
