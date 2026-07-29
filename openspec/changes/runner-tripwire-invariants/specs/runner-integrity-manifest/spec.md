# Delta for Runner Integrity Manifest

**Spec version**: V3
**Status**: SIGNED — Daniel Ramirez, 2026-07-29 (V1 signed as drafted; owner rulings 1-8 incorporated)
**Change**: `runner-tripwire-invariants`

V2 → V3 (owner-authorized unfreeze batch, 2026-07-29, ruling 1 + PM finding + ruling 7):
Constraint-4's guard replaces a text-matching deny-scan with a default-deny
**capability-admission property** — every node of a closure file's capability surface
classifies into exactly one of `{admitted, violation, unclassifiable-construct}`; default
is violation; ambiguity is violation. Five REQs are unfrozen (`CST-04.2`, `CST-04.3`,
`CST-06.1`, `RMD-05.1`, `RMD-01.2`) because their signed text encodes the OLD mechanism or
is independently false as written. Twelve REQs are ADDED, one property per capability
family (CAP/PRM/XPO/PTH/FCG/DGN/DLV), each syntax-only decidable — no ts-morph type
checker or module resolution runs inside the fail-closed build gate.

**Explicitly NOT touched by this unfreeze batch** (verified against the signed text,
survive unmodified): `REQ-CST-04.1` (ruling 1 — the outright `createRequire` ban itself is
unchanged; the mechanism realizing REQ-XPO-01 below now proves its exemption differently,
but the requirement text was never mechanism-specific). `REQ-RCD-03` (R1-15's fix makes the
signed "zero silent skips" text TRUE — the code changes, the spec does not). `REQ-RCD-04.1`,
`REQ-BPI-03.1` (unaffected; BPI-03.1 gains a sibling REQ in the `publish-pipeline-hardening`
delta rather than a touch here, per the "explicit rebuild step keeps it green" note).

## ADDED Requirements

### REQ-CAP-01: Capability-Surface Totality

The classifier MUST classify every node of a closure file's capability surface into
exactly one of `{admitted, violation, unclassifiable-construct}`. The default for any node
the classifier does not recognise MUST be `violation` or `unclassifiable-construct` —
never a silent pass. For every closure file, classified-node count MUST equal
present-node count, asserted as an exact structural equality, never a threshold.

#### Scenario REQ-CAP-01.1: Totality holds on the real closure

- GIVEN the current runner closure
- WHEN every capability-surface node (call/`new` callee, identifier reference, `node:`-prefixed specifier) is classified
- THEN classified-node count equals present-node count exactly

#### Scenario REQ-CAP-01.2 [red-proof]: A mutation routing an unrecognised node to a pass path is caught

- GIVEN a mutant classifier where one synthetic capability-surface node kind (not in `{admitted, violation, unclassifiable}`) is routed to silent pass
- WHEN the totality check runs against a fixture exercising that node kind
- THEN it fails, naming the node kind and that classified-count < present-count — this is FIT-CAP-TOTALITY's own mutation, proving it is not vacuous

#### Scenario REQ-CAP-01.3 [red-proof]: Unclassifiable is fail-closed, never a third pass path

- GIVEN a synthetic closure file containing a construct no admission leg (REQ-CAP-03/04/05) can resolve (a computed member expression on a computed base)
- WHEN classification runs
- THEN the build exits non-zero, no manifest exists, and stderr names the construct as `unclassifiable-construct`

**Plan-verify iteration-1 amendments (2026-07-29)** — closes gaps 5 and 7 of
`verify-plan-1.md`. Totality (CAP-01.1-.3) was pinned against the classifier's *output*
(classified == present) but the surface *inputs* — the `SurfaceNodeKind` union and the E1-E4
exclusions — carried no exact-membership pin or widening red-proof, symmetric with the gap
CQ-1 already closed on the admitted side (REQ-CAP-04.4/.5). A silent narrowing of the union or
widening of an exclusion keeps `classified.length === enumerated.length` trivially true — the
tail migrates to the enumerator instead of closing. Additive only; CAP-01.1-.3 unmodified.

#### Scenario REQ-CAP-01.4: The `SurfaceNodeKind` union is a closed set, pinned by exact membership

- GIVEN the `SurfaceNodeKind` union declared in `scripts/capability-admission.ts`
- WHEN the exact-membership assertion runs
- THEN it matches the pinned five-member set exactly (`callee`, `value-reference`,
  `member-path`, `meta-property`, `module-specifier`) — exact-set comparison, never a count
  threshold

#### Scenario REQ-CAP-01.5: The surface exclusions (E1-E4) are a closed set, pinned by exact membership

- GIVEN the exclusion table (E1 JSDoc-rooted nodes, E2 declaration-name nodes, E3 non-computed
  property-name nodes, E4 type-position identifiers)
- WHEN the exact-membership assertion runs
- THEN it matches the pinned four-member set exactly, each named — exact-set comparison, never
  a count threshold

#### Scenario REQ-CAP-01.6 [red-proof]: Silently narrowing the union or widening an exclusion is caught

- GIVEN two mutants: (a) a `SurfaceNodeKind` union with one member silently removed (narrowing
  the surface so totality stays trivially true), (b) an exclusion table with a fifth,
  unauthorised entry silently added
- WHEN the exact-membership assertions (CAP-01.4/.5) run
- THEN both fail, naming the removed union member or the unpinned exclusion respectively —
  narrowing the surface to keep totality trivially true is exactly as loud as widening an
  admitted table (REQ-CAP-04.5)

#### Scenario REQ-CAP-01.7: RCD-03.3's day-one JSDoc fixtures stay non-flagged under the new admission mechanism, governed by exclusion E1

