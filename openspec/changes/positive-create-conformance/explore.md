# Exploration: positive-create-conformance (positive-create-conformance)

**Triage**: M
**Persona lens**: none

## Cross-Change Lessons Consulted

- Discovery from change `conformance-corpus` (obs #768): pre-archive architecture audit CLEAN,
  `architecture_impact: additive` — this corpus is treated as an additive fixture-registry
  surface, not a `src/**` behavioural change. No dedicated `pattern`/`discovery` memory exists
  yet for "how to add a create-authoring case" specifically — the precedent instead lives
  entirely in the signed spec (`openspec/specs/conformance-fixtures/spec.md`, V4) and in
  `conformance/README.md`'s "How to add a fixture" section, both read directly below.
- No `project/lessons-learned` entries matched "conformance create" or "copy-copyin README
  sync" keywords — the copy/copyIn landing-sequence discipline lives only in the signed spec
  (REQ-CFX-17) and the archived change folder, not as a standalone lesson memory.

## Affected Flows

Affected Flows: not applicable — this change adds test-fixture declarations (manifest/factory/
expected bytes) and amends a spec + a fitness-test scan; it has no author-facing runtime
surface and no user-visible flow (the `force` documentation/typing drift the handoff also
flagged is explicitly OUT of scope, registered separately per triage).

## Current State

**REQ-CFX-02/02.1/03 today** (`openspec/specs/conformance-fixtures/spec.md:45-102`): REQ-CFX-02
mandates the representable set (`modify`/`delete`/`rename`/`move`/`copy`/`copyIn`) plus
**exactly one** case corpus-wide — `m2-create-composition`'s `wire-create-reject-twin` — that
may emit a wire `create`; "No other case may emit `create`." REQ-CFX-02.1's scenario literally
asserts "exactly one case ... emits `create`" across the manifest-derived corpus. REQ-CFX-03
requires the reject-probe's `create()` call be preceded by a 5-clause `DO-NOT-COPY` comment
(clauses a-e); clause (e) names the current representable set as "what to copy instead."
REQ-CFX-02/02.1/03 are cross-referenced by REQ-CFX-04 (outcome-triple consistency),
REQ-CFX-09 (the fixture's own behavioural contract), REQ-CFX-12 (`writtenPaths` pins),
REQ-CFX-13 (transcript oracle table), and REQ-CFX-17 (sync-site discipline) — confirmed by
direct read, matching triage's flagged cross-reference list.

**REQ-CFX-12 (writtenPaths, post `conformance-writtenpaths-reconcile`)**
(spec.md:356-401): every case's `outcome.writtenPaths` MUST list every workspace-relative path
touched by a *committed* mutation, deduplicated + sorted; a new positive create case MUST pin
its own `writtenPaths` value in this REQ's table (a genuinely new path, since a fresh `create()`
target that no other case touches has no dedup collision).

**Corpus mechanics** (`conformance/corpus.json`, `conformance/m2-create-composition/{manifest.json,factory.ts}`):
`corpus.json#fixtures` is a flat string array (7 ids today:
`m1-vehicle,m2-modify,m2-delete,m2-rename-move,m2-create-composition,m2-copy,m2-copyin`).
`m2-create-composition/factory.ts` exports a `default` function (the fixture's `positive` case:
`replaceContent("existing.txt","composed")`, composing with the engine's schematic-lowered
`generated.txt`) plus a named export `createRejectProbe` (the `wire-create-reject-twin` case),
selected via `manifest.json`'s **per-case `factory` override** (`{"module":"factory.ts",
"export":"createRejectProbe"}`, ADR-0065 mechanism — 6 established uses across the corpus per
triage). `createRejectProbe` calls the SAME public `create()` verb every other factory would use
(`import { replaceContent, create } from "../../src/index.ts"` — factory.ts:6), with
`{template:"unrepresentable", options:{}}` and **no `force`**. `encodeOptions`
(`src/core/directive-factory.ts:126-136`) JSON-stringifies any top-level array/plain-object
option value and passes scalars through verbatim (REQ-TOE-01) — the existing reject probe's
`options:{}` exercises neither branch; the handoff's "composite options exercising `encodeOptions`
preferred" instruction (obs #1695) is unmet by any case in the corpus today.

**fit-40 today** (`test/fitness/fit-40-conformance-corpus-integrity.test.ts:232-318`,
`test/support/conformance-validators.ts:207-247`): two layered checks guard REQ-CFX-02/03.
(1) A **file-level** scan (fit-40.test.ts:236-274) collects every factory file (fixture-level +
every case-level override) whose stripped source matches `/\bcreate\s*\(/`, and fails any file
other than the hardcoded `SANCTIONED_SITE = "m2-create-composition/factory.ts"` (line 243) —
this is a single hardcoded **path string**, not a set. (2) `checkCreateQuarantine`
(conformance-validators.ts:207-247) is **already generalized per named-export block, per
module** — VERIFIED, matching triage's claim: it builds `moduleToNamedExports` from every
case's `factory.export`, then for each distinct module counts `create()` calls both
corpus-wide and inside every case-referenced named-export's function block, failing only if
some `create()` call falls OUTSIDE all quarantined blocks. Adding a **second named export**
authoring `create()` in the SAME file, referenced by a NEW case's `factory.export`, requires
**zero code change** to either check — (1) still sees only the one sanctioned file, (2) already
sums across multiple named-export blocks. A **new fixture id with its own file** would fail
check (1) immediately (a second file path), requiring `SANCTIONED_SITE` to become an allow-list.

**Precedent — `copy-copyin-conformance-fixtures` (archived 2026-07-22)**: introduced TWO new
representable ops as two NEW fixture ids (`m2-copy`, `m2-copyin`), which is why it needed
README fixture-count sync-site discipline; REQ-CFX-17 (spec.md:665-713) generalizes that
discipline for widening the *representable-ops set* (three concrete sync sites: (a)
`conformance/README.md`'s representable-ops sentence, (b) the DO-NOT-COPY clause (e) text, (c)
fit-40's clause-(e) regex, verified still a loose prefix match at
fit-40.test.ts:300-306/CLAUSE_KEYWORDS `"(e)": /move\/copy\/copyIn/`) plus commit-atomicity
sequencing for the branch-held op (`copyIn`). This change does NOT widen the representable-ops
set — REQ-CFX-17 does not apply verbatim — but the SAME discipline pattern (every enforceable
site updated in the SAME commit) applies to whatever prose/regex enumerates create-authoring
**cardinality** instead of the op list.

**`conformance/README.md:30-32`** (a genuine sync site, unlisted by REQ-CFX-17 since that REQ
scopes only the op list): "A wire `create` appears exactly once in the whole corpus ... Do not
add a second create site." This sentence is worded in terms of "site," which happens to still
be literally true under the Approach-A shape below (one file, two create-authoring cases) but
needs rewording regardless — a future reader must not read "twice" as a violation once a second
CASE (not site) exists.

**Pending-changes row (`openspec/pending-changes.md:500`)**: "Create total-count==1 +
`session.buffer` raw `{op:'create'}` shape scan — widen the exactly-one-create invariant beyond
the named-export heuristic," tagged **next fit-40 touch**. This change touches fit-40's
create-cardinality area but does NOT close this row: the row's two asks are (a) a *raw*
`session.buffer({op:"create",...})` bypass scan (a DIFFERENT authoring path than the public
`create()` verb — no case in this change goes through `session.buffer` directly) and (b)
widening the invariant model itself. This change's Approach A keeps the invariant "one
sanctioned FILE" intact (no code widening needed) — so the row stays fully OPEN; it is
NOT the trigger this change resolves, contrary to triage's tentative read. Flagged as an
Open Question below (design must decide whether to also close it now or leave it for a later
fit-40 touch).

**Engine-behavioural discovery (verified by reading ADR-0064 + `src/commons/index.ts:187-204` +
`src/core/directive-factory.ts:126-149`, not previously surfaced in triage)**: ADR-0064 froze
`wire-create-reject-twin`'s outcome to `(2, "unrepresentable", null)` because the **pre-landing**
engine rejects **every** wire `create` unconditionally, regardless of `force`. The engine
handoff (obs #1695) states the **post-`sdk-wire-create`** engine makes `create` generally
ingestible and rejects the WHOLE BATCH only when a `force` field is present. The existing
`createRejectProbe` (factory.ts:21-23) calls `create(path, {template, options:{}})` with `force`
omitted — `forceEntry(undefined)` (`src/core/directive-factory.ts:47-49`) emits no `force` key
at all. Once the engine's pin advances past `sdk-wire-create`, THIS EXACT CALL would no longer
be rejected (no force, no stated collision) — it would exit 0, silently invalidating the
existing reject-twin's declared outcome. Nothing in the local repo (spec, ADR-0064, or the
handoff memory) currently states that the probe's factory needs a `force:true` addition to stay
a valid rejection under the new engine semantics. This is a genuine, previously-unflagged design
input, not a triage-scope item to silently work around.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| conformance/ authoring corpus (fixture registry) | extend | new case + named export inside `m2-create-composition` (or new fixture, per approach) | aligns |
| openspec/specs/conformance-fixtures/spec.md (delta spec) | modify | REQ-CFX-02/02.1/03 cardinality relaxation + REQ-CFX-12 pin addition | aligns |
| test/fitness/fit-40-conformance-corpus-integrity.test.ts + test/support/conformance-validators.ts | modify (Approach A: test file prose/comment-keyword only) or extend (Approach B: SANCTIONED_SITE set) | admit the new positive create site | aligns |
| src/** (production authoring surface) | none | no runtime code change — `create()`/`encodeOptions`/`forceEntry` already support what a new positive fixture needs | aligns |

No `deviates` rows — this stays entirely inside the conformance-authoring layer the project
architecture baseline already treats as additive (per obs #768's CLEAN audit for the sibling
`conformance-corpus` change).

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `openspec/specs/conformance-fixtures/spec.md` | Modify | REQ-CFX-02/02.1/03 cardinality relaxation; REQ-CFX-09/12/13 pin additions for the new case |
| `conformance/m2-create-composition/manifest.json` | Modify | new case entry (outcome + transcript objects, REQ-CFX-04/13) |
| `conformance/m2-create-composition/factory.ts` | Modify | new named export authoring a positive `create()` call, composite (`encodeOptions`-exercising) options |
| `conformance/m2-create-composition/expected/` (or a new `expected-*` sibling dir, `m2-copy`/`m2-copyin` naming precedent) | Create | byte-exact rendered output for the new case |
| `conformance/README.md:30-32` | Modify | reword the "create appears exactly once" sentence (sync site, not covered by REQ-CFX-17) |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts:284-317` | Modify | DO-NOT-COPY clause-(e) `CLAUSE_KEYWORDS` regex stays valid only if clause (e)'s wording doesn't drift; add a `REQ-CFX-09`-style behavioural-contract `describe` block for the new case |
| `test/support/conformance-validators.ts` | Read-only | confirmed `checkCreateQuarantine` (line 207) needs no change under Approach A |
| `conformance/corpus.json` | Read-only (Approach A) / Modify (Approach B) | Approach A adds no new fixture id |
| `openspec/pending-changes.md:500` | Read-only | confirmed this row stays open, not closed by this change (see Current State) |

## Sensitive Areas Crosscheck

No sensitive areas touched. `conformance/` is absent from `openspec/sensitive-areas.md` (only
`./conformance`, the PUBLISHED package export at `package.json#exports`, appears there —
`openspec/sensitive-areas.md:17` — an unrelated same-named neighbour per the corpus README's own
disambiguation). No `src/transport/**`/`src/core/**` production code changes.

## Approaches

### 1. New case + second named export inside `m2-create-composition` (recommended)

**Description**: Add a new case (e.g. `wire-create-positive`, name TBD by design) to
`conformance/m2-create-composition/manifest.json`, referencing a new named export in the SAME
`factory.ts` (e.g. `createPositiveProbe`) that authors a plain, composite-options `create()` call
with no `force`. The fixture id, `corpus.json`, and the file-level `SANCTIONED_SITE` scan are
untouched.

**Pros**: Zero code change to `checkCreateQuarantine` (already generalizes per named-export
block) or the file-level scan (still one sanctioned file); no new fixture id, so no
`corpus.json`/derived-count sync site; matches the ADR-0065 per-case-factory-override pattern
already used 6x; smallest, most mechanical diff; the `create` cardinality stays "one file may
author it" rather than widening to "N files may."

**Cons**: `conformance/README.md`'s "site"-worded sentence still needs rewording (unavoidable
under either approach); the fixture's own naming convention ("<behaviour>Probe" / "<behaviour>-
twin") was designed for NEGATIVE twins, not a second POSITIVE case sharing a fixture id with an
unrelated composition-positive case — design must pick a case/export name that doesn't imply
"twin."

