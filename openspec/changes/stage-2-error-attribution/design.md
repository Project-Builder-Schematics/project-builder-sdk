# Design: stage-2-error-attribution

**Spec**: V2 (signed, owner, 2026-07-05) · **Triage**: L · **Persona lens**: synthesis
**Architecture impact**: **modifying**
**Revision**: 3 — plan-verify iteration 2, one surgical amendment: §4.3 pins the per-verb
`primaryPath` attribution convention (author-declared source-side path, BOTH failure forms) that
rev 2 named but never defined; §4.4 and the REQ-14.2 derivation row cross-reference it. Nothing
else changed. (Rev 2 — council iteration, architect + tech-writer, blind: 1 blocker (FIT-06 gate on
the four public type aliases), 5 majors (message-template discriminant by reason; 2.3 droppability
leak; slice ordering of the `./commons` export; `originFor` exhaustiveness enforcement; union-growth
enforcement model), 8 minors folded in. Rev-1 approach unchanged; contracts tightened.)

## 4.1 Architecture Overview

Stage 2 freezes the author-facing error contract by threading structured metadata through the
one existing seam (SEAM-04, `Session.flush` → `authoring-error.ts`) — no new layer, no port
signature change (explore Approach 2). Three moves:

1. **Port-internal metadata (`EmitRejection`)** — a new `src/core/emit-rejection.ts` defines an
   `Error` subclass carrying `{ code, failedIndex?, appliedCount }`. The `ContractFake` (normative
   engine counterpart) throws it at each existing `RAW-UNTIL-STAGE-2.1` site with its `code` set
   locally; message text (built from a shared fragments module, see FIT-11) stays only in `.message`.
   Never crosses to `./commons` (ADR-0022, FIT-10 extended); deliberately NOT added to the
   `src/core/index.ts` kit barrel (ADR-0022).
2. **Translation (`toAuthoringError`)** — rewritten to read `failedIndex` off the rejection, index
   the *actual* offender out of the batch (killing the `instructions[0]` hardcode), map `code→reason`
   (never message text), derive `origin` via an exhaustive `originFor(reason)` switch, carry
   `appliedCount`, and build one of three frozen messages selected BY REASON. Malformed rejections
   degrade to `reason:"unknown"` without crashing.
3. **Public promotion** — `AuthoringError` grows `reason`/`origin`/`appliedCount` (verb `delete`→
   `remove`), and is re-exported from `./commons` using the SAME two-step `import{…};export{…}`
   pattern `FoundHandle`/`WritableHandle` already use (author-facing DATA types cross the ADR-0009
   boundary; kit MACHINERY does not). FIT-06 requires defining-site `@example` JSDoc on every
   exported alias — these land in the same slice as the export.

The one SDK-origin proof case: `currentContext()`'s misuse throw becomes an
`AuthoringError{origin:"authoring-rejected", reason:"outside-run"}`; its message prose moves INTO the
`AuthoringError` constructor as the third template (substring pin preserved). The `context.ts`
double-fault (E1/E2) machinery is untouched (REQ-16 non-site). A separable, droppable final slice
adds `classifyContent` in commons (2.3, CQ-1) — no other component, test, or doc pointer outside
that slice references it.

## 4.2 File Changes (contract with sdd-slice)