- GIVEN `REQ-RCD-03.3`'s existing day-one JSDoc fixtures (a bare specifier and a resolvable
  relative specifier, both JSDoc-quoted) — signed under the retired `denyScan` mechanism
- WHEN capability-admission classification runs against the same fixtures
- THEN zero violations are reported, and the disposition trace names exclusion E1 (JSDoc-rooted
  nodes) as the reason — not CAP-01.2's mutation-catching red-proof, which asserts a different
  property (E1 is falsifiable, not merely unexercised); this is the Open-Item-5 scenario spec
  Open Item 5 recommended, and is what S-001.4's E1 task cites as its acceptance criterion

### REQ-CAP-02: No-Module-Scope-Reassignment Precondition

Before relying on callee decidability (REQ-CAP-03) or origin admission (REQ-CAP-04), the
system MUST prove, as its own decidable check, that no closure file reassigns a
module-scope binding. This precondition is load-bearing: a permissive precondition makes
both legs decidable-if-you-squint, and a permissive REQ-CAP-02 is a WORSE false negative
than the guard it replaces.

#### Scenario REQ-CAP-02.1 [red-proof]: Reassignment of a module-scope binding is a violation

- GIVEN a synthetic closure file that imports `createRequire` and later reassigns it (`createRequire = something`) at module scope
- WHEN the precondition check runs
- THEN the build fails, naming the reassigned binding and the file, distinct from any callee-decidability or origin-admission violation

#### Scenario REQ-CAP-02.2: The real closure has zero reassignments — sibling positive

- GIVEN the current runner closure
- WHEN the precondition check runs
- THEN it reports zero violations — proving REQ-CAP-02.1's fixture is not unconditionally true of every file

### REQ-CAP-03: Callee Decidability

Every call or `new` expression whose callee is not a statically resolvable binding MUST be
a violation. This is the leg that kills indirection, aliasing, and computed access
structurally, without spelling any of them out.

#### Scenario REQ-CAP-03.1 [red-proof]: `globalThis["ev"+"al"]("1+1")` — CONFIRMED LIVE ESCAPE (M2.1)

- GIVEN a synthetic closure file containing `globalThis["ev"+"al"]("1+1")`
- WHEN capability-admission classification runs
- THEN the build fails; the reported rule is the callee-decidability rule — never a claim that the specific primitive `eval` was identified by name, since the property catches the SHAPE, not the spelling (S1) — and the message names the file and line

#### Scenario REQ-CAP-03.2 [red-proof]: `(()=>{}).constructor("return 1")()` — CONFIRMED LIVE ESCAPE (M2.2)

- GIVEN a synthetic closure file containing `(()=>{}).constructor("return 1")()`
- WHEN capability-admission classification runs
- THEN the build fails; the reported rule is the callee-decidability rule, and the message names the file and line

#### Scenario REQ-CAP-03.3: A statically resolvable callee is admitted — sibling positive

- GIVEN a synthetic closure file calling a locally declared function through its bound identifier
- WHEN classification runs
- THEN zero violations are reported for that call

### REQ-CAP-04: Origin Admission