**Effort**: Low.
**Pattern fit**: matches existing `conformance/m2-create-composition/manifest.json` (ADR-0065
mechanism).

### 2. New fixture id with its own module (`corpus.json` + new directory)

**Description**: Register a new id in `corpus.json#fixtures`, its own `manifest.json`/
`factory.ts`, authoring the positive `create()` there.

**Pros**: Cleaner semantic separation if the new fixture's `class` (e.g. plain `wire-mutation`
rather than `composition`) fits a genuinely-new positive create case better than piggybacking on
`m2-create-composition`'s existing schematic-composition semantics.

**Cons**: `SANCTIONED_SITE` (fit-40.test.ts:243) is a single hardcoded string — this approach
requires widening it to an allow-list/set, a real fit-40 code change (not just prose); adds a
new fixture id, triggering `corpus.json` + `conformance/README.md`'s "Do not add a second create
site" sentence to go from misleading-but-technically-true to directly contradicted; larger diff
for no behavioural gain the handoff requires.

**Effort**: Medium.
**Pattern fit**: new pattern (first corpus fixture with its own file authoring `create()`
outside the sanctioned probe file).

## Recommendation

**Approach 1** — new case + second named export inside `m2-create-composition`. It satisfies
every handoff deliverable (positive fixture, `encodeOptions`-exercising composite options,
byte-exact `expected/`, fit-40 green) with zero change to the two structural invariant checks
that actually enforce "create is quarantined," reuses the established ADR-0065 mechanism, and
avoids widening `corpus.json`/README sync-site surface Approach 2 would newly create. Approach 2
would only be justified if design decides the new case's semantics (`class`, seed shape) are
incompatible with `m2-create-composition`'s existing composition contract — nothing read here
suggests that.

