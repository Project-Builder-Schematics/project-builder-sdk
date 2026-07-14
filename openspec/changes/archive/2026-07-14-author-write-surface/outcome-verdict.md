# Steward Outcome Verdict — author-write-surface (reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking)
**Change**: `author-write-surface` · **Triage**: L
**Verdict**: `aligned-pending-human` — AI analysis finds full alignment (no outcome-gap); the escalated usable?/significant? questions must be engaged before archive.
**Date**: 2026-07-14

---

## Our objective was THIS (the re-cut contract)

> Schematic authors face a dishonest write API: `.modify(content)` promises "modify" but
> wholesale-replaces the file's text; `.raw(fn)` exists only because the `modify` name was taken.

The re-cut (2026-07-14 owner decision) narrowed the contract to the **dishonest-write-API clause
only** — the dialect-kit-exposure clause was deferred with its piece. The North Star (foresight
memo obs #2127) restated the outcome as: *remove both lies* — `.modify(content)` → `.replaceContent(content)`
(honest wholesale-replace name) and `.raw(fn)` → `.modify(fn)` (honest AST-edit name, freed by the
rename); distinct methods, string-only vs fn-only; `.raw` removed at type+runtime but kept reserved
as a guardrail.

## Did we deliver it? Show me WHERE (result → problem map)

| Stated lie (the pain) | Shipped fix (traced to code) | Resolves? |
|---|---|---|
| `.modify(content)` says "modify" but wholesale-replaces | `replaceContent(content)` on the Handle (`src/core/define-dialect.ts:51`), the `WriteOps` interface (`src/core/base-handle.ts`), and the commons top-level verb (`src/commons/index.ts:297`, `:71`, `:102`). Old `modify(content)` no longer exists on any handle. | ✅ the name now states what it does |
| `.raw(fn)` exists only because the `modify` name was taken | `.raw(fn)` retired, absorbed into `.modify(fn)` as the AST-edit escape hatch (`define-dialect.ts:65`). `raw` removed at type + runtime (`'raw' in handle === false`, REQ-DG-03.4) but kept in `RESERVED_HANDLE_NAMES` (`:135`) as a guardrail; its collision message points authors at `.modify(fn)` (`:179`). | ✅ the escape hatch now carries the honest verb, name freed by the rename |

Every clause of the re-cut problem statement traces to a shipped, runtime-tested deliverable
(verify-report: 23/23 active REQs covered, all 41 tasks ticked, suite green twice, typecheck clean).
No clause is left unserved.

## Journey simulation — a dialect author with the renamed verbs

1. **Wholesale replace.** Author wants to overwrite a file's whole text. Old surface handed them
   `handle.modify("…")` — a verb that lies. New surface: `handle.replaceContent("…")`. The call name
   now matches the effect. Honest at first contact.
2. **AST edit.** Author wants to mutate the parsed AST. Old surface: `handle.raw(ast => …)` — a name
   that means nothing (a leftover because "modify" was taken). New surface: `handle.modify(ast => …)`
   — the intent-carrying verb. Coalesces with named ops into one `modify` directive, unchanged.
3. **Trying the retired verb.** If the author reaches for `.raw()`, it is gone at type + runtime; but
   `raw` stays reserved so an op-pack cannot shadow it, and the collision hint routes them to
   `.modify(fn)`. Guardrail + discoverability preserved.
4. **No downstream breakage.** Their generated batches still emit `{op:"modify", modify:{path,content}}`
   byte-identical (wire IR frozen, byte-verified). Engine/CLI untouched. A pre-1.0 clean break with
   zero deprecation aliases — no external consumer to strand.

**One residual friction (the honesty residue).** A *failed* `.replaceContent()` (or `.modify(fn)`)
surfaces `verb: "modify"` in the error / dry-run output, because that label names the wire op, not
the author call (REQ-AEC-13). Owner-ratified twice (#2117, re-affirmed #2128), disclosed in three
author-facing docs + a breadcrumb — a wire-altitude label, not a silent lie. But a first-contact
author debugging a failed `replaceContent` still meets the old word "modify" at the error surface.
This is the one place the honesty win is not total. Surfaced below for the human's call.

## Outputs-without-outcome detection

**Clean.** The single deliverable flagged at foresight as output-without-outcome — importable
`modify(handle, fn)` (REQ-TSD-12), which served ergonomics not honesty and alone dragged in a whole
run-identity guard subsystem — was **deferred by owner decision (#2128) and tombstoned**. Verify-report
confirms no orphan code: it was never built. The change is now *purely* the honesty rename; every
shipped piece serves the stated pain. The foresight gate paid for itself ("authorized ≠ serves the
problem").

## Promise ↔ delivery drift

- **North Star promise → delivery**: both lies removed, distinct methods, string-only vs fn-only,
  `.raw` removed at type+runtime but kept reserved — delivered exactly, verified in source and by the
  final-verify frozen-contract table.
- **Signed-scope completeness**: nothing promised in the signed re-cut (V4) scope silently failed to
  ship. Deferred pieces (dialect-kit subpath, importable `modify`, query helpers) are registered
  `out_of_scope` in triage + pending-changes, not dropped. REQ-TSD-12 tombstoned by owner, correctly
  absent, no orphan code. No `problem-drift`.
- **No inflation**: 60 files, all inside the declared blast radius; zero files outside scope.

## Is it usable / significant? (escalated — human-only)

I do not fake a verdict on meaning. The AI-assertable analysis is fully aligned; what remains is the
human's judgment on lived value. See conscience questions.

## Conscience questions (the gate does not pass until these are engaged)

1. **Usable — vocabulary in practice.** The names are honest *by construction*. Does that honesty
   actually reduce author confusion in real schematic-authoring, i.e. are `replaceContent` /
   `modify(fn)` the verbs an author reaches for naturally? (No external consumers pre-1.0, so this is
   a judgment on the intended author experience, not field data.)
2. **Usable — the `verb:"modify"` residue.** Now that it is shipped and observable: is the disclosed
   wire-altitude `verb:"modify"` on a *failed* `.replaceContent()` acceptable in practice, or does a
   first-contact author debugging a failed replace still get tripped by meeting "modify"? Owner
   ratified it twice; this asks whether that ratification holds up against the shipped surface.
3. **Significant — does it matter?** This is a pre-1.0 clean-break rename with no external consumers.
   Is eliminating these two naming lies significant enough to count as delivered value?
   *My suspicion (labelled as such, not a verdict): it IS significant — it is the last cheap window,
   and honesty in a public authoring API compounds — but significance is the human's call.*

## Risk to flag to the orchestrator (outside the steward's purview)

The final verify-report is `pass-with-followups` and states **adversarial review (judgment-day) is
REQUIRED before archive** (L-triage + security/public-api sensitivity). This reckoning verdict is
about purpose/outcome and does **not** substitute for that judgment-day pass. Archive should not
proceed on this verdict alone: the human questions above must be engaged AND judgment-day must clear.
The two verify-report followups (FIT-04 non-vacuousness content assertion; stale comment at
`dialect-handle.ts:194`) are non-gating.