A resolved binding's origin MUST classify as exactly one of `{local, closure import,
admitted global, admitted builtin surface}`. Any other origin is a violation naming the
primitive.

#### Scenario REQ-CAP-04.1 [red-proof]: `node:child_process` is not an admitted builtin surface — RULED-IN PRIMITIVE (ruling 3)

- GIVEN a synthetic closure file importing from `node:child_process`
- WHEN origin admission runs
- THEN the build fails, naming `node:child_process` as the violating primitive — never classified as an ordinary admitted builtin (M2.9: spawning `node -e` is the arbitrary-code-execution bypass Constraint 4 names)

#### Scenario REQ-CAP-04.2: The admitted builtin baseline is unaffected — sibling positive

- GIVEN the current runner closure's existing admitted builtin imports (the six-member baseline builtin row, REQ-RCD-04.1)
- WHEN origin admission runs
- THEN zero violations are reported for those imports

#### Scenario REQ-CAP-04.3 [red-proof]: A `node:`-prefixed specifier absent from `builtinModules` AND the primitive register is unclassifiable, never silently builtin — closes R1-15

- GIVEN a synthetic closure file importing `node:nonexistent-module`
- WHEN origin admission runs
- THEN the build fails, naming it `unclassifiable-construct` (REQ-RCD-03 applies) — never silently treated as an ordinary builtin, making REQ-RCD-03's signed "zero silent skips" text true rather than amending it

**Foresight CQ-1 amendment (2026-07-29, owner-authorized)** — pins the admitted side
symmetric to the denied register; closes the ADR-0079 "nothing to rubber-stamp"
enforcement gap. Additive only — no existing REQ-CAP-04 scenario above is altered.

#### Scenario REQ-CAP-04.4: Admitted tables are pinned by exact membership

- GIVEN the admitted tables in the guard source (`ADMITTED_GLOBALS`, `ADMITTED_NODE_SURFACES`)
- WHEN the exact-count/exact-membership assertion runs
- THEN `ADMITTED_GLOBALS` matches its pinned 22-member list exactly and `ADMITTED_NODE_SURFACES` matches its pinned 6-module list exactly — exact-set comparison, never a threshold (`.size > N`)

#### Scenario REQ-CAP-04.5 [red-proof]: A silent widening of an admitted table is caught

- GIVEN a mutant `ADMITTED_GLOBALS` (or `ADMITTED_NODE_SURFACES`) with one extra entry added and no matching test change
- WHEN the exact-membership assertion (REQ-CAP-04.4) runs
- THEN it fails, naming the unpinned addition — the admitted side now carries the same three-layer pinning as the denied register (exact-set assertion here; per-member fixture via REQ-PRM-01/CST-04.2's table; widening red-proof via REQ-PRM-01.2 on the denied side, this scenario on the admitted side)

**Plan-verify iteration-2 amendment (2026-07-29, finding A)** — closes gap A of
`verify-plan-2.md`. REQ-CAP-04.4/.5 pin the two ORIGIN tables (`ADMITTED_GLOBALS`,
`ADMITTED_NODE_SURFACES`) by exact membership, but a member path reached THROUGH an
admitted global (e.g. `process.dlopen` — `process` is an `ADMITTED_GLOBALS` member,
`dlopen` is neither a `DENIED_CAPABILITY_PRIMITIVES` root nor pinned anywhere) was never
itself closed — design.md §1 probe-measured 28 distinct static member paths off free
roots, none denied, but nothing machine-checks that set; a member's admission today
follows silently from its ROOT's admission alone. `process.dlopen` is the 12th-spelling
gap Judge A named: admitted origin, undenied root, unlisted member. Additive only — no
existing REQ-CAP-04 scenario above is altered.

#### Scenario REQ-CAP-04.6: Member paths off an admitted global are pinned by exact membership, one level down

- GIVEN the member-path table for admitted globals (`ADMITTED_MEMBER_PATHS`, `scripts/capability-admission.ts`)
- WHEN the exact-membership assertion runs
- THEN it matches the pinned 28-member list exactly (design.md §1's probe count) — exact-set comparison, never a threshold; a member path reached through an admitted-global root that is NOT in this table classifies as `violation` (default-deny one level down), symmetric with REQ-CAP-04.4's origin-level pinning

#### Scenario REQ-CAP-04.7 [red-proof]: `process.dlopen` is denied despite an admitted origin and an undenied root

- GIVEN a synthetic closure file containing `process.dlopen(path)` — `process` is an `ADMITTED_GLOBALS` member (admitted origin), `dlopen` is not a `DENIED_CAPABILITY_PRIMITIVES` member (not a denied root), and `dlopen` is not in `ADMITTED_MEMBER_PATHS` (unlisted member)
- WHEN member-path admission (REQ-CAP-04.6) runs
- THEN the build fails, naming `process.dlopen` as the violating member path — proving member-path admission is closed under the same default-deny doctrine as origin admission, never inherited from the root's admission alone

#### Scenario REQ-CAP-04.8 [red-proof]: A silent widening of the member-path table is caught

- GIVEN a mutant `ADMITTED_MEMBER_PATHS` with one extra entry added and no matching test change
- WHEN the exact-membership assertion (REQ-CAP-04.6) runs
- THEN it fails, naming the unpinned addition — symmetric with REQ-CAP-04.4/.5's origin-table pinning; per `slices.md`'s Risks section (the DR-5/DR-2 growth-protocol ruling), a red test fixable only by widening a pinned table is a HALT surfaced to the owner, never a build-time auto-widen

**Depth ≥2 clarification (2026-07-29, plan-verify iteration-3 finding A2)** — additive; no
scenario above is altered. `ADMITTED_MEMBER_PATHS` entries are the closure's FULL recorded
member paths at whatever depth they occur (the §1 probe recorded the real closure's paths —
e.g. `process.stdout.write.bind` in `dist/transport/framing.js:69` is depth 3), and
admission is exact-membership of the full path: a chain is admitted only if the complete
dotted path is itself a table entry. Admission NEVER flows down from an admitted prefix —
"one level down" in REQ-CAP-04.6 describes the admission step (each path stands alone,
symmetric with REQ-CAP-04.7's no-inheritance-from-root), not a depth cap on table entries.
This is the only reading consistent with REQ-PRM-01's doctrine paragraph ("EVERY member
path that is neither a register primitive nor in the admitted table is a violation by
default") and it is load-bearing for the change's own goal: prefix inheritance under an
admitted path (e.g. subtree admission below `process.stdout`) would admit
`process.stdout.constructor.constructor("...")` and reopen the probe-confirmed
Function-constructor escape this change exists to close.

### REQ-CAP-05: Positional Decidability for Denied Roots

A denied root identifier MUST be permitted to appear ONLY in a closed list of
non-capability-yielding positions: `instanceof` right operand, `typeof` operand. Any other
position is a violation. This is what makes R1-17's relaxation of bare `Function` safe.

#### Scenario REQ-CAP-05.1: `x instanceof Function` is admitted — R1-17 relaxation

- GIVEN a synthetic closure file containing `x instanceof Function`
- WHEN positional classification runs
- THEN zero violations are reported for that occurrence

#### Scenario REQ-CAP-05.2 [red-proof]: `const F = Function; F("...")` stays denied — the R1-17 sequencing hazard, closed (SC-2)

- GIVEN a synthetic closure file containing `const F = Function; F("return 1")`
- WHEN positional classification AND callee decidability (REQ-CAP-03) run together
- THEN the build fails — proving the `instanceof` relaxation (REQ-CAP-05.1) did not reopen the aliased-call escape

#### Scenario REQ-CAP-05.3: `typeof Function` is admitted — sibling positive

- GIVEN a synthetic closure file containing `typeof Function === "function"`
- WHEN positional classification runs
- THEN zero violations are reported

### REQ-CAP-06: Manifest Byte-Neutrality

The Constraint-4 redesign MUST NOT change a single byte of `dist/runner-manifest.json` for
an otherwise-unchanged tree. This is build-tooling and test surface only; a mismatch means
the change became cross-repo and MUST halt before slicing continues.

#### Scenario REQ-CAP-06.1 [red-proof]: The manifest is byte-identical pre- and post-change

- GIVEN a clean build of the pre-change tree and its recorded `dist/runner-manifest.json` sha256
- WHEN the post-change tree is built the same way
- THEN the two manifests are byte-identical (matching sha256) — any mismatch is a build-time halt, not a warning

**Plan-verify final batch clarification (2026-07-29, finding B6)** — closes gap B6 of
`verify-plan-3.md`. REQ-CAP-06.1's WHEN clause ("the post-change tree is built the same
way") is the normative anchor: the gate procedure is **fresh build of `dist/` → live
closure walk over that fresh `dist/` → regenerate the manifest output from the walk →
compare the regenerated output's sha256 against the pinned digest**
`bf6c983c59281eaf91ceefcb363375b52436808bbe74ee5241818f47eccfa530` (recorded at HEAD
`e6dcde2`, design.md §8, Migration/Rollout). Hashing an already-committed
`dist/runner-manifest.json` without a preceding fresh build and regeneration proves
nothing about whether the mechanism redesign perturbed the derivation that PRODUCES the
bytes — a stale committed artefact cannot detect a defect in the code that generates it.
Additive only; no existing REQ-CAP-06 scenario text is altered.

### REQ-PRM-01: Capability Primitive Register

The system MUST maintain exactly ONE register of denied capability primitives, enforced at
exactly ONE site (folding `node:vm`'s separate `classifySpecifier` case into it). Every
register member MUST have a producing fixture; a member with no fixture is itself a
violation of this REQ.

#### Scenario REQ-PRM-01.1: Register membership is an exact set

- GIVEN the capability primitive register
- WHEN its members are enumerated
- THEN the set is exactly `{eval, Function, createRequire, Bun.plugin, process.binding, node:vm, node:child_process, node:worker_threads, WebAssembly, module.register, module.registerHooks}` — an exact set comparison, never `.length > N`

#### Scenario REQ-PRM-01.2 [red-proof]: A register member with no producing fixture is a violation (M2.10/M6.2)

- GIVEN a mutant register with an eleventh member added and no corresponding fixture directory entry
- WHEN the fixture-corpus-completeness check runs (corpus discovered by `readdir`, declared class-ID list committed, both directions asserted)
- THEN it fails, naming the unfixtured member

**Plan-verify iteration-2 amendment (2026-07-29, finding A cross-reference)** —
REQ-PRM-01.1's 11-member register includes four member-path-shaped (dotted) primitives:
`Bun.plugin`, `process.binding`, `module.register`, `module.registerHooks`. These are the
**DENIED subset** of the member-path space that REQ-CAP-04.6's `ADMITTED_MEMBER_PATHS`
table enumerates the **admitted** subset of — the two tables are disjoint by
construction (a member path cannot be both a register primitive and admitted). Every
member path that is neither a register primitive (this REQ) nor in the admitted table
(REQ-CAP-04.6) is a violation by default; REQ-CAP-04.6/.7/.8 make that default-deny
property machine-checked rather than assumed.

### REQ-XPO-01: Exemption Is a File-Level Proof Obligation

An exemption from Constraint-4 MUST be a proof ON THE FILE — exactly one unaliased binding
of the exempted primitive, forfeit on any other arrangement — never a predicate on an
individual occurrence. This covers both the `createRequire` anchor and, by the same model,
the sanctioned dynamic-`import()` site already governed by REQ-CST-03.

#### Scenario REQ-XPO-01.1: Anchor happy path — named-import form

- GIVEN `single-instance-probe.ts`'s anchored site with exactly one unaliased `createRequire` named-import binding used resolve-only
- WHEN the exemption proof runs
- THEN the site is exempt and zero violations are reported

#### Scenario REQ-XPO-01.2: Namespace form is now green — closes R2-5

- GIVEN a synthetic anchor file using `module.createRequire(u).resolve(s)` (the namespace form the anchor file's own header documents)
- WHEN the exemption proof runs
- THEN zero violations are reported — the false positive R2-5 named is closed, scoped to a SYNTHETIC closure file per REQ-CST-04.4 (the real anchor file's namespace-form use does not contradict CST-04.4's synthetic-fixture scoping)

#### Scenario REQ-XPO-01.3 [red-proof]: Forfeit on any other arrangement

- GIVEN a synthetic anchor file with an ALIASED `createRequire` binding (`const cr = createRequire`)
- WHEN the exemption proof runs
- THEN the exemption forfeits and every bound name in the file is denied

#### Scenario REQ-XPO-01.4 [red-proof]: Re-export laundering closed (M1.12)

- GIVEN a synthetic closure file that re-exports the anchor's `createRequire` binding, and a second closure file that imports and calls it through the re-export
- WHEN `createRequireBindingsIn`-equivalent analysis runs on the SECOND file
- THEN it is denied — the exemption does not launder through a re-export, because the second file's binding origin is not the anchor's own proof

#### Scenario REQ-XPO-01.5 [red-proof]: Anchor drift is caught (M1.13)

- GIVEN a mutant derived closure that omits `single-instance-probe.ts` from its node set while an exemption still references that path
- WHEN the exemption proof runs
- THEN the build fails, naming the drift — an exemption pointing at a file outside the walked closure is a dormant hole, not a pass

### REQ-PTH-01: Resolution-Based Path Verdicts

Bundler-output disjointness verdicts MUST be computed by resolving BOTH the closure path
and the candidate bundler target and testing resolved-prefix containment — never by string
normalisation. Every candidate reading of an ambiguous flag token MUST be tried, including
the `-o` short form. An undecidable target MUST be an explicit `unclassifiable-construct`
violation, never a pass. Closes R2-6 and the five confirmed escaping spellings (M3.1-M3.5).

#### Scenarios REQ-PTH-01.1–5 [red-proof]: Five confirmed escaping spellings, closed

Shared shape: GIVEN a `package.json#scripts` entry using the fixture form below; WHEN
resolution-based disjointness runs; THEN it violates, naming the script and the resolved
target — except `.5`, which names it `unclassifiable-construct`.