## Risks

- **`wire-create-reject-twin` may go stale once the engine's `sdk-wire-create` change lands**:
  its factory currently omits `force`, so once the engine treats plain `create` as representable,
  this probe would exit 0 instead of the pinned `(2, "unrepresentable", null)` — ADR-0064's
  triple assumed the OLD "always-unrepresentable" engine behaviour. Mitigation: design should
  decide whether to add `force: true` to `createRejectProbe` in THIS change (keeps ADR-0064's
  triple valid under new semantics, per the handoff's "any force field ... rejects the whole
  batch") — flagged as an open question, not resolved here.
- **Case/export naming has no established convention for a second positive case**: the
  README's `<behaviour>Probe`/`<behaviour>-twin` convention is twin-specific; picking a
  misleading name (e.g. implying a rejection) would confuse future fixture authors.
- **`expected/` directory collision**: `m2-create-composition`'s existing `expected/` already
  serves the composition-positive case; the new case needs either a sibling `expected-*` dir
  (the `m2-copy`/`m2-copyin` precedent: `expected-force`, `expected-modify`) or careful review
  that reusing `expected/` doesn't conflate the two cases' declared bytes.
- **Pending-changes row 500 stays open**: confirmed this change does not close it (see Current
  State) — design/slice should NOT claim it as resolved in the archive step.

## Open Questions

- type: technical
  question: "Does `wire-create-reject-twin`'s factory need a `force: true` addition (and
  REQ-CFX-09/ADR-0064/the DO-NOT-COPY comment's rationale text updated to cite force, not
  'create is inherently unrepresentable') to remain a valid rejection once the engine's
  `sdk-wire-create` change lands, given the engine handoff states plain creates become
  representable and only a `force` field triggers whole-batch rejection?"
  why_it_matters: "If unresolved, the corpus would ship internally consistent but declare an
  outcome for the reject-twin that the real (post-landing) engine will contradict — the exact
  kind of drift REQ-CFX-11's honesty boundary exists to prevent. This is a scope-affecting
  finding no prior artefact (triage, handoff, ADR-0064) states explicitly."
