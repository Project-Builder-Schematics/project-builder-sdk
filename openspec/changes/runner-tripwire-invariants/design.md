# Design: Runner Tripwire Invariants

**Change**: `runner-tripwire-invariants` · **Triage**: L · **Spec**: runner-integrity-manifest V3 (SIGNED) + publish-pipeline-hardening V4 (SIGNED) · **Persona lens**: architect synthesis

## 1. Architecture Overview

Constraint 4's guard is inverted: `denyScan` (iterate identifiers, `continue` the unrecognised — default **pass**, committed set = the *forbidden* one) is replaced by a **capability-admission property** (enumerate a closed surface, classify every node, default **violation** — committed set = the *permitted* one). The mechanism is the house pattern `classifySpecifier` already uses two functions away in the same file; this is a boring redesign applied to the one guard that never got it.

The property is realised as **two independently-implemented functions** that must agree, which is what makes totality non-tautological:

- `enumerateCapabilitySurface(sourceFile) → SurfaceNode[]` — *what is present*
- `classifySurfaceNode(node, ctx) → Disposition` — *what is admitted*

The walk is structurally `enumerate(...).map(classify)`, so there is no third path; `FIT-CAP-TOTALITY` asserts `classified.length === enumerated.length` against an **independent raw count** of surface-kind nodes. A classifier that silently skips diverges the counts; "fixing" it by teaching the enumerator to skip too is a second edit in a second function, visible in review — and the totality red-proof mutates only the classifier.

Three legs, all decidable from **syntax alone** (no ts-morph type checker, no module resolution inside a fail-closed build gate — the verdict must never be a function of install state): callee decidability, origin admission, positional decidability. The admitted set lives in two closed tables in the guard's own source, not a generated artefact (ruling 8).

**Probe-verified against the real closure** (23 files, 423 call/`new` sites, HEAD `e6dcde2`) — this is the architect's HIGH risk retired with evidence, not hope:

| Probe | Result | Consequence |
|---|---|---|
| Genuinely free identifiers (full scope-chain walk) | **22 distinct** | `ADMITTED_GLOBALS` is small and reviewable — the mechanism's central affordability claim holds |
| Static member paths off free roots | **28 distinct**, none denied | Member-path table is reviewable; `process.binding` absent ⇒ the denied-path check is clean but non-vacuous |
| `node:` imports | **6** (`async_hooks, console, fs, module, path, url`) | Matches REQ-RCD-04.1's six-member baseline row exactly |
| Undecidable callees | **0 / 423** | REQ-CAP-03 false-positive-free on day one |
| Computed member accesses | 37, incl. `globalThis[registryKey]` | Drives D-1 below |
| Module-scope reassignments | **3** | Drives D-2 below |

### Three design findings that the spec's own text resolves

**D-1 — computed access is judged by POSITION, not by base.** `core/context.js:71` contains `globalThis[registryKey]` — structurally the same shape as confirmed live escape M2.1, `globalThis["ev"+"al"]("1+1")`. A rule "computed access on a capability root ⇒ violation" would flag the real closure, and byte-neutrality (REQ-CAP-06) forbids changing `src/`. The discriminator the spec already dictates: REQ-CAP-03 denies a call whose **callee** is not a statically resolvable binding. `globalThis[registryKey]` is *read into a value*, never a callee → admitted. `globalThis["ev"+"al"](…)` *is* the callee → violation, reported under the callee-decidability rule, "never a claim that the specific primitive `eval` was identified by name" (REQ-CAP-03.1, verbatim). One rule, both outcomes, zero false positives.

**D-2 — the no-reassignment precondition is scoped to origin soundness, and the real closure passes it.** The closure carries three module-scope reassignments (`realFd1Write` in `transport/framing.js:69`, `runInFlight` twice in `transport/runner.js`). REQ-CAP-02's *normative* THEN is "reports zero **violations**", and it holds: the precondition splits into two decidable rules — (a) reassignment of an **import** binding is always a violation (ESM bindings are immutable; this is REQ-CAP-02.1's fixture exactly, which imports `createRequire` then reassigns it), and (b) reassignment of a module-scope `let`/`var` requires **every assigned RHS to classify as admitted independently**. `realFd1Write = process.stdout.write.bind(process.stdout)` is a decidable member chain rooted at an admitted global; `runInFlight = true|false` carries no capability surface. Zero violations, precondition sound. REQ-CAP-02.2's scenario *title* ("zero reassignments") is prose inaccurate against the tree while its THEN clause is satisfied — no unfreeze needed; its test asserts **both** zero violations *and* exactly-3 reassignments each with an admitted RHS, so a fourth with a bad RHS cannot slip in under a vacuous sibling.

**D-3 — origin admission is per-POSITION: a binding may be admitted as a value and denied as a callee.** This single generalisation closes three otherwise-separate holes with one rule. A local binding whose declaration initializer is (i) a computed member access, (ii) a denied register member, or (iii) any non-decidable expression carries a **tainted origin**: admitted in value position, violation in callee position. One-hop, purely syntactic, no dataflow. It kills `const f = globalThis[k]; f()` (i), `const F = Function; F("return 1")` — REQ-CAP-05.2's R1-17 sequencing hazard (ii), and keeps `const slot = globalThis[registryKey]` green because `slot` never reaches a callee.

### R1-16 probe result (deferred-to-design item, settled)

Probed in both directions, seven fixtures. **Both prior statements are partly wrong, and the redesign does NOT dissolve the issue — under default-deny it gets worse.**