| Scenario | Fixture form | Prior escape mode |
|---|---|---|
| .1 | `--outdir .//dist/transport` | leading-`./`-strip left an absolute-rooted path |
| .2 | `--outdir .` | length-1 trailing-slash-strip skip missed total-root targeting |
| .3 | `-odist/...` (short form, unextracted) | flag never parsed at all |
| .4 | `--outdir ../<pkg>/dist/...` | relative-parent escape never resolved |
| .5 | `--outdir=$VAR` | undecidable at build time — MUST be `unclassifiable-construct`, never a pass |

#### Scenario REQ-PTH-01.6: `dist/bin/pbuilder-codegen.js` correctly judged outside — sibling positive (non-vacuity)

- GIVEN the real `package.json#scripts` and the closure path set
- WHEN resolution-based disjointness runs
- THEN `dist/bin/pbuilder-codegen.js` (present, legitimately outside the closure) reports zero violations — proving the check is non-vacuous, per REQ-BDI-01.1's existing non-vacuity clause

**Plan-verify iteration-1 amendment (2026-07-29)** — closes gap 6 of `verify-plan-1.md`.
REQ-PTH-01.1-.6 pin five known escaping spellings plus a non-vacuity sibling, all against a
**recognised** output-directing flag shape (`--outdir`, `-o`, `--outfile`). The mechanism
(ADR-0081, design §6 TD-9) is a deterministic cross-product enumerator over a **committed
flag/path grammar** — it tries every candidate reading of a token it recognises as
output-directing, it does not classify every token in a `package.json#scripts` line. Read
against that mechanism, full unparsed-token default-deny is NOT what REQ-PTH-01 can support
without inventing a second, unrelated classifier for ordinary non-output flags (`--minify`,
`--sourcemap`, `--target`, …), which would misclassify those as violations. The scenario below
is therefore scoped to tokens matching the grammar's own output-flag SHAPE (a leading `-o` or
`--out`-prefixed flag token) that are not one of the grammar's recognised spellings — the same
default-deny doctrine as CAP-01, applied at the grammar's actual decidability boundary, stated
honestly rather than oversold.