- type: technical
  question: "What case name and named-export name does design pick for the new positive-create
  case, given the corpus's only naming convention (`<behaviour>Probe`/`<behaviour>-twin`) is
  twin-specific and this is a second POSITIVE case, not a twin?"
  why_it_matters: "A name implying rejection (e.g. anything ending `-twin`) would mislead future
  fixture authors reading `conformance/README.md`'s authoring convention."
- type: technical
  question: "Does the new case reuse `m2-create-composition/expected/` or need its own sibling
  `expected-*` directory (mirroring `m2-copy`'s `expected-force`/`m2-copy`'s `expected-modify`
  precedent)?"
  why_it_matters: "Reusing `expected/` incorrectly would conflate the existing composition-
  positive case's declared bytes with the new case's, silently breaking REQ-CFX-09.1's existing
  assertions."
- type: product
  question: "Should pending-changes row `openspec/pending-changes.md:500` (raw `session.buffer`
  create-shape scan + widening the invariant model) be folded into this change's slice, or
  stay explicitly deferred as its own future fit-40 touch?"
  why_it_matters: "Triage's risk note read this change as 'plausibly' the trigger for that row;
  this exploration found Approach A does NOT require widening the invariant, so leaving it open
  is a legitimate choice but needs an explicit owner decision, not a silent drop."

## Ready for Proposal

**Status**: yes
**Halt routing**: n/a
**Reason**: The dominant pattern (ADR-0065 case-level factory override) directly fits the
handoff's requirement, fit-40's two structural checks already support it without code change,
and no sensitive area or architectural conflict was found. The one genuine scope-affecting
discovery (reject-twin staleness under new engine semantics) is surfaced as a technical open
question for `sdd-design` to resolve via ADR, not a blocker to proposing.
**Recommended action**: Proceed to `sdd-propose` (merged mode per M-light pipeline). Surface
the `wire-create-reject-twin` force-staleness question to the user/design explicitly before
freezing the new case's manifest — it may add one small factory edit (`force: true`) to the
change's slice scope beyond triage's original file-count estimate.
