# Exploration: React (TSX/JSX) Dialect (react-dialect)

**Triage**: L
**Persona lens**: none

## Cross-Change Lessons Consulted

- `openspec/pending-changes.md` row (16)/(22)/(23) (stage-5b) + `ts-dialect-backend-ops/explore.md`
  (read in full): a shared collision/injection-hardening debt is repeatedly parked pending "the
  next op-pack widening." **Discrepancy found**: `react-dialect/triage.md` attributes an
  "empirically CONFIRMED" finding to `ts-dialect-backend-ops/explore.md` verbatim
  ("name-position args splice raw; from-position args are escaped") — that exact claim does
  **not** appear in that file (read in full, 220 lines; its own open questions are marked
  `type: technical`, forward-looking, not "confirmed"). I re-derived the underlying fact directly
  from `src/dialects/typescript/ops.ts` instead of trusting the citation — see Current State.
- `stage-5-first-dialect` lesson "hoist BOM/encoding round-trip to the core handle when the
  second dialect lands — N dialects must not re-discover it": directly actionable here (Risks).
- `pending-changes.md` "second dialect (own trigger)" row (FIT-09/FIT-14 exports-guard
  extensibility refactor, owner-deferred 2026-07-12): this change **is** that trigger — sized in
  Architecture Touchpoints, decision routed to Open Questions per the ledger's own
  fold-in-or-reaffirm rule.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author mutates a `.tsx`/JSX file via a dialect handle | none — empirically confirmed BLOCKED today (see Current State): `ts.find("Component.tsx")` has no extension gate and reaches the shipped `.ts` parser, which throws on real JSX content | Create |

## Current State

The shipped `.ts` dialect (`src/dialects/typescript/{ast,ops,index}.ts`) is the only structural
precedent. `find(path)` performs **no extension check** — it hands `path` straight to
`createDialectHandle` — so today an author calling `ts.find("Component.tsx")` reaches
`ast.ts#parse()`, which builds a virtual `dialect-source.ts` (note the literal `.ts` extension,
not `.tsx`) with no `compilerOptions.jsx` set. **Empirically verified** (spike, this session):
feeding real JSX source through the shipped `parse()` throws `"syntactically invalid TypeScript
source"` — the gap is a hard block, not a convenience gap; there is no author-side workaround
inside the SDK's dialect surface (`.modify(fn)` is unreachable too, since it needs a live AST that
`parse()` never produces).

`src/core/dialect-handle.ts`/`define-dialect.ts` need **zero changes** — `Ast`/`Ops` are already
generic type parameters (`Handle<State, Ast, Ops>`), `DialectAst<Ast>` only requires a
`parse`/`print` pair, and `withOps`'s `RESERVED_HANDLE_NAMES` collision check is dialect-agnostic.