#### Scenario REQ-PTH-01.7 [red-proof]: An unrecognised output-flag-shaped token yields an explicit `unclassifiable` violation, never silence

- GIVEN a `package.json#scripts` entry containing a token shaped like an output-directing flag
  but not one of the grammar's recognised spellings (fixture: `--out-dir ./dist/transport`, a
  plausible but unregistered spelling — distinct from an ordinary non-output flag like
  `--minify`, which this scenario does not touch)
- WHEN resolution-based disjointness runs
- THEN the build fails, naming the token an `unclassifiable-construct` violation — never
  silently ignored — because an output-flag-shaped token the grammar cannot resolve is exactly
  as undecidable as `--outdir=$VAR` (PTH-01.5), and undecidable MUST NOT be a pass
- **Scope-limit sentence (honest, not silent)**: this scenario governs tokens matching the
  output-flag SHAPE grammar only; an ordinary flag with no output-directing shape (`--minify`,
  `--sourcemap`) is out of REQ-PTH-01's scope by design — REQ-PTH-01 verifies bundler-output
  *disjointness*, not general `package.json#scripts` token classification, and does not claim
  otherwise

**Plan-verify iteration-2 amendment (2026-07-29, finding H)** — clarifies, not modifies,
REQ-PTH-01's normative sentence above ("Closes R2-6 and the five confirmed escaping
spellings (M3.1-M3.5)"): **R2-6 is closed in full by M3.1-M3.5** (REQ-PTH-01.1-.5), the
five confirmed spelling escapes. **M3.6** (script-chaining/indirection through a second
`package.json#scripts` entry) is a DISTINCT surface, a sibling of M3.1-M3.5 but not one
of the five R2-6 named — owner-ruled OUT of scope (ruling 3), registered as a fresh
debt row at archive (see `slices.md`'s Deferred-to-archive list and this change's
`triage.md` Scope Amendment). Wherever this change's artefacts say "closes R2-6," the
scope is the five confirmed spellings only; M3.6 is never implied.

### REQ-FCG-01: Fail-Closed Generation Totality

Every failure path in `generate-runner-manifest.ts` MUST route through exactly ONE
fail-closed boundary such that `exit code ≠ 0` if and only if no manifest file exists at
`dist/runner-manifest.json`. The only write path MUST be write-temp-then-rename (or
equivalent hash-all-then-write-once atomicity). One property, absorbing R2-4, R1-5, and
R1-6 (ruling 3).

#### Scenario REQ-FCG-01.1 [red-proof]: Malformed `package.json` fails closed — R2-4

- GIVEN a prepared root with a malformed `package.json` (unparseable JSON) and a pre-existing manifest
- WHEN the generator runs directly against that root (not through `bun run build`, so `prebuild` cannot mask the assertion)
- THEN exit ≠ 0 and no manifest remains — not the stale byte-identical manifest R2-4 confirmed today

#### Scenario REQ-FCG-01.2 [red-proof]: Mid-derivation unreadable file leaves no manifest, atomically — R1-6

- GIVEN a file that becomes unreadable mid-derivation
- WHEN the generator runs
- THEN exit ≠ 0 and there is no file at all at `dist/runner-manifest.json` — never a truncated one, proven by write-temp-then-rename being the only write path

#### Scenario REQ-FCG-01.3 [red-proof]: An unrouted throw still fails closed — R1-5

- GIVEN a fault injected at a point in the generator NOT already covered by the malformed-package.json or unreadable-file paths (a generic thrown error)
- WHEN the generator runs
- THEN it still routes through the single fail-closed boundary — exit ≠ 0, no manifest — proving no failure path bypasses the boundary by construction, not by enumeration