| Path | Action | Purpose |
|---|---|---|
| `src/core/emit-rejection.ts` | Create | `EmitRejection extends Error` + `EmitRejectionCode` closed set (port-internal, ADR-0022) |
| `src/core/authoring-error.ts` | Modify | new shape (`reason`/`origin`/`appliedCount`, `verb\|undefined`/`path\|undefined`); `delete`→`remove` verb-map; `code→reason` map; exhaustive `originFor(reason)` with `never` default arm; 3-template message selected by reason; non-`EmitRejection` degradation. JSDoc obligations: class `@example` (try/catch + instanceof + switch(reason), REQ-AEC-04.3); defining-site `@example` on `AuthoringVerb` (reading `err.verb`), `AuthoringReason` (switch(reason) reaching an arm), `AuthoringOrigin` (branching on origin) — FIT-06; `appliedCount` JSDoc: "counts directives applied within the failing flush before the offender — a diagnostic for locating progress, NOT a persistence promise (a rejected run discards everything, ADR-0015)" (REQ-AEC-03.2). Module header refreshed to describe the metadata-driven code→reason translation, three-template message, and degradation |
| `src/core/session.ts` | Modify | `flush` catch passes the whole `batch` (not `instructions[0]`) to `toAuthoringError`; update SEAM-04 comment |
| `src/core/context.ts` | Modify | `currentContext()` throws `AuthoringError{outside-run}` not plain `Error`; the prose moves to the constructor's outside-run template (substring preserved). Double-fault block UNTOUCHED |
| `src/core/engine-client.ts` | Modify (docs) | document the `EmitRejection` rejection convention at the `emit` seam; signature unchanged; Stage-6 revisit note |
| `src/core/index.ts` | Read-only | deliberately UNCHANGED — `EmitRejection` stays OUT of the kit barrel (see ADR-0022): port-internal, FIT-10-guarded, consumed only by `authoring-error.ts` in-core and the allow-listed fake via direct import. A recorded deviation from the architecture.md "new core primitive → re-exported from `src/core/index.ts`" convention |
| `src/commons/index.ts` | Modify | TWO re-export clusters: (non-droppable) two-step re-export `AuthoringError` + `AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin`, plus the 5 rejecting verbs' JSDoc cross-refs (REQ-AEC-04.4); (droppable, S6 only) re-export `classifyContent`/`ContentState` + `find()` JSDoc pointer to the helper (REQ-RT-03.2) |
| `src/commons/classify-content.ts` | Create | `classifyContent` + `ContentState` (2.3, droppable). JSDoc obligations: `classifyContent` `@example` = read-and-branch switch over the three cases (REQ-RT-03.1); defining-site `@example` on `ContentState` (trichotomy switch, shareable with the former) — FIT-06 |
| `test/support/rejection-messages.ts` | Create | exported message-fragment constants (`"ContractFake:"`, `"already exists"`, `"use force to overwrite"`, `"not found"`, `"exceeds size cap"`, `"round-trip fidelity check"`, `"JSON serialization"`) — single source shared by the fake's throw sites and FIT-11's dictionary |
| `test/support/contract-fake.ts` | Modify | 8 directive-level throws → `EmitRejection(code, msg, {failedIndex:i, appliedCount:i})` (index passed into `#apply`); 3 batch-level throws → `EmitRejection(code, msg)` (`appliedCount:0`). Messages composed from `rejection-messages.ts` fragments (text unchanged). Rejection semantics identical; only the metadata channel added |
| `test/fake/emit-rejection.test.ts` | Create | REQ-ERM-01.1/.2/.3 (code+failedIndex; batch-level no failedIndex; code-not-text via decoy double) |
| `test/skeleton/authoring-error.test.ts` | Create | translation unit: REQ-AEC-01.*, -02.2, -03.1, -06.*, REQ-ERM-03.*, REQ-10.1/.2 verb-map |
| `test/skeleton/error-attribution.test.ts` | Modify | REPLACE per Pin table: REQ-12.*, REQ-14.*, REQ-15.*, REQ-AEC-02.3 contrast, REQ-AEC-04.1 (real cross-boundary runs); drop dead `"OpMove"`/message-stack scans (→ FIT-11). REQ-11/13 unchanged rows kept |
| `test/skeleton/context.test.ts` | Modify | add `instanceof AuthoringError` + `origin`/`reason` assertion beside the preserved `:12` substring pin (REQ-AEC-02.1) |
| `test/fake/batch-cap.test.ts` | Modify | `:67` pin rewritten: `reason:"changes-too-large"`, `verb`/`path` `undefined`, `appliedCount:0`, batch-level message (REQ-14.3) |
| `test/e2e/error-attribution.e2e.test.ts` | Create | REQ-17.1 author catches, reads all fields, `switch(reason)` reaches `path-collision` arm; `appliedCount:2` |
| `test/skeleton/classify-content.test.ts` | Create | REQ-RT-01.1–.3, REQ-RT-02.*, REQ-RT-03.1/.2 (droppable with S6) |
| `test/types/content-state.test.ts` | Create | REQ-RT-01.4 exhaustive-switch (`never` arm compiles) — droppable with S6 |
| `test/types/authoring-reason.test.ts` | Create | non-droppable exhaustiveness pins: `switch(reason)`/`switch(origin)` with `never` default arms compile — the type-level half of the ADR-0021 `originFor` mechanism |
| `test/skeleton/doc-discoverability.test.ts` | Create | REQ-AEC-03.2, REQ-AEC-04.3/.4, REQ-16.1 (JSDoc/doc substring scans) — non-droppable; REQ-RT-03 lives in `classify-content.test.ts` instead (droppability split) |
| `test/fitness/fit-11-whole-object-leak-scan.test.ts` | Create | REQ-AEC-05.1–.4 (runtime object-graph scan + 3 planted red-proofs); dictionary imported from `rejection-messages.ts` |
| `test/fitness/fit-10-engine-client-port-guard.test.ts` | Modify | extend port pattern to `\bEmitRejection\b` (REQ-ERM-02) |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modify | add characterization pin: `AuthoringError`/`AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin` are NOT in `KIT_SYMBOL_NAMES` (author data types, ADR-0023 crossing) — mirrors the FoundHandle/WritableHandle pin |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Read-only | no change needed — its two-step re-export resolution automatically covers the new exports; goes green via the defining-site `@example`s above |
| `test/fitness/dts-baseline/commons.index.d.ts` | Modify | regen — new exports (REQ-AEC-04.2 additive) |
| `test/fitness/dts-baseline/index.d.ts` | Modify | regen — umbrella `export *` propagates the new exports |
| `openspec/decisions/0020..0023-*.md` | Create | 4 ADRs below (materialized at archive) |
| `openspec/pending-changes.md` | Modify | close/re-defer the 4 Stage-2.1 rows per spec disposition (archive-time) |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author catches a rejected run, reads `reason`/`origin`/`verb`/`path`/`appliedCount`, and branches on `reason` — collision after 2 applied directives | Create | REQ-17.1, REQ-14.1, REQ-15 | `test/e2e/error-attribution.e2e.test.ts` (new) | first rejection-path e2e; subsumes the mid-chain applied-boundary read |