**Identifier-injection finding (re-derived directly from `ops.ts`, not from the sibling doc)**:
`addFunction`/`addVariable`/`addClass` splice their `name` argument RAW into a template literal
(`` `${prefix}function ${name}${source}` ``) that becomes source text ts-morph re-parses —
an author-supplied `name` containing TS syntax injects an arbitrary declaration, not just a
badly-named one. `addImport`, by contrast, never string-splices — `name`/`from` go through
ts-morph's structured `addImportDeclaration({ moduleSpecifier, namedImports })`, which owns its
own quoting. This is the real, code-verified split behind the triage's claim (worded differently,
but the underlying mechanism checks out): **any new op that builds source via template-literal
splicing of an author-supplied identifier inherits this exact class**, structured-API-only ops do
not.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/react/{ast,ops,index}.ts` (new leaf) | new | mirrors `src/dialects/typescript/**` exactly; own `ast.ts` is the sole AST-library importer | aligns |
| `src/core/define-dialect.ts`, `dialect-handle.ts` | read-only | generic over `Ast`/`Ops` already; confirmed no change needed | aligns |
| `package.json#exports` (`./react`) | new | 6th subpath, mirrors `./typescript`'s shape | aligns |
| `test/fitness/fit-09-*.test.ts` (exact exports list) | modify | hardcoded `toEqual` list needs the new key (mechanical, ~2 lines) | aligns |
| `test/fitness/fit-14-*.test.ts` + `pkg-surface-baseline.json` | modify | baseline regen for the new subpath (mechanical, scripted) | aligns |
| `test/fitness/fit-02-*.test.ts` (no-sibling-dialect-import) | none | already scans ALL `src/dialects/*` dirs generically — fires automatically | aligns |
| `test/fitness/fit-01-*.test.ts` (commons-no-AST transitive walk) | none | generic bare-specifier walk from `src/commons/**`; a leaf-isolated new dialect never appears in that graph regardless of AST library chosen | aligns |
| `openspec/sensitive-areas.md` (`security (code execution)`, high) | modify | new `.raw()`/`.modify()`-equivalent instance in a new AST realm (triage's own override rationale) | aligns (expected sensitive touch) |
| `docs/authoring-a-dialect.md` | extend | second worked example; no structural change to the doc's own contract | aligns |

**FIT-09/FIT-14 sizing (carry-forward flag #3)**: doing the mechanical edit the same way stage-5b
did it (hand-edit the exact-list + regen the baseline JSON) is **XS**, ~15 minutes, proven
low-risk (identical shape twice already, S-002→S-003→stage-5b). The **deferred** extensibility
refactor itself (splitting the frozen list into a stable-core exact-assert + an extensible
dialect-set pattern-assert) is separately sized **S** in `pending-changes.md` row 229 and is
**not** required to ship `react-dialect` — but row 229's own trigger condition ("first real
consumer is a second dialect") fires with THIS change. Routed to Open Questions (product) rather
than decided here, per that row's explicit fold-in-or-reaffirm rule.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/dialects/react/ast.ts` | Created | parse/print pair, chosen AST library only |
| `src/dialects/react/ops.ts` | Created | exactly two v1 ops (candidates below) |
| `src/dialects/react/index.ts` | Created | `find()` entry + op-pack composition |
| `test/dialects/react/*.test.ts` | Created | unit + exact-set allow-list, mirrors `ops-exact-set.test.ts` |
| `test/conformance/react-conformance.test.ts` | Created | `testDialect`/`testOpPack` hookup, 6 mandatory samples + JSX-specific corpus (see Risks) |
| `package.json` | Modify | `./react` subpath + (if Babel-family chosen) new `dependencies` entry |
| `test/fitness/fit-09-*.test.ts`, `fit-14-*.test.ts` + baseline JSON | Modify | see Architecture Touchpoints |
| `docs/authoring-a-dialect.md` | Modify | second dialect worked example |
| `src/core/define-dialect.ts`, `dialect-handle.ts`, `dialect-error.ts` | Read-only | confirmed generic, zero change needed |
| `src/commons/**` | Read-only | FIT-01 confirms unreachable regardless of AST library |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution), high | `src/dialects/react/**`, `src/core/dialect-handle.ts` (new instance of the shared seam) | Yes — override already forced L; confirmed accurate |
| public-api (contract), medium | `package.json#exports` (`./react`) | Yes — corroborating, not itself an override |

No escalation — both were anticipated at triage.

## THE CENTRAL QUESTION: AST library — empirical spike results

Spike run in scratchpad (`bun add ts-morph@28.0.0 @babel/parser @babel/generator recast
magic-string`), 7 samples covering the JSX-specific cases the kit's 6 mandatory adversarial
samples do **not** exercise (empty, comment-only, BOM, CRLF, JSX fragments/self-closing,
JSX expression containers, comments-inside-JSX) — chosen because the CONFORMANCE KIT'S existing
6 mandatory samples (`src/conformance/index.ts:169-174`) contain **nothing JSX-specific**
(confirmed by direct read), so byte-exact fidelity on JSX syntax itself had zero prior proof.

| Candidate | Round-trip (7 samples) | Real-mutation body preserved? | 4 MiB perf | New dep? |
|---|---|---|---|---|
| **ts-morph, `.tsx` virtual path + `jsx` compilerOption** | **7/7 PASS**, zero code changes beyond extension + one compiler flag | YES — `addImportDeclaration` on a JSX-heavy file leaves everything from `export` onward byte-identical (verified) | parse+diagnostics+mutate+print ≈1.3s (same ballpark as the shipped `.ts` dialect's own 4 MiB sample) | No — same pinned `28.0.0` |
| `@babel/parser` + `@babel/generator` (default) | 1/7 PASS (empty only) — drops BOM, CRLF→LF, collapses blank lines, strips trailing newline, reformats destructured params, un-parenthesizes a JSX-returning arrow | N/A — disqualified before mutation matters | parse ≈0.4s (generator not timed, moot) | Yes — 3-4 packages |
| `@babel/generator` with `retainLines: true` | 1/7 PASS (empty only) — line-number retention is not formatting/whitespace preservation; does not fix any of the 6 failures above | N/A | — | Yes |
| **recast** (babel parser + reprint-preserving printer) | 5/7 PASS — **fails `crlf.tsx`** (recast normalizes CRLF→LF unconditionally, no preservation mode) and **fails `nested-expr.tsx`** (adds a spurious paren around a JSX-returning arrow body specifically when a leading comment sits inside the callback — a genuine printer crack, not theoretical) | Not reached — CRLF is one of the kit's own 6 **mandatory** samples; recast fails it outright | not measured (disqualified on a mandatory sample) | Yes — recast + its babel parser dep |
| **magic-string** (any parser for span-location only, splice never reprint) | 7/7 PASS **by construction** (no AST reprint ever happens for untouched text) | YES — proved with a real single-import-insertion splice on 4 samples incl. CRLF/BOM: before-span and after-span both byte-identical | trivial (no full-file reprint) | Yes, if paired with Babel for span-finding; No, if paired with ts-morph |

**Versions**: `ts-morph@28.0.0` (pinned, matches production), `@babel/parser@8.0.4`,
`@babel/generator@8.0.0`, `recast@0.23.12`, `magic-string@0.30.21` — all latest at spike time.
Full spike scripts + samples left in the scratchpad for re-run if needed.

### Recommendation (with required pushback)

**Approach 1 — ts-morph with `.tsx` ScriptKind, exactly mirroring the shipped `.ts` dialect.**

The owner's Babel lean does not survive the evidence: Babel's own generator — the tool's
*native* printer — fails byte-exact round-trip on 6 of 7 samples, including formatting classes
(BOM, CRLF, blank-line collapse) that are not edge cases but ordinary file contents. `retainLines`
does not remediate this (still 6/7 fail). Recast, the standard remediation for Babel's
non-preserving printer, does much better but **fails one of the conformance kit's own 6
MANDATORY samples (CRLF)** outright, plus shows a real JSX/comment-interaction printer crack —
not a hypothetical risk, a reproduced one. Since the conformance kit's `testDialect`/`testOpPack`
inject those 6 samples into **every** call with no fixture opt-out (`REQ-DC-06.2`,
compile-enforced), a printer that fails one of them cannot ship as this dialect's `ast.ts` at all.
ts-morph, by contrast, passes all 7 with a near-zero diff from the proven `.ts` dialect (only the
virtual-path extension and one `compilerOptions.jsx` flag change), preserves JSX bodies
byte-exact under a **real** mutation (not just idle round-trip), costs zero new dependencies, and
stays inside the already-documented "two-realms" hazard instead of opening a third.

**Where the owner's instinct has a real point, honestly weighed**: Approach 1 does **not**
independently prove the two-audience dialect contract against a genuinely different AST library
— the contract's design explicitly anticipated a second, different library as its strongest test.
That is a real, non-manufactured cost of this recommendation, not a strawman for Babel to lose
against. It is a design-goal cost, not a REQ-level blocker (byte-exact round-trip is an
unconditional acceptance gate per ADR-0012/its amendment; contract-genericity is not) — surfaced
below as a product question rather than silently absorbed.

Magic-string deserves a note: it is the single **strongest** fidelity guarantee found (provable by
construction, not just empirically observed) and would remain available later as an ADR-0037-style
"executor latitude" internal choice for a specific hard-to-splice op — but adopting it as the
dialect's *whole* printer strategy means hand-rolling every future op's insertion-point logic with
no `addXDeclaration`-style structured helpers, a real engineering-cost tradeoff against ts-morph's
built-in mutation API. Not recommended as the primary strategy for a v1 dialect that mirrors an
already-proven pattern; worth naming as a documented fallback if a specific future op turns out to
need surgical-only editing.

**oxc/swc**: not spiked — no mature, ts-morph-equivalent high-level *mutation* API for either
(both are transform/compile-oriented); adopting either would mean building the same from-scratch
position-finding + splice work magic-string already does, with a far younger ecosystem for this
exact use case. Excluded per the brief's own "only if genuinely viable for byte-exact mutation"
bar — no invented alternative to pad the table.

## Approaches (structural: leaf-rule vs reuse — carry-forward flag #1)

### 1. Duplicate: react leaf reimplements `addImport`-shaped ops independently
**Description**: `src/dialects/react/ops.ts` has its own complete op implementations, sharing
nothing with `src/dialects/typescript/ops.ts` beyond the pattern.
**Pros**: True leaf isolation, zero coupling risk, matches the dominant "each dialect is its own
world" framing.
**Cons**: `addImport`'s mechanism is 100% AST-shape-identical for `.ts` and `.tsx` (JSX does not
change import-declaration grammar) — duplicating it is pure copy-paste with no dialect-specific
reason.
**Effort**: Low. **Pattern fit**: matches `src/dialects/typescript/ops.ts` directly (as a sibling,
not a dependency).

### 2. Shared internal ops tier (e.g. `src/core/shared-ts-ops.ts`) both dialects compose
**Description**: Extract `addImport`/`removeImport` (genuinely AST-shape-identical across `.ts`
and `.tsx`) into a kit-internal module both dialects' op-packs include via `withOps`.
**Pros**: Removes real duplication for the two ops that are provably identical; centralizes the
identifier-injection hardening (Current State) in one place instead of two.
**Cons**: Premature generalization risk if react's parse/print pair ends up on a different AST
library than ts-morph (Ast type parameter would need to unify) — this is exactly the same
YAGNI concern `ts-dialect-backend-ops/explore.md` raised (Approach 2 there) against a shared
helper before Group 4 existed to inform its shape.
**Effort**: Medium. **Pattern fit**: new pattern, not present today.

### 3. Factory: a `defineImportOps<Ast>()` generator each dialect's `ast.ts` parameterizes
**Description**: A generic factory function producing `addImport`/`removeImport` given a
dialect's `parse`/`print`/AST-shape.
**Pros**: Reuse without an early concrete shared module; each dialect still owns its own file.
**Cons**: More abstraction than the codebase's own convention supports today (no existing
factory-of-ops pattern to match); adds a generic surface for exactly two ops.
**Effort**: Medium-High. **Pattern fit**: new pattern, no precedent.

### Recommendation

**Approach 1 (duplicate), conditionally.** Given the AST-library recommendation lands on
ts-morph — the SAME library the shipped dialect uses — the "genuinely AST-shape-identical" case
for import ops is real, but propose's own scope note says the two v1 ops are **not yet decided**
and may well be JSX-native (see next paragraph), in which case there is nothing to share at all.
Recommend duplicating for v1 (lowest risk, matches `ts-dialect-backend-ops`'s own converged
reasoning against premature sharing) and revisiting Approach 2 only if propose picks `addImport`
as one of the two v1 ops AND a third dialect is anticipated soon — two data points, not one,
before generalizing.

**Which two v1 ops (surfaced for propose, not decided here, per triage's explicit instruction)**:
candidates split into two shapes worth naming explicitly — (a) **reused TS-shaped ops**
(`addImport`/`removeImport`, byte-identical AST mechanism to the shipped dialect) prove
infrastructure but add **zero JSX-specific author capability** a `.ts`-dialect op doesn't already
give on non-JSX code; (b) **genuinely JSX-native ops** (e.g. `setJsxProp(elementName, propName,
value)` / `addJsxChild(elementName, source)`) prove the dialect's actual reason to exist (mutating
JSX structure, not just TS declarations that happen to live in a `.tsx` file). This split is
material to the PM why-now question below — propose should weigh it explicitly, not default to
(a) by inertia.

## Risks

- **Byte-exact fidelity risk is now RETIRED for the ts-morph route** (was UNRESOLVED at triage,
  resolved by spike above) — 7/7 pass including real mutation.
- **Identifier-injection class inherited from the shipped dialect** (Current State): any new op
  that string-splices an author-supplied `name`-shaped arg into template-literal source (the
  `addFunction`/`addVariable`/`addClass` pattern) reintroduces the same class day one; a
  structured-API-only op (the `addImport` pattern) does not. Design must pick per-op, not
  assume a blanket answer.
- **JSX adversarial corpus gap** (carry-forward flag #5): the kit's 6 mandatory samples are
  JSX-blind (confirmed, `src/conformance/index.ts:169-174`). This dialect's OWN sample set must
  additively cover, at minimum, what the spike already exercised: fragments (`<>...</>`),
  self-closing tags, spread props (`{...rest}`), expression containers with nested JSX
  (`.map(...)` returning JSX), and comments living inside JSX — recast's own failure above shows
  the comment/JSX-return interaction is a genuine printer fragility class, not a theoretical one.
- **FIT-09/FIT-14 fold-in-or-reaffirm** (Architecture Touchpoints): unresolved as of this
  exploration, routed to Open Questions.
- **Duplicate-vs-shared ops tension** (Approaches) is contingent on the "which two ops" decision
  — a chained dependency propose must resolve in one pass, not two.

## Open Questions

- type: product
  question: "PM why-now, now evidence-backed: nothing blocks on TSX today in the sense of a
  competing priority, but the gap itself is a HARD block (empirically confirmed: `ts.find()`
  against real JSX throws today, zero workaround inside the SDK's dialect surface — not a
  convenience gap). Does that change the why-now calculus against the still-open security debt
  (item 22, sensitive-areas `security (code execution)` already `high`) and the paused
  `ts-dialect-backend-ops` catalog?"
  why_it_matters: "Triage already classified this as override-forced L; propose still needs an
  explicit value argument for going first on capability-vs-hardening, not just a size/risk
  argument for HOW to build it."

- type: product
  question: "FIT-09/FIT-14 exports-guard extensibility refactor (`pending-changes.md` row 229,
  owner-deferred pending 'the second dialect'): this change IS that trigger. Fold the refactor
  into `react-dialect`'s scope now, or do the mechanical XS edit again and explicitly re-affirm
  the deferral (per the ledger's own no-orphan rule)?"
  why_it_matters: "Silently doing neither — editing the list without an explicit decision —
  violates the ledger's own fold-in-or-reaffirm contract a third time in a row."

- type: technical
  question: "Which two v1 ops: TS-shaped reuse (`addImport`/`removeImport`, zero new author
  capability over the `.ts` dialect) vs. genuinely JSX-native ops (e.g. `setJsxProp`/
  `addJsxChild`, which actually justify a new dialect's existence)?"
  why_it_matters: "Determines whether Approach 1 vs 2 (leaf-rule) even has a live tension — no
  ops in common means nothing to share; picking TS-shaped ops for v1 also weakens the why-now
  answer above (infrastructure without new capability)."

- type: technical
  question: "Should the identifier-injection hardening (Current State) be designed once, now,
  shared by construction across both dialects' template-literal-splicing ops — or ported/repeated
  per dialect, consistent with `ts-dialect-backend-ops`'s own converged 'no premature sharing'
  reasoning?"
  why_it_matters: "The vulnerability class is proven identical across both AST realms (both use
  ts-morph); designing it twice risks the two copies drifting out of sync silently."

## Ready for Proposal

**Status**: yes
**Reason**: The one triage-flagged unresolved risk (parser/printer dependency) is now resolved by
direct empirical evidence, not assumption — ts-morph with a `.tsx` virtual path passes byte-exact
round-trip on all 7 targeted samples plus a real mutation, at zero new dependency cost; Babel's
own generator and recast were tested and both fail (recast fails a MANDATORY conformance-kit
sample). No sensitive-area escalation beyond what triage already flagged; no architectural
deviation (`define-dialect.ts`/`dialect-handle.ts` confirmed generic, zero change). The remaining
opens (which two ops, FIT-09/FIT-14 fold-in, why-now framing) are exactly the class triage itself
deferred to propose/spec — inputs, not blockers.
**Recommended action**: Proceed to `sdd-propose`, carrying the AST-library recommendation
(ts-morph) and both product open questions for the orchestrator to surface to the user first.