#### Scenario REQ-FCG-01.4 [red-proof]: Fail-closed biconditional over ≥3 injected faults, pre-seeded scratch root

- GIVEN a scratch root PRE-SEEDED with a valid prior manifest (so a fail-open bug would leave a plausible-looking stale artefact, not an absence)
- WHEN each of ≥3 distinct fault kinds (malformed JSON, unreadable file, generic throw) is injected in turn and the generator runs
- THEN in every case exit ≠ 0 and no manifest exists — the biconditional holds per fault, not just in aggregate

#### Scenario REQ-FCG-01.5: Success yields a manifest — biconditional's other direction

- GIVEN a clean root with no injected fault
- WHEN the generator runs
- THEN exit = 0 and a manifest exists — pairing REQ-FCG-01.1-01.4's absence proofs with the presence case

### REQ-DGN-01: Diagnostic Rule-Identity Honesty

The `ViolationRule` reported for a violation MUST be true of that violation. A rule name
that does not describe the actual defect is itself a defect (R2-3 shipped 4/5 false
message lines under a rule that was never true of a version failure).

#### Scenario REQ-DGN-01.1 [red-proof]: Version-validation failure gets its own rule — R2-3

- GIVEN a `package.json` with an invalid `version` field
- WHEN the generator reports the failure
- THEN the reported `ViolationRule` is a version-specific rule, never `unreadable-file`, and every line of the whole message (REQ-CST-06.1) is true of a version failure

#### Scenario REQ-DGN-01.2 [red-proof]: Directory specifier gets its own rule — R1-8, spec-honesty bundle (ruling 7)

- GIVEN a closure specifier that resolves to a directory, not a file
- WHEN classification reports the failure
- THEN the reported `ViolationRule` names the directory-specifier condition distinctly — never misdiagnosed as `unreadable-file`

**Plan-verify iteration-2 amendment (2026-07-29, finding B)** — closes gap B of
`verify-plan-2.md`. REQ-DGN-01's normative text states a UNIVERSAL property ("the
reported `ViolationRule` MUST be true of that violation") but was pinned by only two
instance scenarios (DGN-01.1/.2 — R2-3 and R1-8 by name); no totality device makes a
third mis-attributed rule fail loudly. The property was asserted by example, not by the
exact-equality pattern REQ-CAP-01 already applies to classifier totality and
REQ-CAP-04.4/.5/.6 apply to the admitted/denied tables. Additive only — no existing
REQ-DGN-01 scenario above is altered.

#### Scenario REQ-DGN-01.3: Rule-identity totality over the fixture corpus

- GIVEN every violation-producing fixture in `test/fixtures/red/runner-tripwires/**`, each declaring its expected `ViolationRule`
- WHEN the full corpus runs and produces its violations
- THEN the produced-rule multiset equals the declared-rule multiset over the whole corpus run — exact multiset equality, never a per-fixture spot check — the CAP-01 totality pattern applied to diagnostics

#### Scenario REQ-DGN-01.4 [red-proof]: A rule-renderer swap or misattribution is caught without enumerating rules