Per-family attribution (REQ-14.2), origin contrast (REQ-AEC-02.3), and multi-flush discard
(REQ-15) are failure/edge responses verified at **integration** (`test/skeleton`, `test/fake`),
not separate e2e author journeys — mirroring the stage-1 seam-behavior precedent.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/emit-rejection.ts` (port-internal type) | new | structured rejection joins the existing core layer behind the seam; deliberately outside the kit barrel (ADR-0022) | aligns |
| `core/authoring-error.ts` (SEAM-04) | modify | new shape + metadata-driven translation + degradation | aligns |
| `core/session.ts` (`flush`) | modify | attribute the actual offender via `failedIndex` | aligns |
| `core/context.ts` (`currentContext`) | modify | misuse throw becomes an `AuthoringError` (2.4 proof) | aligns |
| `core/engine-client.ts` (port) | modify (docs) | document rejection convention; signature unchanged | aligns |
| `commons/index.ts` (author surface) | modify | re-export `AuthoringError` (author DATA type) + `classifyContent` | aligns — follows the `FoundHandle`/`WritableHandle` core→commons precedent (ADR-0023) |
| fitness layer | new/modify | FIT-11 joins `test/fitness`; FIT-10 extends to `EmitRejection`; FIT-08 gains a characterization pin; FIT-06 covers the new exports unchanged | aligns |

No `deviates` rows: kit machinery (`EngineClient`, `Session`, `DirectiveFactory`) stays unexported;
only author-facing data types cross, as the handle types already do. ADR-0023 records the crossing
as a substantive public-surface decision (aligns rows may carry ADRs). Impact derivation: the
`modify` rows change established SEAM-04 behavior and the `AuthoringError` shape the baseline
documents (line 56) → **modifying** (see 4.10).

## 4.3 Data Model

```ts
// src/core/emit-rejection.ts (port-internal — never in ./commons, never in the kit barrel)
export type EmitRejectionCode = "collision" | "not-found" | "unrepresentable" | "cap";
export class EmitRejection extends Error {
  readonly code: EmitRejectionCode;
  readonly failedIndex?: number;   // directive-level only
  readonly appliedCount: number;   // === failedIndex (directive-level) | 0 (batch-level)
  constructor(code: EmitRejectionCode, message: string, pos?: { failedIndex: number; appliedCount: number });
}

