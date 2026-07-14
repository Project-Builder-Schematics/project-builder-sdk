# North Star — author-write-surface (foresight checkpoint)

**Checkpoint**: foresight (post-design) · **Verdict**: `aligned` · **Triage**: L
**Binding contract**: the re-cut problem — the *dishonest-write-API* clause ONLY
(dialect-kit-locked clause DEFERRED with its piece).

## 1. This is what we're going to do (intent, in outcome terms)

Make the author-facing write vocabulary tell the truth. Today two names lie:
`.modify(content)` says "modify" but wholesale-replaces the file, and `.raw(fn)` is a
placeholder name that exists only because the honest name (`modify`) was already taken by
the liar. After this change a schematic author reaches for wholesale replacement and finds
`.replaceContent(content)` — which does exactly what it says — and reaches for in-place AST
editing and finds `.modify(fn)` — the honest name, now freed. Two distinct methods, never
overloaded, string-only vs fn-only. The clean break lands in the last pre-1.0 window with no
deprecation machinery.

## 2. How it fits (architecture)

Author-surface-only, crossing no engine boundary. The wire IR stays byte-identical
(`{op:"modify"}`). The one FROZEN type (`Handle`) is deliberately unfrozen and re-frozen by a
new 10th FIT-04 `.d.ts` baseline. Impact = `modifying`: two `deviates` touchpoints (the
frozen `Handle` members; the published `conformance` chain-step contract), both ADR-gated.

## 3. The outcome we're chasing (traced to the problem)

| Pain clause (re-cut problem) | Deliverable that removes it | Traced |
|---|---|---|
| `.modify(content)` lies — says modify, does wholesale replace | Rename → `.replaceContent(content)` on all dialect handles AND the commons top-level verb; string-only pin | ✓ fully |
| `.raw(fn)` exists only because `modify` was taken | Free `modify`, reassign it to the AST escape hatch as `.modify(fn)`; `.raw` removed at type + runtime | ✓ fully |
| (honesty must not silently regress) | `.raw` kept RESERVED as a guardrail; conformance chain-step `{raw}`→`{modify}` in lockstep; repo-wide `.raw`/`modify(` sweeps; docs/SECURITY.md migrated with guard tests | ✓ reinforces |

**Every re-cut-problem clause has a deliverable. No clause is left unserved.**

## 4. The filed question (held for reckoning)

Does this design, executed perfectly, RESOLVE the dishonesty — or merely produce correct
outputs? **It resolves it** for the *call surface*: both verbs are now honestly named, distinct,
non-overloaded. Two residues/observations are held for the human (below) — neither blocks,
both are owner-ratified — and one shorter-path option is named.

## Output-without-outcome scan

- **Importable `modify(handle, fn)` (REQ-TSD-12) + its cross-run guard subsystem** is the ONE
  deliverable that does NOT trace to the "stop lying" problem. It is a NET-NEW calling
  convention (`.raw` never had one), and it alone drags in a net-new controller mechanism
  (`#origin`/`#bindOrigin` run-identity stamp, a new `AuthoringError{outside-run}` path,
  REQ-TSD-12.5/.6, plus cross-run doc burden in REQ-DAS-01.4). It is *authorized* (triage
  in_scope names it; shape ratified #2109/#2114) but it serves ergonomics, not honesty. This
  is the single largest source of NEW complexity in an otherwise-mechanical rename, and the
  clean shorter-path-to-the-same-honesty-outcome would DEFER it with the other deferred scope.
  → surfaced as conscience question Q1 (not a halt: owner-scoped, does not harm the outcome).

## Promise ↔ delivery drift

- Proposal promises "the API stops lying." Delivered fully at the **call** surface. One
  **disclosed residue** survives at the **error/dry-run** surface: a failed `.replaceContent()`
  reports `verb: "modify"` (REQ-AEC-13), because the label names the WIRE op (out of scope),
  not the author call. This is owner-ratified (#2117) and documented in THREE author-facing
  places + a rationale breadcrumb. It is a *disclosed, reasoned* wire-altitude label, not a
  silent lie — but a first-contact author debugging a failed `.replaceContent()` who has no
  `.modify` in their code will still meet the old word. → conscience question Q2.

## Verdict

`aligned` — the designed work, built as specified, ELIMINATES both stated lies for the
schematic author. Proceed to slice. Two conscience questions escalated for the human; both
are owner-ratified tradeoffs the human should consciously re-affirm, neither blocks the gate.