- GIVEN a mutant that either (a) swaps the `RULE_BODIES` renderers of two distinct `ViolationRule`s, or (b) mints rule X for a violation whose fixture declares rule Y
- WHEN the rule-identity totality check (REQ-DGN-01.3) runs
- THEN it fails, naming the mismatched fixture and the declared-vs-produced rule pair — proving a THIRD mis-attributed rule (beyond R2-3 and R1-8's own two instances) fails loudly by property, not by enumerating every rule by hand

### REQ-DLV-01: Documentation Counts Derived From Derivation

`docs/runner-integrity-invariants.md`'s numeric claims about closure/file counts MUST be
asserted against the LIVE derivation output, never a frozen literal committed in the doc
test (R1-11).

#### Scenario REQ-DLV-01.1: Doc counts match the live derivation

- GIVEN `docs/runner-integrity-invariants.md`'s stated closure/file counts
- WHEN `test/docs/runner-integrity-docs.test.ts` runs
- THEN each stated count is compared against `deriveRunnerClosure`'s live output, not a hardcoded literal in the test itself

#### Scenario REQ-DLV-01.2 [red-proof]: A stale doc count is caught

- GIVEN a mutant doc with one count changed to a value that no longer matches the live derivation
- WHEN the doc test runs
- THEN it fails, naming the mismatched count and the live value

## MODIFIED Requirements

### REQ-CST-04.2: Denied Capability Primitives — Property, Not Enumeration

The system MUST fail the build for any closure-file reference to a denied capability
primitive (REQ-PRM-01's register), naming the offending primitive. This requirement
demands the PROPERTY — every register member is denied; the primitives below are
scenario-level EXAMPLES exercising that property, never an enumeration the requirement
text itself depends on (ruling 1).

(Previously: enumerated `eval, new Function, node:vm, Bun.plugin, process.binding`
directly in the requirement text, evaluated by the old text-matching deny-scan. Updated
per owner ruling 1 — the enumeration moves to scenario examples below; the requirement
text now demands the register property, REQ-PRM-01, instead. Four primitives added per
ruling 3.)

#### Scenarios REQ-CST-04.2.1–9 [red-proof]: Denied primitives, named

Shared shape: GIVEN a synthetic closure file referencing the primitive exactly as shown;
WHEN capability classification runs; THEN the build fails, stderr names the primitive
verbatim and states "Constraint 4".

| Scenario | Primitive | Fixture form |
|---|---|---|
| .1 | `eval` | `eval("1+1")` |
| .2 | `Function` (direct construction) | `new Function("return 1")()` |
| .3 | `node:vm` | `import { Script } from "node:vm"` |
| .4 | `Bun.plugin` | `Bun.plugin({ setup() {} })` |
| .5 | `process.binding` | `process.binding("fs")` |
| .6 | `node:child_process` — RULED-IN (ruling 3) | `import { spawn } from "node:child_process"` |
| .7 | `node:worker_threads` — RULED-IN (ruling 3) | `import { Worker } from "node:worker_threads"` |
| .8 | `WebAssembly` — RULED-IN (ruling 3) | `WebAssembly.instantiate(bytes)` |
| .9 | `module.register`/`registerHooks` — RULED-IN (ruling 3) | `module.register("./loader.js", import.meta.url)` |

### REQ-CST-04.3: Non-Vacuity, Re-Derived Under the Admission Mechanism

Given the current tree, the capability-admission scan MUST report zero violations, and the
anchored `single-instance-probe.ts` site MUST NOT be flagged. The non-vacuity guard MUST
count via AST identifier occurrences, never a substring count of the source text (R1-10).

(Previously: "the deny-scan reports zero violations" — worded against the retired
text-matching mechanism; non-vacuity was asserted by substring count. Updated to name the
admission mechanism and to require an AST-counted, not substring-counted, guard.)

#### Scenario REQ-CST-04.3.1: Non-vacuity on the real tree

- GIVEN the current runner closure
- WHEN capability-admission classification runs
- THEN it reports zero Constraint-4 violations, and the anchored `single-instance-probe.ts` site is not flagged

#### Scenario REQ-CST-04.3.2 [red-proof]: Non-vacuity guard counts by AST, not substring — R1-10

- GIVEN a mutant admission register that admits one extra, unauthorised primitive (widened by one entry)
- WHEN the non-vacuity guard counts violations via AST identifier occurrences
- THEN it fails, naming the widened register entry — a substring-only guard would have missed this because the widened entry never appears as denied text anywhere in the real tree

### REQ-CST-06.1: Failure Quality — Whole-Message Assertion

Every tripwire message MUST be asserted WHOLE, verbatim — never by substring — so "it
fails" is never accepted as "it fails usefully."

(Previously: "asserted by substring." Directly contradicted C6/whole-message assertions —
R2-3 shipped 4/5 false message lines under a green substring assertion. Updated per PM
finding, same unfreeze batch as ruling 1.)

#### Scenario REQ-CST-06.1.1: Every tripwire message is asserted whole

- GIVEN any tripwire violation fixture
- WHEN its test asserts the message
- THEN the ENTIRE message string is compared verbatim (never `toContain`/substring matching) — a message with 4 true lines and 1 false line cannot pass

#### Scenario REQ-CST-06.1.2 [red-proof]: A substring-passing, whole-message-failing message is caught — R2-3

- GIVEN the pre-fix version-validation diagnostic (reuses the `unreadable-file` rule body — 4 of 5 lines false for a version failure)
- WHEN the whole-message assertion runs against it
- THEN it fails — proving the substring assertion it replaces was itself the defect, not merely a weaker test of the same message

### REQ-RMD-05.1: No Username PATH SEGMENT

The manifest's bytes MUST contain neither `process.cwd()` nor `os.userInfo().username` as
a PATH SEGMENT, and the exact-key-set assertion (REQ-RME-01.3) structurally excludes a
timestamp field. `os.homedir()` remains deliberately NOT scanned (unchanged rationale: on
GitHub runners the checkout lives under `/home/runner`, so a homedir substring scan fires
on any legitimate relative path).

(Previously: "no username" as a bare substring scan — false as written, because CI's own
user is literally `runner`, which legitimately appears inside real closure paths such as
`dist/transport/runner.js`. Updated to scope the check to a path-segment boundary, per
ruling 7.)

#### Scenario REQ-RMD-05.1.1: No username path segment, distinguished from a legitimate substring

- GIVEN the manifest built under CI, where `os.userInfo().username === "runner"` — a substring that legitimately appears inside `dist/transport/runner.js`
- WHEN the manifest's bytes are scanned for the username
- THEN no bytes match the username bounded by path-segment delimiters (`/` or path start/end) — the scan does not false-positive on `runner.js`

#### Scenario REQ-RMD-05.1.2 [red-proof]: A genuine username path segment is caught

- GIVEN a mutant manifest containing a file record path like `dist/runner/notes.js` where `runner` is an actual path SEGMENT (not embedded in a longer identifier)
- WHEN the scan runs
- THEN it fails, naming the offending path

### REQ-RMD-01.2: Locale Independence — Structural, Not Behavioural

The generator's source (`scripts/generate-runner-manifest.ts` and its transitive helpers)
MUST NOT call any locale-sensitive API (`.localeCompare(`, `Intl.Collator`,
`.toLocaleUpperCase(`, `.toLocaleLowerCase(`). This is a structural, non-flaky proof that
generation cannot vary by locale.

(Previously: ran the generator in a child process under `LC_ALL=C` and again under
`LC_ALL=tr_TR.UTF-8`, asserting byte-identical output. Retired per ruling 7 — Bun's default
collator resolves `en-US` regardless of `LC_ALL`, so the scenario could never fail its own
mutation; it was satisfied-in-intent only. Updated to a source-scan the mutation below CAN
fail.)

#### Scenario REQ-RMD-01.2.1: No locale-sensitive API in the generator's source

- GIVEN `scripts/generate-runner-manifest.ts` and its transitive helper modules
- WHEN scanned for `.localeCompare(`, `Intl.Collator`, `.toLocaleUpperCase(`, `.toLocaleLowerCase(`
- THEN none are present

#### Scenario REQ-RMD-01.2.2 [red-proof]: A planted locale-sensitive call is caught

- GIVEN a mutant copy of the generator with one sort comparator changed to `.localeCompare()`
- WHEN the source scan runs
- THEN it fails, naming the file and line of the locale-sensitive call

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) | REQ-CAP-01..06, REQ-PRM-01, REQ-XPO-01, REQ-CST-04.2, REQ-CST-04.3 | Yes — sensitivity override fired at triage (SUBJECT test: the Constraint-4 guard IS the change's core subject) |
| deployment / build integrity | REQ-PTH-01, REQ-FCG-01, REQ-DGN-01, REQ-CST-06.1, REQ-RMD-05.1, REQ-RMD-01.2, REQ-DLV-01 | Yes — same override; build-tooling that gates the closure-sealing lemma |

## Open Items for Owner / Design

1. **REQ-CST-04.1's inline rationale sentence** ("*A call-vs-`.resolve()` rule is evaded
   by...*") documents the FIRST rejected mechanism, not the shipped exactly-one-unaliased-
   binding invariant. Ruling 1 confirms REQ-CST-04.1 itself survives unmodified — the
   sentence is rationale prose, not a normative obligation, and does not assert anything
   false about current behaviour. Recommend a tech-writer pass at archive to update the
   rationale sentence for accuracy; not a spec-level change.
2. **REQ-CST-04.4's synthetic-file scoping** is already textually correct ("a synthetic
   closure file") and does not contradict REQ-XPO-01.2's green namespace form on the REAL
   anchor file — no REQ change needed. Recommend `sdd-design` add an explicit code comment
   at the anchor site cross-referencing both REQs, so the distinction is not left implicit
   for the next reader (per the proposal's own watch-item framing).
3. **Register-disposition-completeness** (every one of the 23 pending-changes rows carries
   exactly one evidenced disposition; row-count delta fully explained) is a
   `pending-changes.md` document property, not a code-behaviour REQ — no Given/When/Then
   scenario can test it without theatre. Recommend this stays a PM/archive-gate mechanical
   check (as ruling 8 and the PM lens both already frame it), not a spec REQ.
4. **Fitness-function budget mapping** (owner-ratified ≤4): REQ-CAP-01 → FIT-CAP-TOTALITY;
   REQ-PTH-01 → FIT-PATH-SPELLING-INVARIANCE; REQ-FCG-01 → FIT-FAILCLOSED-BICONDITIONAL;
   REQ-CAP-06 → FIT-MANIFEST-BYTE-NEUTRAL. Every other REQ above is provable by unit/
   red-proof tests against `fit-42-*` and its fixture corpus — `sdd-design` should not
   introduce a fifth fitness function without a budget re-open.
5. **R1-16 (JSDoc identifiers scanned)** is not covered by a dedicated REQ above — explore
   flagged it as a hypothesis ("likely dissolved by the redesign") needing a red-proof, not
   a code change. Recommend `sdd-design`/`sdd-slice` add a scenario under REQ-CAP-01 or
   REQ-CAP-03 asserting `RCD-03.3`'s day-one JSDoc fixtures remain non-flagged under the
   NEW admission mechanism (not just under R2-1's narrower fix) — this is a red-proof-only
   closure, and this spec does not manufacture a REQ for a hypothesis still awaiting proof.
   **RESOLVED 2026-07-29 (plan-verify iteration-1, gap 7)**: `REQ-CAP-01.7` (added above)
   is that scenario — governed by exclusion E1, distinct from `REQ-CAP-01.2`'s widening
   red-proof. `S-001.4`'s E1 task cites `REQ-CAP-01.7`, not `REQ-CAP-01.2`.

## Plan-verify iteration-2 amendments (2026-07-29) — tallies

Closes gaps A and B of `verify-plan-2.md` (Judge A findings, `problem-fit` category).
Five scenarios added, all additive, zero existing REQ text modified: `REQ-CAP-04.6`,
`REQ-CAP-04.7` [red-proof], `REQ-CAP-04.8` [red-proof] (REQ-CAP-04 family: 5 → 8
scenarios, 2 → 4 red-proofs), `REQ-DGN-01.3`, `REQ-DGN-01.4` [red-proof] (REQ-DGN-01
family: 2 → 4 scenarios, 2 → 3 red-proofs). Baseline is the iteration-1 tally directly
below (22 REQ-IDs / 72 scenarios / 46 red-proofs). REQ-ID count is unaffected (both
families land under existing REQ-IDs); this change's overall spec tally moves to **22
REQ-IDs / 77 scenarios / 49 red-proofs**. `slices.md`'s coverage line, REQ-ID coverage
table, and `design.md`'s Test Derivation table + Coverage line are updated to match (see
those files' own amendment notes).

## Plan-verify iteration-1 amendments (2026-07-29) — tallies

Closes gaps 5, 6, 7 of `verify-plan-1.md` (Judge A findings, `problem-fit`/`scope`
categories). Five scenarios added, all additive, zero existing REQ text modified:
`REQ-CAP-01.4`, `REQ-CAP-01.5`, `REQ-CAP-01.6` [red-proof], `REQ-CAP-01.7` (REQ-CAP-01
family: 3 → 7 scenarios, 2 → 3 red-proofs), `REQ-PTH-01.7` [red-proof] (REQ-PTH-01
family: 7 → 8 scenarios, 5 → 6 red-proofs). Baseline is `slices.md`'s current tally
(22 REQ-IDs / 67 scenarios / 44 red-proofs — already includes the post-foresight CQ-1
amendment on REQ-CAP-04). REQ-ID count is unaffected (all five scenarios land under
existing REQ-IDs); this change's overall spec tally moves to **22 REQ-IDs / 72
scenarios / 46 red-proofs**. `slices.md`'s coverage line and REQ-ID coverage table are
updated to match (see that file's own amendment note).