// src/core/authoring-error.ts (public via ./commons)
export type AuthoringVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy";
export type AuthoringReason =
  | "path-collision" | "path-not-found" | "unrepresentable-content"
  | "changes-too-large" | "outside-run" | "unknown";
export type AuthoringOrigin = "write-rejected" | "authoring-rejected";
export class AuthoringError extends Error {
  readonly verb: AuthoringVerb | undefined;   // .d.ts-frozen `| undefined` (REQ-AEC-04)
  readonly path: string | undefined;
  readonly reason: AuthoringReason;
  readonly origin: AuthoringOrigin;            // DERIVED via originFor(reason) (ADR-0021)
  readonly appliedCount: number;
  constructor(f: { verb: AuthoringVerb | undefined; path: string | undefined; reason: AuthoringReason; appliedCount: number });
}
// internal: originFor(reason: AuthoringReason): AuthoringOrigin — EXHAUSTIVE switch with a
// `never` default arm: adding a 7th reason breaks the BUILD here, forcing an explicit origin
// assignment (ADR-0021 mechanism). Mirrored by the test/types/authoring-reason.test.ts pin.

// src/commons/classify-content.ts (droppable, 2.3)
export type ContentState = "absent" | "empty" | "present";
export function classifyContent(read: string | undefined): ContentState;
```

`toAuthoringError(raw, batch)` (signature widens from `(_raw, directive)`): `raw instanceof
EmitRejection` → `code→reason`; `failedIndex` present + in range → offender directive → `verbFor(op)`
(`delete`→`remove`, else identity) + `primaryPath`; else `verb/path undefined`. Any other rejection
(string/number/`undefined`/metadata-less `Error`) → `reason:"unknown"`, `appliedCount:0`. `origin`
and the message are computed in the constructor.

**`primaryPath` attribution convention (per verb, frozen)** — pins the EXISTING total table at
`src/core/authoring-error.ts:26`, unchanged; it applies to BOTH failure forms of every verb
(collision AND source-not-found). The attributed `path` is always the AUTHOR-DECLARED source-side
path — `path` is a locator ("which of my calls failed"), `reason` carries the why; surfacing the
computed destination was D2 option (c), owner-rejected. The verb reported alongside is the AUTHOR
verb after the wire `delete`→`remove` map.

| Wire op | Attributed `path` | Author-side meaning |
|---|---|---|
| `create` | `create.pathTemplate` | the path the author asked to create |
| `modify` | `modify.path` | the path the author asked to modify |
| `delete` | `delete.path` | the path passed to `remove()` (non-site — never rejects) |
| `rename` | `rename.path` | the SOURCE path, not the computed `dirname(path)/newName` destination |
| `move` | `move.path` | the SOURCE path, not the computed `toDir/basename` destination |
| `copy` | `copy.from` | the SOURCE path, not the `to` destination |

Worked multi-path example: `copy("a.ts", "b.ts")` collides at destination `b.ts` → `verb: "copy"`,
`path: "a.ts"`, `reason: "path-collision"`, message `copy failed at a.ts: path-collision`. This
string feeds the frozen directive-level template (REQ-AEC-06.1, §4.4) and the six exact `toEqual`
assertions of REQ-14.2's rename/copy/move collision + not-found cases.

## 4.4 Interface Contracts

Public (`@pbuilder/sdk/commons`, additive per FIT-04): class `AuthoringError` (+ `instanceof` across
the `defineFactory` boundary), types `AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin`,
`classifyContent`, `ContentState`.

**Message contract (REQ-AEC-06)** — templates owned by the `AuthoringError` constructor, selected
**by `reason`, three-way — NEVER by verb/path presence** (`outside-run` also has `verb`/`path`
`undefined` but must NOT get the batch template, or the `context.test.ts:12` substring pin breaks):

- `{path-collision, path-not-found}` → `` `${verb} failed at ${path}: ${reason}` `` — `path` per the
  frozen per-verb `primaryPath` table in §4.3 (always the author-declared source-side path)
- `{unrepresentable-content, changes-too-large, unknown}` → `` `changes could not be applied: ${reason}` ``;
  `unknown` appends `" — the SDK could not classify this failure"`; never interpolates `undefined`
- `outside-run` → the verbatim prose currently thrown by `currentContext()` ("…can only be used while
  a schematic is running…"), which MOVES INTO the constructor as the third template

Port-internal `EmitRejection` — `EngineClient.emit(): Promise<void>` unchanged; a real engine
(Stage 6) must honor the same rejection convention (ADR-0022 revisit). **Re-export form**: two-step
(`import { AuthoringError } … ; export { AuthoringError };`) — NOT `export … from "../core"` (which
FIT-08 flags); this matches `handle-state` today.

**Additivity argued out-of-band** (FIT-04 same-change-regen blindness, stage-1 lesson): all six new
exports (`AuthoringError`, three aliases, `classifyContent`, `ContentState`) are net-new symbols; no
existing `./commons` export is removed, renamed, or narrowed — the `.d.ts` delta is additive by
construction, independent of the gate.

## 4.5 Architecture Decisions (ADRs)

### ADR-0020: Closed `reason` enum (★D2)
**Status**: Proposed. **Context**: A rejected author needs a structured, debuggable cause, but the
no-engine-text guarantee (FIT-11) covers the WHOLE error object — a free-text cause would leak engine
vocabulary. **Decision — option (b), owner-ratified**: `AuthoringError.reason` is a closed SDK-owned
union of exactly six author-vocabulary values; classification is `EmitRejectionCode → reason` only,
never message parsing; `unrepresentable-content` fuses the stringify-throw and round-trip-drop
families (one author fix). **Consequences**: (+) debuggable + leak-proof; (+) `switch(reason)`
recovery. (−) coarser than raw engine text (FIT-11 keeps the leaking alternative off the table).
(−) **adding a 7th value is MAJOR, not additive** — authors write exhaustive switches and TS breaks
them on a new member even though runtime doesn't; enforcement model in §4.7. **Alternatives**:
(a) free-text `_raw` cause — rejected: leaks engine text, defeats the guarantee this stage protects;
(c) error subclass per family — rejected: subclass explosion, no exhaustiveness gain over a
discriminant; (d) numeric codes — rejected: opaque, un-greppable, needs a lookup table authors
won't have.

### ADR-0021: Error-origin taxonomy (2.4)
**Status**: Proposed. **Context**: Authors must distinguish an engine-refused write from an SDK-side
misuse, but the SDK-origin dialect family (Stage 5, ADR-0012) does not exist yet. **Decision**:
`origin` is a closed 2-value union DERIVED from `reason` via `originFor(reason)` — an **exhaustive
switch with a `never` default arm**, plus a `test/types/authoring-reason.test.ts` exhaustiveness pin:
adding a reason breaks the build at the switch AND the type pin, forcing a deliberate origin
assignment — "Stage 5 adds producers, not a rename" holds by construction, not hope. Derivation also
makes REQ-AEC-02's invariants unfalsifiable by a producer. Mapping: `outside-run →
"authoring-rejected"`, all others incl. `unknown → "write-rejected"`. Birth sites: SEAM-04 `catch` →
always `write-rejected`; `currentContext()` throw → `authoring-rejected`. `unknown → write-rejected`
is deliberate: an unclassifiable rejection necessarily arrived through the emit/write seam (the only
place `toAuthoringError` runs). The dialect family is a RESERVED slot under `authoring-rejected`,
unimplemented/untested in v1. **Consequences**: (+) provable now against one concrete case; (+) frozen
field — Stage 5 adds producers. (−) v1 exercises only one `authoring-rejected` producer; (−) a new
reason later touches `originFor()` (a MAJOR change, per ADR-0020). **Alternatives**: subclass
hierarchy — rejected: heavier than a discriminant, no author benefit; engine-origin only — rejected:
leaves 2.4 unprovable and the misuse throw a plain `Error`.

### ADR-0022: `EmitRejection` port contract
**Status**: Proposed. **Context**: Attribution needs to know WHICH directive failed and how many
applied, without changing `emit(): Promise<void>` (Stage-1-frozen envelope, ADR-0018/0019).
**Decision**: the rejection object carries `{ code, failedIndex?, appliedCount }` with a closed
`EmitRejectionCode`; `code` is set at each throw site; directive-level carries
`failedIndex`+`appliedCount===failedIndex`, batch-level carries `appliedCount:0` and no `failedIndex`.
Port-internal to `src/core`; FIT-10 extends to the identifier; only `toAuthoringError` and the
allow-listed `contract-fake.ts` touch it. `EmitRejection` is deliberately NOT re-exported from the
`src/core/index.ts` kit barrel — it is not kit surface for dialect authors; direct-module-import-only
keeps FIT-10's guard meaningful. This is a recorded deviation from the "new core primitive → kit
barrel" convention (architecture.md Conventions). **Consequences**: (+) origin-agnostic, no message
parsing, satisfies mid-chain + applied-boundary; (+) envelope contracts untouched. (−) commits the
unbuilt real engine (Stage 6, ROADMAP §6) to this convention — flagged as a revisit; (−) `ContractFake`
gains metadata at every throw site. **Alternatives**: port-signature change (explore #1) — rejected:
unneeded weight, larger forward commitment; message-parsing (explore #3, ADR-0016 rejected twice) —
rejected: ties the SDK to fake wording, breaks for any real engine.

### ADR-0023: `AuthoringError` public promotion via `./commons`
**Status**: Proposed. **Context**: An author cannot `instanceof`-check or import `AuthoringError`
today (unexported) — it is not usable as a caught type. ADR-0009 keeps `core` behind the boundary.
**Decision**: re-export the `AuthoringError` class + its three supporting types from `./commons` via
the two-step `import/export` form `FoundHandle`/`WritableHandle` already use — author-facing DATA types
legitimately cross; kit MACHINERY (`EngineClient`/`Session`/`DirectiveFactory`) does not, which is
exactly what FIT-08's `KIT_SYMBOL_NAMES` encodes (a new characterization pin freezes the distinction).
The exported `.d.ts` freezes `verb: AuthoringVerb | undefined` and `path: string | undefined`; FIT-04
confirms additive; FIT-06 demands defining-site `@example`s on every exported alias. **Consequences**:
(+) `instanceof` + `switch(reason)` across the boundary; (+) precedent-consistent. (−) a new
semver-locked public surface (sensitive-areas `public-api`) — frozen here deliberately; (−) a future
one-step `export … from "../core"` would trip FIT-08 (a pre-existing FIT-08 limitation, not introduced
here). **Alternatives**: new `./errors` subpath — rejected: extra subpath for one type, `./commons` is
where authors already are; leave unexported — rejected: the type is uncatchable, the core problem.

## 4.6 Test Derivation

| REQ-ID | Scenario | Level | Test | RED posture |
|---|---|---|---|---|
| REQ-ERM-01.1 | directive-level → code+failedIndex+appliedCount | integration | `test/fake/emit-rejection.test.ts` | must-fail-first |
| REQ-ERM-01.2 | batch-level → code, no failedIndex, appliedCount 0 | integration | `test/fake/emit-rejection.test.ts` | must-fail-first |
| REQ-ERM-01.3 | classify by code, decoy "not found" message | integration | `test/fake/emit-rejection.test.ts` | must-fail-first |
| REQ-ERM-02.1 | port-guard allows only core + fake | architectural | `test/fitness/fit-10-*.test.ts` | permanent-fixture |
| REQ-ERM-03.1–.4 | string / metadata-less Error / `undefined` / `42` → unknown, no crash | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-01.1 | 8 directive-level families → exact collision/not-found reason | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-01.2 | no engine string as a reason value | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-01.3 | stringify-throw → unrepresentable-content | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-01.4 | round-trip-drop → unrepresentable-content | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-01.5 | cap → changes-too-large | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-02.1 | misuse throw is AuthoringError{authoring-rejected,outside-run} | integration | `test/skeleton/context.test.ts` | must-fail-first |
| REQ-AEC-02.2 | engine rejection always write-rejected | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-02.3 | two origins distinguishable in one test (contrast) | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-AEC-03.1 | appliedCount present + numeric | unit | `test/skeleton/authoring-error.test.ts` | characterization |
| REQ-AEC-03.2 | JSDoc states diagnostic-not-persistence | architectural | `test/skeleton/doc-discoverability.test.ts` | characterization |
| REQ-AEC-04.1 | instanceof across ./commons boundary | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-AEC-04.2 | FIT-04 additive; `\| undefined` arms literal | architectural | `test/fitness/fit-04-*` (+ regen baselines) | characterization |
| REQ-AEC-04.3 | @example: try/catch + instanceof + switch(reason) | architectural | `test/skeleton/doc-discoverability.test.ts` | characterization |
| REQ-AEC-04.4 | 5 rejecting verbs' JSDoc cross-ref AuthoringError | architectural | `test/skeleton/doc-discoverability.test.ts` | characterization |
| REQ-AEC-05.1 | no leak across any family | architectural | `test/fitness/fit-11-*.test.ts` | permanent-fixture |
| REQ-AEC-05.2 | planted enumerable `.cause` leak fails red | architectural | `test/fitness/fit-11-*.test.ts` | permanent-fixture |
| REQ-AEC-05.3 | planted NON-enumerable leak fails red | architectural | `test/fitness/fit-11-*.test.ts` | permanent-fixture |
| REQ-AEC-05.4 | cyclic `.cause` terminates | architectural | `test/fitness/fit-11-*.test.ts` | permanent-fixture |
| REQ-AEC-06.1 | directive message = verb+path+reason | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-06.2 | batch message never prints "undefined" | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-AEC-06.3 | unknown message says could-not-classify | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-10.1 | AuthoringError carries verb + path | unit | `test/skeleton/authoring-error.test.ts` | characterization |
| REQ-10.2 | wire `delete` → author verb `remove` (verb-map) | unit | `test/skeleton/authoring-error.test.ts` | must-fail-first |
| REQ-12.1 | wrap attributes to actual offender (failedIndex 2) | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-12.2 | discard fires after AuthoringError (REQ-07) | integration | `test/skeleton/error-attribution.test.ts` | characterization |
| REQ-14.1 | mid-batch offender (idx 2, differing verb) + appliedCount 2 | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-14.2 | every verb + failure form attributes correctly — the six multi-path `toEqual` expectations (rename/copy/move × collision/not-found) resolve against the §4.3 `primaryPath` table (source-side path) | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-14.3 | batch-level: reason, verb/path undefined, appliedCount 0 | integration | `test/fake/batch-cap.test.ts` + `error-attribution.test.ts` | must-fail-first |
| REQ-15.1 | appliedCount per-batch, not cumulative across flushes | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-15.2 | later-batch failure discards whole run (staging empty) | integration | `test/skeleton/error-attribution.test.ts` | must-fail-first |
| REQ-16.1 | five non-sites named, not silently absent | architectural | `test/skeleton/doc-discoverability.test.ts` (design/spec review) | characterization |
| REQ-17.1 | e2e author reads all fields + switch reaches arm | e2e | `test/e2e/error-attribution.e2e.test.ts` | must-fail-first |
| REQ-RT-01.1–.3 | absent/empty/present classify | unit | `test/skeleton/classify-content.test.ts` | characterization |
| REQ-RT-01.4 | ContentState exhaustive switch (`never` arm) | contract | `test/types/content-state.test.ts` | characterization |
| REQ-RT-02.1–.3 | "0"/"false"/whitespace → present (falsy-trio) | unit | `test/skeleton/classify-content.test.ts` | must-fail-first |
| REQ-RT-03.1/.2 | classifyContent @example + find() JSDoc pointer | architectural | `test/skeleton/classify-content.test.ts` (droppable with S6) | characterization |
| ADR-0021 mechanism | reason/origin exhaustive-switch `never`-arm pins | contract | `test/types/authoring-reason.test.ts` (non-droppable) | characterization |

REQ-11 / REQ-13 (UNCHANGED) remain covered by the retained rows in `error-attribution.test.ts`. Every
spec REQ-ID/scenario is covered; the single Create flow (REQ-17.1) has its e2e row. All REQ-RT rows
live in droppable-S6 files; no non-droppable test references the helper.

## 4.7 Fitness Functions

- **Whole-object no-engine-text leak scan** (REQ-AEC-05, FIT-11) — NEW *runtime value-content* scan of
  the `AuthoringError` object graph (enumerable + non-enumerable, `.cause` bounded with cycle guard)
  against the fake's fragment dictionary **imported from `test/support/rejection-messages.ts`** — the
  same module the fake's throw sites compose messages from, so rewording a fake message can never
  false-green the scan (tracked by construction, not manual literal sync). Distinct from FIT-10
  (static source-text port guard); NOT an extension of it. 3 permanent planted-leak red-proofs.
- **Port-symbol guard** (REQ-ERM-02, FIT-10 extended) — the `EmitRejection` identifier joins
  `EngineClient` in the src-outside-core scan; allow-list still exactly `contract-fake.ts`.
- **`@example` gate** (FIT-06, relied on unchanged) — scans `type (\w+)` exports and follows two-step
  re-exports to defining JSDoc: `AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin`/`ContentState`
  (and the `AuthoringError` class, `classifyContent`) each carry a defining-site `@example` (File
  Changes rows), landing in the SAME slice as their export — otherwise the gate goes red as designed.
- **Kit-boundary guard** (FIT-08, characterization pin added) — the `AuthoringError` family is pinned
  as NOT-kit (author data types), mirroring the existing FoundHandle/WritableHandle pin.
- **`.d.ts` semver gate + union-growth enforcement model** (FIT-04, ADR-0020/spec note 4) —
  **flag-and-classify**: a member added to `reason`/`origin`/`ContentState` rewrites the single-line
  alias declaration in the emitted `.d.ts`, so FIT-04's line-diff flags it (old line absent from
  current = breaking removal). No automated MAJOR/MINOR classifier exists; ADR-0020 instructs the
  reviewer that the ONLY sanctioned resolution for growth on these three unions is a MAJOR bump.
  Belt-and-braces: the `never`-arm pins (`authoring-reason.test.ts`, `content-state.test.ts`) and
  `originFor`'s exhaustive switch break the BUILD on member addition before FIT-04 even runs.

## 4.8 Migration / Rollout

No data, no migration, no flags. **Binding sequencing constraints** (sdd-slice owns the final cut):

1. The `./commons` AuthoringError-family export + its defining-site `@example`s (FIT-06) land NO LATER
   than the slice introducing author-facing `instanceof`/e2e tests — the consuming tests must compile
   against the public surface in their own slice.
2. Each pin rides the slice that breaks its format: `batch-cap.test.ts:67` rewrite + the
   `error-attribution.test.ts` replacement ride the `toAuthoringError` rewrite; the `context.test.ts`
   addition rides the `context.ts` edit.
3. The 2.3 cluster (`classify-content.ts`, `ContentState`, `find()` JSDoc pointer, its commons
   re-exports, `classify-content.test.ts`, `content-state.test.ts`) is ONE droppable final slice;
   nothing outside it references the helper.

Suggested cut: (S1) `EmitRejection` + `rejection-messages.ts` + all fake throw sites + FIT-10
extension — metadata is additive, old translation ignores it, suite stays green; (S2)
`AuthoringError` shape + templates + `originFor` + degradation + `toAuthoringError`/`session.flush`
rewrite + `./commons` export with `@example`s + `authoring-reason.test.ts` + thin instanceof e2e +
pins (batch-cap:67, error-attribution replacement) — the walking-skeleton moment: crosses port →
core → author surface; (S3) `context.ts` outside-run + context:12 pin + origin contrast; (S4) full
coverage — REQ-14/15/17 + full e2e; (S5) FIT-11 + FIT-08 pin + doc-discoverability + dts baseline
regen; (S6, droppable) 2.3 cluster. If sdd-slice prefers a single all-layer walking skeleton, S1+S2
merge — constraint 1 holds either way. Rollback: clean branch revert (proposal §Rollback).

## 4.9 Performance

No significant impact. `toAuthoringError` runs only on the rejection path. `EmitRejection` construction
is fake/engine-side. `classifyContent` is a two-comparison pure function.

## 4.10 Architecture Impact

**Architecture impact**: **modifying**
**Rationale**: the `authoring-error.ts` / `session.ts` / `context.ts` `modify` touchpoints change
established SEAM-04 behavior and the `AuthoringError{verb, path}` shape the baseline documents
(architecture.md line 56), and a new port-internal `EmitRejection` rejection convention joins the
`EngineClient` seam — so the baseline's SEAM-04 data-flow note, the `AuthoringError` shape, and the
`./commons` Public-API listing become outdated. No boundary is removed and the public surface is
additive by construction (§4.4) → not `breaking`. Post-verify refresh: update the SEAM-04 data-flow
line, add the `EmitRejection` convention note (incl. its deliberate kit-barrel exclusion), and list
`AuthoringError`/`classifyContent` under `./commons`.

## 4.11 Open Questions

None.