| Construct | Identifier reached by `getDescendantsOfKind`? |
|---|---|
| `/** @example eval("1+1") */` | **No** — JSDoc free text is `JSDocText`, never parsed as expressions |
| `/** @example import x from "./t.js" */` | **No** — and `staticSpecifierSites` reads only real `ImportDeclaration`s |
| `/** {@link createRequire} */` | **Yes** — `Identifier`, parent kind `JSDocLink` |
| `/** @param {Function} fn */`, `/** @type {Function} */` | **Yes** — `Identifier`, parent kind `TypeReference` |
| `// eval("1+1")` (line comment) | No |

Verdict: `derive-runner-closure.ts:176-178`'s comment ("JSDoc occurrences are structurally absent from the descendant walk") is **true in its original ADR-01 scope** (`@example` prose quoting a *specifier*) and **false as generalised to `denyScan`** — structured JSDoc *does* yield denied identifiers. The register's R1-16 row is **true as a mechanism claim but latent, not live**: no closure file today carries `{@link X}` or `{Type}` naming a denied primitive (the anchor's `createRequire` mentions are line comments and backtick prose, both structurally invisible). Design consequence: **JSDoc-rooted nodes are excluded from the capability surface by an explicit, named, red-proven surface rule** (E1 below), never by assumed absence — and the misleading comment is corrected in the same slice.

### Surface exclusions are claims, not pass paths

The distinction the whole property rests on: an **exclusion from the surface** asserts "this node cannot yield a capability at runtime" — falsifiable, and each carries a red-proof. A **pass path** asserts "I did not recognise this, so it is fine" — which is exactly what default-deny forbids. Totality is asserted over the surface *after* exclusions, and each exclusion is pinned by a red-proof that a mutant widening it is caught.

| # | Exclusion | Justification | Red-proof |
|---|---|---|---|
| E1 | JSDoc-rooted nodes | JSDoc is a comment; erased at runtime | Mutant widening E1 to non-JSDoc nodes is caught (REQ-CAP-01.2) |
| E2 | Declaration *name* nodes | A binding site is not a reference | `const eval = …` still denied via E2's own rule |
| E3 | Non-computed property *name* nodes | Re-attributed, not dropped: the enclosing `PropertyAccessExpression` is itself the surface node (this is how `process.binding` is caught) | `process.binding` fires as a member path |
| E4 | Type-position identifiers | Erased by emit | — |

## 1b. Pattern Check

**Pattern**: existing — matches `scripts/derive-runner-closure.ts:288` (`classifySpecifier`'s total-by-construction discriminated classification) and the graph-baseline ratchet. The change generalises an in-repo precedent to a second guard; no new named pattern is adopted.

## 2. File Changes

| Path | Action | Purpose |
|---|---|---|
| `scripts/capability-admission.ts` | Create | Surface enumerator + total classifier + the two admitted tables + one-hop scope/origin resolution (REQ-CAP-01..05, PRM-01, XPO-01, DGN-01) |
| `scripts/bundler-disjointness.ts` | Create | Resolution-based path verdicts, all candidate flag readings incl. `-o` short form, undecidable ⇒ violation (REQ-PTH-01) |
| `scripts/derive-runner-closure.ts` | Modify | `denyScan` deleted; calls `capability-admission`; `node:` validated against `builtinModules` (R1-15); directory-specifier rule (R1-8); `node:vm` case folded into the register; `VIOLATION_RULES` + `RULE_BODIES` gain the new rules; the false JSDoc comment corrected |
| `scripts/generate-runner-manifest.ts` | Modify | One fail-closed boundary routing every throw; write-temp-then-rename as the only write path; version failure gets its own rule (REQ-FCG-01, DGN-01.1) |
| `test/support/closure-integrity-checks.ts` | Modify | Disjointness predicates removed; re-exported from `scripts/bundler-disjointness.ts` — placement, not timing (ADR-0081) |
| `test/fitness/fit-42-runner-closure-integrity.test.ts` | Modify | FIT-CAP-TOTALITY, FIT-PATH-SPELLING-INVARIANCE, FIT-MANIFEST-BYTE-NEUTRAL; AST-counted non-vacuity; CAP-02.2 / PTH-01.6 sibling positives |
| `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` | Modify | New red-proofs per REQ; FIT-FAILCLOSED-BICONDITIONAL; all 18 S-000 red-proofs survive behaviourally; 47 `toContain` message assertions converted to whole-verbatim; 2 threshold counts tightened to exact |
| `test/fitness/fit-23-publish-workflow-guard.test.ts` | Modify | `publishRunSteps` reads execution order, not YAML declaration order (REQ-PPI-05); rebuild-step + suite-gate assertions (REQ-PPI-02, PPI-03) |
| `test/fitness/fit-46-publish-sequence-integrity.test.ts` | Create | Behavioural packed-digest-vs-packed-bytes proof over a real stamp→rebuild→pack sequence (REQ-PPI-01) |
| `test/fixtures/red/runner-tripwires/**` | Create | Directory-enumerated corpora: `deny-scan/`, `green/`, `bundler-scripts/`, `fail-closed/`, `mutants/` — ≤20 committed mutants |
| `.github/workflows/publish.yml` | Modify | Explicit rebuild step between stamp and publish; full-suite gate before publish, no `continue-on-error` |
| `test/conformance/react-conformance.test.ts` | Modify | Explicit per-file timeout (REQ-PPI-04) — the file declares none today, and the repo has no `bunfig.toml` and no `--timeout` flag, so the value must be stated in-file against Bun's built-in default |
| `test/docs/runner-integrity-docs.test.ts` | Modify | Counts compared against live `deriveRunnerClosure` output, frozen literals removed (REQ-DLV-01) |
| `docs/runner-integrity-invariants.md` | Modify | Counts derived; Constraint-4 section describes admission, not deny-scan |
| `openspec/decisions/0079-capability-admission-replaces-deny-scan.md` | Create | ADR-0079 |
| `openspec/decisions/0080-tripwire-classifiers-total-fail-closed-default.md` | Create | ADR-0080 |
| `openspec/decisions/0081-resolution-based-path-verdicts-predicate-placement.md` | Create | ADR-0081 |
| `openspec/specs/runner-integrity-manifest/spec.md` | Modify | Delta sync at archive |
| `openspec/specs/publish-pipeline-hardening/spec.md` | Modify | Delta sync at archive |
| `openspec/pending-changes.md` | Modify | 23-row disposition table + 3 owed registrations + deferred-item triggers |
| `src/**` | Read-only | **Deliberately untouched** — byte-neutrality (REQ-CAP-06) is the gate that keeps this change out of the code-execution sensitive row |

**Create rows vs the budget gate**: ruling 8's "zero new committed artefacts" bans *data* artefacts requiring rubber-stamp updates on ordinary closure edits. Two source modules and a fixture corpus are code, versioned with the guard and changed only by a PR that changes the guard's tests — the gate is respected.

## 2b. Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| `bun run build` → manifest generation | Modify | REQ-CAP-01..06, PRM-01, XPO-01, FCG-01, DGN-01 | `test/fitness/fit-42-*.negative.test.ts` (extend) | Build-time gate; new classifier, single fail-closed boundary, atomic write |
| CI publish job (push to `main`) | Modify | REQ-PPI-01..05 | `test/fitness/fit-23-publish-workflow-guard.test.ts` (extend) + `test/fitness/fit-46-publish-sequence-integrity.test.ts` (new) | Explicit rebuild + suite gate; a violating closure never reaches a publish step |
| Contributor reads the invariants doc | Modify | REQ-DLV-01 | `test/docs/runner-integrity-docs.test.ts` (extend) | Counts derived from live derivation; doc promises no more than the guard enforces |

No user-facing runtime flow changes — the change ships no runtime bytes.

## 2c. Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `scripts/` (maintainer + build + CI tooling) | extend | Two new predicate modules inside the existing tooling boundary; `derive-runner-closure.ts` stays the ONE walk | aligns |
| `scripts/derive-runner-closure.ts` (ONE walk + classifier + deny-scan) | modify | Deny-scan leg replaced by capability admission; the one-derivation/three-consumers shape is unchanged | aligns |
| `scripts/generate-runner-manifest.ts` (BUILD authority) | modify | Single fail-closed boundary + atomic write; still chained LAST, still fail-closed | aligns |
| `test/fitness/fit-42-*` (CI authority) | extend | New red-proofs and 3 of the 4 fitness functions inside the existing CI-authority split | aligns |
| `test/support/` (test helpers) | modify | Disjointness predicates relocate to `scripts/`; `test/support/` becomes consumer — placement only, the BUILD/CI authority split (ADR-0075) is untouched | aligns |
| `.github/workflows/publish.yml` (deploy surface) | modify | Explicit rebuild step + suite gate inside the existing hardened job | aligns |
| `dist/runner-manifest.json` (cross-repo contract) | — | **Byte-identical by gate** — the contract is not touched | aligns |

Zero `deviates` rows. The `test/support/` → `scripts/` relocation is a move *within* the documented build-integrity cluster, not a boundary change: ADR-0081 states placement-not-timing explicitly, so it cannot be read as reversing ADR-0075 (Constraint 1 ships structural/CI, never loader-observed at build time).

## 3. Data Model

```ts
// scripts/capability-admission.ts

/** Admitted global bindings — fully-qualified single names, never prefixes or wildcards. */
export const ADMITTED_GLOBALS: ReadonlySet<string>;      // pinned by exact count (22 today)

/** Admitted `node:` module surfaces — per module, the admitted named exports. */
export const ADMITTED_NODE_SURFACES: ReadonlyMap<string, ReadonlySet<string>>;  // 6 modules today

/**
 * Admitted static member paths off free roots (e.g. `process.stdout`), one level down from
 * ADMITTED_GLOBALS/ADMITTED_NODE_SURFACES — closes the "member admission is not a closed
 * property" gap (plan-verify iteration-2, finding A; REQ-CAP-04.6-.8). A member path off an
 * admitted root that is NOT in this table (e.g. `process.dlopen`) is a violation by default.
 */
export const ADMITTED_MEMBER_PATHS: ReadonlySet<string>;  // pinned by exact count (28 today, this file's §1 probe)
// Depth ≥2 note (2026-07-29, plan-verify iteration-3 finding A2): entries are FULL recorded
// paths at any depth (the real closure carries e.g. `process.stdout.write.bind`, depth 3);
// admission is exact full-path membership, never prefix-inherited — "one level down" above
// describes the admission step, not a depth cap. Normative wording: spec REQ-CAP-04.6-.8
// depth-clarification block.

/** The ONE register of denied capability primitives, enforced at ONE site (REQ-PRM-01). */
export const DENIED_CAPABILITY_PRIMITIVES: ReadonlySet<string>;  // exactly 11 members

/** Closed union — a new member forces a compile error at the classifier's exhaustive switch. */
export type SurfaceNodeKind =
  | "callee"            // expression of a CallExpression / NewExpression
  | "value-reference"   // free Identifier in value position
  | "member-path"       // non-computed PropertyAccessExpression rooted at a free Identifier
  | "meta-property"     // import.meta
  | "module-specifier"; // static import/export specifier

export interface SurfaceNode {
  readonly kind: SurfaceNodeKind;
  readonly node: Node;
  readonly text: string;        // fully-qualified path for member-path, name otherwise
  readonly line: number;
}

export type Disposition =
  | { readonly kind: "admitted"; readonly via: "local" | "closure-import" | "admitted-global" | "admitted-builtin-surface" | "exempt-anchor" }
  | { readonly kind: "violation"; readonly rule: ViolationRule; readonly detail: string }
  | { readonly kind: "unclassifiable"; readonly detail: string };

/** WHAT IS PRESENT. Independent of the classifier — this is what makes totality falsifiable. */
export function enumerateCapabilitySurface(sourceFile: SourceFile): readonly SurfaceNode[];

/** WHAT IS ADMITTED. Total over SurfaceNodeKind; the `default` arm yields `unclassifiable`. */
export function classifySurfaceNode(node: SurfaceNode, ctx: FileContext): Disposition;

/** Per-file facts resolved once: scope chain, import bindings, reassignments, exemption proof. */
export interface FileContext {
  readonly file: ClosurePath;
  readonly bindings: ReadonlyMap<string, BindingOrigin>;
  readonly reassignedImports: readonly string[];        // REQ-CAP-02 rule (a)
  readonly reassignedModuleLocals: readonly string[];   // REQ-CAP-02 rule (b)
  readonly exemption: ExemptionProof | undefined;       // REQ-XPO-01
}

/** D-3: origin is per-POSITION — `tainted` is admitted as a value, denied as a callee. */
export type BindingOrigin =
  | { readonly kind: "local" }
  | { readonly kind: "closure-import"; readonly specifier: string }
  | { readonly kind: "admitted-global" }
  | { readonly kind: "tainted"; readonly reason: "computed-initializer" | "denied-initializer" | "undecidable-initializer" | "reassigned" };

/** REQ-XPO-01: a proof ON THE FILE, forfeit on any other arrangement. */
export interface ExemptionProof {
  readonly primitive: "createRequire" | "dynamic-import";
  readonly binding: string;
  readonly form: "named-import" | "namespace";   // REQ-XPO-01.2 closes R2-5
  readonly anchorIsClosureNode: boolean;         // REQ-XPO-01.5 closes M1.13 anchor drift
}
```

### Scope analysis — the binding forms handled (the HIGH risk, enumerated)

Hand-rolled, syntax-only, biased so **ambiguity means violation** (REQ-CAP-02/03/04 make this normative, not prose). A crude "module-scope declarations + parameters" filter over-reported the real closure's free identifiers **159 vs the true 22** — evidence that partial scope handling is not merely imprecise but useless, so the closed list below is load-bearing.

| Binding form | Handling |
|---|---|
| `var` (function-scoped hoisting) | Hoisted to the nearest function/source scope, not the block |
| `let` / `const` (block-scoped) | Bound at the nearest block, `for`, `for-of`/`for-in`, or `catch` scope |
| Function / class declarations | Bound in the enclosing scope; class name also bound inside its own body |
| Parameters, incl. defaults and rest | Bound in the function scope; a default initializer is classified in the enclosing surface |
| Object / array destructuring (nested) | Every leaf `BindingElement` name bound; `propertyName` is E3-excluded, not a reference |
| `catch (e)` and optional-catch-binding | Bound in the catch scope; absent binding handled |
| Class fields and methods | Field/method *names* are E2/E3-excluded; initializer expressions are surface |
| Import bindings (named, default, namespace, aliased) | Bound as `closure-import`; **reassignment is always a violation** (REQ-CAP-02 rule (a)) |
| `import.meta` | `meta-property` surface kind — not a free identifier (probe artefact corrected) |
| TDZ / use-before-declaration | Not modelled — a reference resolving to a same-scope binding is admitted regardless of position; TDZ is a runtime error, never a capability yield, and modelling it would add ambiguity in the *permissive* direction |
| Anything unrecognised | `unclassifiable-construct` → violation (REQ-CAP-01.3) |

## 4. Interface Contracts

No external interface changes. `dist/runner-manifest.json` (`manifestVersion: 1`) is **byte-identical** — enforced, not assumed.

Internal contract deltas — `VIOLATION_RULES` gains four members, each with a `RULE_BODIES` entry true of its own defect (REQ-DGN-01):

| New rule | Fires on | Closes |
|---|---|---|
| `constraint-4-undecidable-callee` | callee not a statically resolvable binding | M2.1, M2.2, R1-7 |
| `constraint-4-inadmissible-origin` | resolved binding's origin outside the admitted four | M2.9 + the three ruled-in siblings |
| `manifest-version-invalid` | missing / non-string / empty `package.json#version` | R2-3 (was misreported as `unreadable-file`) |
| `directory-specifier` | specifier resolves to a directory, not a file | R1-8 (same misdiagnosis) |

Drift-renderer voice is the **deny register**, never the permissive graph-drift register: a capability finding says *this is forbidden and here is how to write it differently*, never *this is not automatically wrong*.

## 5. Architecture Decisions

### ADR-0079: Capability admission replaces the Constraint-4 deny-scan

**Status**: Proposed · **Supersedes**: ADR-0076 (`constraint-4-outright-createrequire-ban-anchored-exemption`) on mechanism; its *ban* survives, its *deny-scan realisation* does not.

**Context**: `denyScan` iterates identifiers and `continue`s the unrecognised — default pass, committed set forbidden. Two judging rounds closed five AST spellings and neither could establish the set was closed. Three escapes are probe-confirmed live on `main`: `globalThis["ev"+"al"]("1+1")`, `(()=>{}).constructor("return 1")()`, and `node:child_process`. The shape tail is a consequence of which branch is the default, not of AST checking.

**Decision**: every node of a closure file's capability surface classifies into exactly one of `{admitted, violation, unclassifiable-construct}`; default is violation; ambiguity is violation. The admitted set is two closed tables in `scripts/capability-admission.ts` — probe-measured at 22 globals and 6 `node:` module surfaces — versioned with the guard, changed only by a PR that also changes the guard's tests. Three legs, all syntax-only: callee decidability, origin admission, positional decidability for denied roots.

**Consequences**:
- An ordinary closure edit introducing no new capability requires zero table edits, so there is nothing to rubber-stamp; adding a genuine capability is exactly the event that should stop a reviewer.
- Cost: a hand-rolled scope walk with its own tail, biased permissive-is-fatal. Mitigated by ambiguity⇒violation as a REQ, the no-reassignment precondition as its own REQ, and 0/423 undecidable callees measured on the real closure. The semantic oracle is registered as a followup with its re-open trigger, not built.
- **Trust assumptions recorded, not expanded**: ts-morph@28.0.0 + the build env are the tripwire TCB (W3, exact-pinned, frozen lockfile); marker-comment sanctions are forgeable by the same population that can commit — net-neutral on adversary capability, strictly better on decidability; a manifest is an inclusion list and cannot express absence (W4) — Constraints 2/3 remain the only things converting "24 listed" into "24 executed".

**Alternatives considered**:
- **Per-guard positional predicates** (explore.md Approach 1, its own recommendation): superseded on evidence surfaced after it was written — it leaves the default at *pass*, and all three confirmed escapes survive it. PM, QA and the architect converged independently.
- **Generated, committed capability baseline artefact** (architect's original): declined by ruling 8 — it churns on ordinary edits, and rubber-stamping restores default-pass through the human. Property adopted, artefact declined.
- **ts-morph type checker / module resolution**: rejected — it makes a fail-closed build gate's verdict a function of install state.

### ADR-0080: Tripwire classifiers are total with a fail-closed default

**Status**: Proposed

**Context**: `classifySpecifier` is total by construction and has produced zero findings across two judging rounds; `denyScan` is not and produced every Constraint-4 finding in both. The difference is a class property, not a property of either guard, and nothing currently prevents the next tripwire from being written in the losing shape.

**Decision**: every tripwire classifier in this repo is total over a closed input union with the unrecognised branch yielding a violation. Totality is proven structurally by a paired **enumerator/classifier** split — `enumerateCapabilitySurface` (what is present) and `classifySurfaceNode` (what is admitted) — with `FIT-CAP-TOTALITY` asserting exact structural equality of classified-node count and present-node count, never a threshold. Exclusions from the surface are *claims that a node cannot yield a capability*, each named and red-proven; they are never pass paths.

**Consequences**:
- Would have prevented every Constraint-4 finding in both rounds; a new node kind fails the build loudly rather than passing silently.
- Cost: two functions to keep in step, and a genuinely new construct fails the build until the guard learns it — deliberate friction on exactly the event that should stop a reviewer.
- Cost: exclusions are a soft spot by construction — widening one is the cheapest way to reintroduce default-pass. Each carries its own red-proof for that reason.

**Alternatives considered**:
- **Totality as a code-review convention**: rejected — prose exhaustiveness claims are precisely what failed twice.
- **Single function returning `Disposition | undefined`**: rejected — the count comparison becomes self-referential, so the mutation that routes an unrecognised node to a pass path cannot be detected by the fitness function it is supposed to fail.

### ADR-0081: Path verdicts are resolution-based; tripwire predicates live in `scripts/`

**Status**: Proposed

**Context**: `normaliseForComparison` decides bundler-output disjointness by string manipulation; five spellings escape it, probe-confirmed (`--outdir .//dist/transport`, `--outdir .`, `-odist/…`, `--outdir ../<pkg>/dist/…`, `--outdir=$VAR`). Separately, the disjointness predicate lives in `test/support/` while every other tripwire predicate lives in `scripts/`.

**Decision**: (1) verdicts are computed by `resolve()`ing BOTH the closure path and the candidate target and testing resolved-prefix containment; every candidate reading of an ambiguous flag token is tried, including the `-o` short form; an undecidable target (`$VAR`, command substitution) is an explicit `unclassifiable-construct` violation, never a pass. (2) The predicate moves to `scripts/bundler-disjointness.ts` with `test/support/closure-integrity-checks.ts` as consumer.

**Consequences**:
- Verdicts become spelling-invariant, so closing a spelling stops being the unit of work.
- Over-approximation is the safe direction: a false positive fails a build; a false negative voids the closure-sealing lemma.
- **(2) is PLACEMENT, NOT TIMING — this is explicitly NOT a reversal of ADR-0075.** Constraint 1 continues to ship as a structural CI check (`fit-42`), never as a loader-observed build tripwire. Moving the predicate's source file changes who *hosts* it, not when it *runs*; the BUILD/CI/ENGINE authority split is untouched.

**Alternatives considered**:
- **Add the five escaping spellings to the normaliser**: rejected — it is the "add another spelling" move this change exists to end, and success criterion 11 fails on it by definition.
- **Full shell-grammar parse of `package.json#scripts`**: rejected as disproportionate; M3.6 script-chaining is registered OUT with reason rather than silently absorbed.
- **Leave the predicate in `test/support/`**: rejected — one home for tripwire predicates is what makes "which branch is the default?" answerable by reading one directory.

## 6. Test Derivation

Every one of the 22 signed REQ-IDs appears; each row names its scenarios explicitly. Levels are top-down. Strict TDD: **43 red-proof scenarios each get a RED-first commit asserting rule identity AND exact count — never an aggregate**. Corpora are directory-enumerated (discovered by `readdir`, declared class-ID list committed, both directions asserted); expected rule is encoded in the fixture filename and asserted as a **multiset**, never `> 0`. Every red corpus has a mandatory green sibling. All violation messages are asserted **whole and verbatim** (REQ-CST-06.1) — `toContain` is forbidden.

| REQ-ID | Scenarios | Level | Test vehicle | Flow ref |
|---|---|---|---|---|
| REQ-CAP-01 | .1 (real tree), .2 [red], .3 [red] | architectural | `fit-42-*.test.ts` (FIT-CAP-TOTALITY) + `.negative.test.ts` | build |
| REQ-CAP-02 | .1 [red], .2 (sibling +, pins 3 reassignments w/ admitted RHS — D-2) | unit | `fit-42-*.negative.test.ts`, `fit-42-*.test.ts` | build |
| REQ-CAP-03 | .1 [red] M2.1, .2 [red] M2.2, .3 (sibling +) | unit | `fit-42-*.negative.test.ts` + `fixtures/red/runner-tripwires/{deny-scan,green}/` | build |
| REQ-CAP-04 | .1 [red] `node:child_process`, .2 (sibling +, six-member baseline), .3 [red] R1-15, .4 (admitted tables exact-membership), .5 [red] table widening, .6 (member-path table exact-membership, plan-verify iteration-2), .7 [red] `process.dlopen` (plan-verify iteration-2), .8 [red] member-path table widening (plan-verify iteration-2) | unit | `fit-42-*.negative.test.ts` + `deny-scan/` | build |
| REQ-CAP-05 | .1 (`instanceof`, R1-17), .2 [red] `const F = Function` (SC-2), .3 (`typeof`) | unit | `fit-42-*.negative.test.ts` + `green/` | build |
| REQ-CAP-06 | .1 [red] byte-identical manifest | architectural | `fit-42-*.test.ts` (FIT-MANIFEST-BYTE-NEUTRAL) + slice gate vs `bf6c983c…a530` | build |
| REQ-PRM-01 | .1 (exact 11-member set), .2 [red] unfixtured member (M2.10/M6.2) | unit | `fit-42-*.test.ts` + corpus-completeness check over `mutants/` | build |
| REQ-XPO-01 | .1 (named-import anchor), .2 (namespace form, R2-5), .3 [red] aliased, .4 [red] re-export laundering (M1.12), .5 [red] anchor drift (M1.13) | unit | `fit-42-*.negative.test.ts` + `{deny-scan,green}/` | build |
| REQ-PTH-01 | .1–.5 [red] five escaping spellings, .6 (sibling +, `dist/bin/pbuilder-codegen.js`) | architectural | `fit-42-*.test.ts` (FIT-PATH-SPELLING-INVARIANCE) + `bundler-scripts/` | build |
| REQ-FCG-01 | .1 [red] malformed JSON (R2-4), .2 [red] unreadable mid-derivation (R1-6), .3 [red] generic throw (R1-5), .4 [red] biconditional ≥3 faults / pre-seeded root, .5 (success) | integration | `fit-42-*.negative.test.ts` (FIT-FAILCLOSED-BICONDITIONAL) + `fail-closed/` + `test/support/scratch-dir.ts` | build |
| REQ-DGN-01 | .1 [red] version rule (R2-3), .2 [red] directory-specifier rule (R1-8), .3 (rule-identity totality over the fixture corpus, plan-verify iteration-2), .4 [red] rule-swap/misattribution mutant (plan-verify iteration-2) | unit | `fit-42-*.negative.test.ts` | build |
| REQ-DLV-01 | .1 (counts vs live derivation), .2 [red] stale count | unit | `test/docs/runner-integrity-docs.test.ts` | docs |
| REQ-CST-04.2 | .1–.9 [red] nine denied primitives, named verbatim | unit | `fit-42-*.negative.test.ts` + `deny-scan/` (one fixture per register member — REQ-PRM-01.2 pairs) | build |
| REQ-CST-04.3 | .1 (real tree, anchor not flagged), .2 [red] AST-counted non-vacuity (R1-10) | architectural | `fit-42-*.test.ts` | build |
| REQ-CST-06.1 | .1 (all messages whole), .2 [red] substring-passing / whole-failing (R2-3) | unit | `fit-42-*.negative.test.ts` — **47 existing `toContain` message assertions converted to whole-verbatim equality** — plus a standing scan forbidding `toContain` on tripwire messages | build |
| REQ-RMD-05.1 | .1 (segment-bounded, `runner.js` not a false positive), .2 [red] genuine `dist/runner/` segment | unit | `fit-42-*.test.ts` + `.negative.test.ts` | build |
| REQ-RMD-01.2 | .1 (no locale-sensitive API in generator source), .2 [red] planted `.localeCompare()` | architectural | `fit-42-*.test.ts` (source scan over the generator + transitive helpers) | build |
| REQ-PPI-01 | .1 (packed digests vs packed bytes), .2 [red] `--ignore-scripts` mismatch | integration | `fit-46-publish-sequence-integrity.test.ts` (real stamp→rebuild→pack against a scratch target) | publish |
| REQ-PPI-02 | .1 (rebuild step present + positioned), .2 [red] absence caught | unit | `fit-23-publish-workflow-guard.test.ts` | publish |
| REQ-PPI-03 | .1 (suite gates publish), .2 [red] violating closure never reaches publish (S9), .3 (sibling +, clean closure does) | integration | `fit-23-*.test.ts` (.1) + `fit-46-*.test.ts` (.2/.3, scratch tree) | publish |
| REQ-PPI-04 | .1 (per-file timeout declared), .2 [red] non-resolving fixture fails at the boundary | unit | `fit-23-*.test.ts` (.1, structural) + `test/conformance/react-conformance.test.ts` | publish |
| REQ-PPI-05 | .1 (execution order read), .2 [red] textual/execution divergence (R1-13) | unit | `fit-23-*.test.ts` — `publishRunSteps` (local, lines 147-155) today flattens `Object.values(doc.jobs).steps` in document order and **never reads `needs:`**; rewritten to topologically order jobs by `needs:` then preserve within-job step position | publish |

**Coverage: 22 / 22 REQ-IDs, 77 / 77 scenarios, 49 / 49 red-proofs** (plan-verify iteration-2
amendment, 2026-07-29: updated from this table's original 65/43 to match the current signed
totals — `specs/runner-integrity-manifest/spec.md`'s own tally notes are the authoritative
running count; this row was not restated after the CQ-1 foresight amendment or plan-verify
iteration-1's additions, so only the REQ-CAP-04 and REQ-DGN-01 rows above carry their full
current scenario lists inline — the other rows' inline scenario lists (e.g. REQ-CAP-01,
REQ-PTH-01) predate those same amendments and are not individually restated by this pass,
which is scoped to plan-verify iteration-2's findings A and B). Every Create/Modify flow has ≥1
integration-or-above row.

### Existing test surface — three corrections established by inventory

**(a) "18 red-proofs" is scoped, not total.** The 18 are exactly the **S-000 tier** of `fit-42-*.negative.test.ts` — the red-proofs that drive `deriveRunnerClosure(...).violations` directly (7 in the specifier-classification block, 11 in the deny-scan block). The file's total red-proof-shaped surface is ~50+ once the S-002/S-003 message-format and `closure-integrity-checks` tiers are counted. Survival obligations below are stated against the 18; the wider surface must stay green but is not the pinned set.

**(b) Survival is BEHAVIOURAL, not byte-for-byte — because REQ-CST-06.1 requires editing these very tests.** Inventory: message assertions today use `toContain` in **47 places** across the negative file, with **zero** whole-message equality anywhere. REQ-CST-06.1 (unfrozen) forbids substring assertion, so those 47 must be converted. A "byte-for-byte" survival rule would directly contradict the signed spec. The obligation is therefore:

> Every one of the 18 planted-input red-proofs must still produce the **same violation, asserted by rule identity AND exact count**, under the new mechanism. An assertion may only be made **stricter** (substring → whole-verbatim); a planted-input test may never be deleted or weakened. Zero test deletions without naming, in the commit message, the surviving test that proves the same property.

Six of the 18 (#10–#16, the `CST-04.x` deny-scan family) exercise the mechanism being replaced — they must stay green **through the new code path**, which is the sharpest single regression signal in the change. Survival is a slice acceptance criterion on every mechanism slice, never a one-time check at the end.

**(c) Two hazards the inventory surfaced, to be carried into slicing:**

- **Existing red-proof #12 (`REQ-CST-04.4: the namespace form is caught`) vs new REQ-XPO-01.2 (`namespace form is now green`)**: these are compatible only because they plant *different* fixtures — #12 plants `m.createRequire(…)` in a **non-anchor** closure file (still denied); XPO-01.2 plants it at the **anchor path** with the resolve-only shape (now green). The hazard is closing XPO-01.2 by relaxing #12. **XPO-01.2 must be built with #12 green in the same commit**, and the anchor-site comment cross-referencing both REQs (spec Open Item 2) is what stops the next reader from collapsing them.
- **Two threshold assertions** (`toBeGreaterThanOrEqual(2)` and `(1)`, both in the aliasing/decoy forfeiture cases) violate the exact-counts-never-thresholds rule. Forfeiture is deterministic under REQ-XPO-01's file-level proof, so both become exact equalities.

**(d) Fixture corpus — a deliberate departure from the file's current idiom.** `fit-42-*` builds every fixture at runtime (`scratchDirFactory("fit-42n-")` from `test/support/scratch-dir.ts`, plus a local `plantTree(files)`), with nothing committed. The new corpora under `test/fixtures/red/runner-tripwires/**` are **committed** instead, because a runtime-planted fixture cannot be `readdir`-enumerated — and directory enumeration is precisely the machine-checked exhaustiveness device (corpus ⇔ declared class-ID list, asserted in both directions) that replaces the rejected ts-morph mutation harness. `plantTree`/`scratchDirFactory` remain in use for one-off scratch trees and for every `FIT-FAILCLOSED-BICONDITIONAL` scratch root.

**PPI-01/02 vs the existing REQ-PMF-02.2** (spec Open Item 2): complementary, not duplicated. `PMF-02.2` stays a `runner-integrity-manifest`-owned **unit-level** `--ignore-scripts` red-proof against BPI-03; `PPI-01` is the `publish.yml`-owned **behavioural** real-sequence proof and `PPI-02` its structural declaration. Different seams, different owners, both retained.

## 7. Fitness Functions

Exactly four — the owner-ratified budget (Open Item 4), no fifth without a budget re-open.

| Fitness function | Rule enforced | REQ | Home |
|---|---|---|---|
| `FIT-CAP-TOTALITY` | classified-node count == present-node count, exact structural equality over every closure file and every fixture | REQ-CAP-01 | `fit-42-*.test.ts` |
| `FIT-PATH-SPELLING-INVARIANCE` | disjointness verdicts are invariant under spelling; deterministic cross-product enumerator over the flag/path grammar, ground-truth oracle = Node's own `resolve`/`relative` semantics (QA TD-9) | REQ-PTH-01 | `fit-42-*.test.ts` |
| `FIT-FAILCLOSED-BICONDITIONAL` | `exit ≠ 0` ⟺ no manifest, driven **per injected fault** against a **pre-seeded** scratch root | REQ-FCG-01 | `fit-42-*.negative.test.ts` |
| `FIT-MANIFEST-BYTE-NEUTRAL` | the built manifest is byte-reproducible from a fresh derivation under the new classifier (standing), plus the one-shot cross-tree sha comparison (slice gate) | REQ-CAP-06 | `fit-42-*.test.ts` |

Registered as followups with re-open triggers, **not built**: `FIT-CAP-ORACLE` (CI differential vs ts-morph symbol resolution), `FIT-NO-CHECKER-IN-BUILD`, `FIT-SINGLE-PREDICATE`, `FIT-RULE-REACHABILITY`, `FIT-BASELINE-NOT-SELF-HEALING`.

## 8. Migration / Rollout

No data migration, no feature flag, no deployment ordering — the change ships **no runtime bytes**.

**Byte-neutrality gate (blocking, per slice)**: `dist/runner-manifest.json` must hash to `bf6c983c59281eaf91ceefcb363375b52436808bbe74ee5241818f47eccfa530` (recorded at HEAD `e6dcde2`) after every mechanism slice. A mismatch means the change reached `src/` and became cross-repo — **halt before slicing continues**, do not warn.

**Slice ordering** (SC-1..SC-4, binding on `sdd-slice`): S-000 is the publish-path slice (REQ-PPI-01..05 + the react-conformance timeout, one slice, independently mergeable, zero dependency on the mechanism); R1-17's `instanceof` relaxation (REQ-CAP-05.1) lands **with** callee decidability (REQ-CAP-03), never before; REQ-CAP-01's property and `FIT-CAP-TOTALITY` are one slice; the docs half (REQ-DLV-01) lands after the enforcement it describes.

**Rollback**: per the proposal — mechanism slices revert as units to the current (weaker but functioning) `denyScan`. **Spec and guard revert together, always**: leaving a re-signed spec over a reverted guard produces a signed promise nothing enforces, strictly worse than the starting state. Post-rollback validation: suite green at the pre-change count, `fit-23` 18/18, all 18 original red-proofs present, manifest sha matches the value above.

## 9. Performance Considerations

The classifier adds one full-descendant pass plus a per-file scope-chain resolution over 23 files at build time; the existing walk already parses each file once via the shared ts-morph `Project`, and the scope walk is reused from the same `SourceFile`. Measured surface is small (423 call/`new` sites, 22 free identifiers). Build-time impact is negligible and off the runtime path entirely.

`FIT-PATH-SPELLING-INVARIANCE`'s cross-product enumerator and `fit-46`'s real `npm pack` sequence are the two slow tests; both are bounded (a committed grammar; one pack against a scratch dir) and `fit-46` is the reason REQ-PPI-04's per-file timeout ships in the same slice.

## 10. Architecture Impact

**Architecture impact**: `additive`

**Rationale**: derived from §2c — every touchpoint is `aligns`, zero `deviates`. Two new predicate modules join the existing `scripts/` build-integrity cluster without modifying its boundaries; the one-derivation/three-consumers shape, the BUILD/CI/ENGINE authority split (ADR-0075), and the `dist/runner-manifest.json` cross-repo contract are all unchanged — the contract is byte-identical by enforced gate. The `test/support/` → `scripts/` predicate relocation moves a file *within* the documented cluster (ADR-0081 states placement-not-timing), so the baseline gains entries and nothing in it becomes wrong. ADR-0079 supersedes ADR-0076 on *mechanism* while its architectural statement (an outright ban with one anchored exemption) survives intact.

## 11. Open Questions

**None.** All three deferred-to-design items are settled: ADR numbering and consolidation (0079-0081, three of the ≤3 budget, verified free against `0078` max on disk); the R1-16 probe (§1, resolved in both directions with the JSDoc surface exclusion E1 as its closure); predicate placement (ADR-0081, stated as placement-not-timing).

Three items are recorded as **archive-time obligations**, not design blockers: a tech-writer pass on REQ-CST-04.1's rationale sentence and on REQ-CAP-02.2's scenario title (spec Open Items 1 and D-2); an explicit code comment at the anchor site cross-referencing REQ-CST-04.4 and REQ-XPO-01.2 so the synthetic-vs-real scoping is not left implicit (spec Open Item 2); and the register-disposition-completeness check as a PM/archive-gate mechanical pass, not a spec REQ (spec Open Item 3).

`adversarial_review`: **required** — L classification plus the `security (code execution)` sensitive area. `judgment-day` must be run blind, and success criterion 11 is its acceptance bar: *zero findings whose fix is "add another spelling"*.
