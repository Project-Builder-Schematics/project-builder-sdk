# Design: typed-options-and-read (#2 of l1-author-surface)

**Change**: `typed-options-and-read` · **Triage**: L · **Parent**: `l1-author-surface` (#2 of 4)
**Spec version**: V1 (signed) · **Persona lens**: architect (builder)
**Architecture impact**: **modifying** (justified by §A3 — the `EngineClient.read` port signature + behaviour change)
**ADR count**: 1 (ADR-01, combined async-ratification + nullable-decision) — under the pm's 3+ re-triage trigger.

Descent: A1 (author flows — covered in explore) → **A2** (current state) → **A3** (touchpoints) → **A4** (type derivation + CI proof).

---

## A2 — Current State (as-is, cited)

Two independent surfaces grow inside the single-layer library; the architecture pattern
(`layered modules behind an IR-seam port`, baseline §Pattern) is untouched — no new layer, no new
module, no new dependency edge.

**Surface 1 — typed options.** `create<S>` (`src/commons/index.ts:118-121`) is a type-level-only
generic overload narrowing `options` to the **identity mapped type** `{ [K in keyof S]: S[K] }`. It
proves the seam (excess-property rejection via the mapped type) but does NO required/optional split
and NO per-key type projection beyond what `S` already structurally implies. `S` is erased at
runtime (the runtime body uses the bare-`JsonValue` overload, `:122-132`), so FIT-01 (commons-no-AST)
is safe. The bare overload `create(path, { options: JsonValue })` is the backward-compat path
(REQ-01.3).

**Surface 2 — read, 4 sites, all `Promise<string>`, the seam THROWS on not-found:**

| # | Site | Signature today | Role |
|---|---|---|---|
| 1 | `src/core/engine-client.ts:8` | `read(path: string): Promise<string>` | the **port** (canonical contract) |
| 2 | `src/core/session.ts:33-36` | `async read(path): Promise<string>` | `flush()` then `#client.read` |
| 3 | `src/core/base-handle.ts:5-7` | `ReadOps.read(): Promise<string>` | public-`.d.ts` handle interface |
| 4 | `src/commons/index.ts:29-32, 60-63` | handle bodies `read(): Promise<string>` | `find(...).read()` + writable handle `.read()` (both call `session.read`) |
| — | `test/support/contract-fake.ts:67-80` | `async read(filePath): Promise<string>` | sole impl — **THROWS** `path not found` on `#deleted` / unseeded (`:68-69`, `:79`) |

Read is **NOT a wire directive** (baseline §Data flow, ADR-0001:26-29 — read-through is a separate
query, not a `Directive`). So `wire.ts` / `Batch` / `Directive` / FAKE-01..06 are untouched by this
change. Clean seam isolation: the only crossed boundary is `Session ↔ EngineClient`.

The dts baseline that pins read today: `test/fitness/dts-baseline/core.base-handle.d.ts:2`
(`read(): Promise<string>`). `commons.index.d.ts` references the handle TYPES by name (`FoundHandle`/
`WritableHandle`), so the read signature lives in the `core.base-handle` / `core.handle-state`
baselines, not inline in commons.

---

## A3 — Architecture Touchpoints (mapped to `openspec/architecture.md`)

| Layer / Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/commons/` `OptionsOf<S>` derivation | replace | identity map → real required/optional split + per-key type match + excess reject; **type-level only**, internal alias | **aligns** — stays AST-free (FIT-01); same module, no new import |
| `src/core/engine-client.ts` — `EngineClient.read` **port** | modify signature + behaviour | `Promise<string>` → `Promise<string \| undefined>`; not-found returns `undefined` instead of throwing | **deviates → ADR-01** |
| `src/core/session.ts` — `Session.read` | modify return type | rides the port: `Promise<string \| undefined>`; mechanical, no logic added | aligns (rides ADR-01; baseline §Data flow Read path refreshed) |
| `src/core/base-handle.ts` — `ReadOps.read` (public `.d.ts`) | modify return type | `Promise<string \| undefined>` | **deviates → ADR-01**; FIT-04 fires, `core.base-handle` baseline regen |
| `src/commons/index.ts` — handle bodies + `@example` | modify return type + doc | follow `ReadOps`; `find(path): FoundHandle` shape UNCHANGED, `.read()` widens; `@example` shows `=== undefined` trichotomy | aligns (PIN: handle method, not `find`-resolves-content) |
| `test/support/contract-fake.ts` — `ContractFake.read` | modify | stop throwing on not-found → return `undefined`; model absence by **key membership** (`#deleted` / `!in seed` / `!tree.has`), never truthiness | aligns (fake fidelity, conformance anchor per 0015) |
| `test/types/*` + `test/types/permissive-proof.ts` | extend | positive matrix (required/optional/type) + negative matrix (missing-required, wrong-type, excess) | aligns |
| `.github/workflows/ci.yml` + `package.json` scripts (+ maybe `tsconfig.permissive-proof.json`) | modify | invert permissive-proof to TS-error-code-pinned, regression-proof | aligns (CI hygiene) |
| `test/fitness/dts-baseline/core.base-handle.d.ts` | regen | the frozen read surface re-baselined post-build | aligns (FIT-04 going green = proof) |

**Two `deviates` rows, ONE decision.** The port signature change (row 2) and the public `ReadOps`
`.d.ts` change (row 4) are the *same logical signature* expressed at two layers — they share **ADR-01**.
Every other row `aligns`: it either rides the ADR mechanically (Session, handle bodies) or is
AST-free / test-only / CI hygiene. No new architectural layer, no new dependency edge → impact is
**`modifying`**, not `breaking` (the layered-modules-behind-an-IR-seam pattern is intact).

**PIN — read surface shape (carried from explore, confirmed):** the user phrasing "el find te va a
devolver el contenido" maps to the EXISTING shape — `find(path): FoundHandle` UNCHANGED,
`FoundHandle.read(): Promise<string | undefined>`. Collapsing `find` to resolve content directly would
delete the read-and-modify chain (`find` also offers `modify`/`rename`/`move`/`copy`/`remove`) and is a
far larger semver break than the return-type widening. Architecturally correct = handle method.

---

## ADR-01 — Read signature freeze: async (ratifies ADR-0001) + nullable (`undefined`)

**Status**: Accepted
**Origin**: change `typed-options-and-read` (2026-06-22), #2 of `l1-author-surface`
**Builds on / cites**: ADR-0001 (async clause), ADR-0015 / skeleton ADR-01 (port-growth pattern)

### Context

`find(path).read()` returns `Promise<string>` and the engine seam THROWS on not-found
(`contract-fake.ts:68-69, :79`). Two consequences make the read surface wrong to freeze at L1:

1. **Absence is not branchable.** An author cannot write "scaffold if missing, else patch" — the only
   way to detect not-found is to catch a throw, which conflates absence with genuine read failure.
2. **Absent and empty are indistinguishable.** A throw on not-found and a `""` on empty cannot both be
   branched cleanly; an idempotent generator can overwrite a user's deliberately-empty file.

The read signature is part of the L1 semver surface (`package.json#exports` + emitted `.d.ts`,
FIT-04). It is frozen the moment L1 ships, so the async-ness and the not-found shape must be settled
WITH EVIDENCE before the lock. This ADR has two clauses: one **ratifies** an already-frozen decision;
one is a **new** decision.

### Decision

**Clause A — async (RATIFICATION, not re-litigation).** `read` stays `async` / returns a `Promise`.
This is already decided by **ADR-0001:28-29**, quoted verbatim:

> "Reads are async (`await read(path)`): the read-through is an IPC callback (`fs.readFile`) that
> crosses the process boundary. This freezes the §5 sync-vs-async signature as async."

The read-through is an **out-of-process IPC callback** across the SDK↔engine process boundary
(JSON-RPC `tree.read` over stdio, baseline §Interconnection). A synchronous read across that boundary
would require blocking IPC — the rejected alternative **sync-across-IPC is already frozen-out by
ADR-0001**. This sub-change's §9.0 "spike" supplies the *evidence* (the call genuinely crosses the
process boundary; there is no in-SDK file handle to read synchronously), not a fresh debate. No new
async decision is made here — the clause exists so the combined return type
(`Promise<string | undefined>`) cites its async half to a real decision instead of asserting it.

**Clause B — nullable sentinel = `undefined` (NEW decision).** `read` returns
**`Promise<string | undefined>`**:

- content present → the content string
- not-found → `undefined` (was: **THROW** — behaviour change)
- empty file → `""`

The contract MUST distinguish not-found (`undefined`) from empty (`""`). `undefined` is the
author-facing sentinel. Because `undefined` is not JSON-representable, the JSON-RPC `tree.read` wire
carries absence as **null/absent**, and the SDK translates it to `undefined` at the TS boundary — see
"Wire→undefined translation site" below.

**Wire→undefined translation site = the PORT (`EngineClient.read`).** The port returns
`Promise<string | undefined>`; the fake and the real client BOTH stop throwing on not-found and return
`undefined`; `Session.read` and the handle bodies merely widen their return type to ride it. The
alternative — `Session.read` catches the fake's throw and maps it to `undefined` — is **rejected**
because:

1. **It follows the 0015 pattern.** ADR-0015 established that the boundary contract lives ON the port
   and the fake is the conformance anchor the real engine must match (`commit`/`discard` were added to
   the port, not faked-around in Session). The not-found contract is the same kind of decision: it
   belongs on the port surface, modelled by the fake now, fulfilled by the real client at engine §6.
2. **Catch-in-Session conflates absence with failure.** A `catch` around `#client.read` cannot tell
   "not-found" from "permission denied / transport error" by type — it would have to string-match the
   fake's message (the exact brittleness ADR-02 rejected for error attribution). Making absence a
   first-class `undefined` RETURN and leaving genuine failures as throws keeps the two distinguishable
   by control flow, not by parsing.
3. **Genuine read failures stay throws → #3 territory.** not-found is the ONLY case that maps to
   `undefined` in #2. Permission / transport / engine errors remain rejections; their typed-error
   attribution (`AuthoringError` on the read site) is explicitly #3 (`Session.read` wrap is scoped out
   here per skeleton ADR-02). So the port's `undefined` means *file is not there*, never *the read
   broke*.

`Session.read` does NOT catch and does NOT coalesce — it `await this.flush()` then
`return this.#client.read(path)` with the widened return type. No `||`, no `??` at the mapping (RISK
#1 fence).

### Rejected alternatives (nullable clause)

- **`null` instead of `undefined`** — rejected per the user's explicit decision (Q-B, 2026-06-22).
  (Trade-off acknowledged: `JsonValue` includes `null` not `undefined`, and JSON-RPC cannot carry
  `undefined` — which is *why* the wire carries absence as null/absent and the SDK translates at the
  boundary. The author-facing surface is `undefined`; the wire representation is an internal concern.)
- **Throw-on-not-found (the current behaviour)** — rejected: it is the exact defect this sub-change
  removes. Absence is not an exceptional condition for a read-and-decide flow; it is an expected,
  branchable outcome. Throwing forces `try/catch` for control flow and conflates absence with failure.
- **`Session.read` catches the throw → `undefined`** — rejected (see "translation site" above):
  off-pattern vs 0015, conflates absence with failure, string-match brittleness.

### Consequences

- (+) Author read-and-decide flows become real: `if (c === undefined) create… else if (c === "") …
  else modify(c)` (REQ-RD-01/02/03).
- (+) The not-found-vs-empty distinction kills a real bug class (idempotent generator clobbering a
  deliberately-empty file).
- (−) **Behaviour change THROW → `undefined`.** Every read-consumer in the existing suite that relied
  on the fake throwing on not-found changes meaning. The fake's two `throw new Error("…path not
  found…")` sites (`:68-69`, `:79`) become `return undefined`. See Fake Migration Plan — this is the
  load-bearing risk.
- (−) **FIT-04 fires.** `ReadOps.read` lands in `dist/core/base-handle.d.ts`; the baseline must be
  regenerated. The gate going green against the regenerated baseline IS the proof the new frozen
  surface is intentional, not an accident.
- (−) The widening is a **breaking edit** to a public `.d.ts` (`string` → `string | undefined` makes
  the return type wider — a consumer that assigned `const c: string = await h.read()` no longer
  compiles). Acceptable: pre-1.0.0 (`version: 0.0.0`), the surface is being frozen-correct BEFORE the
  L1 lock — that is the whole point of doing #2 before release. SEAM-01 sign-off note: this widens the
  read surface #1 threaded; integration gate #2 re-runs #1's union suite as the regression fence
  (and bans `as string` casts — see below).
- (−) Real-engine divergence risk: the fake models `undefined`-on-not-found that the real Go client
  must match at engine §6. Tracked, not silent (same posture as 0015's commit/discard).

---

## A4.1 — Typed options: PROVE + FREEZE the homomorphic map (CORRECTED at apply, 2026-06-22)

**Original premise (WRONG, corrected):** the design assumed the skeleton's identity map
`{ [K in keyof S]: S[K] }` did NO required/optional split and that a separate `OptionsOf<S>` derivation
was needed. **Verified at apply (standalone tsc):** that map is HOMOMORPHIC — its constraint is `keyof S`,
so TypeScript PRESERVES `S`'s `?` modifiers, required-ness, and per-key value types. It already enforces
the FULL contract for every signed scenario:

| Scenario | Identity map `{ [K in keyof S]: S[K] }` (today) |
|---|---|
| REQ-01.4 multi-field all-required present | compiles |
| REQ-01.5 optional key omitted | compiles (`?` preserved) |
| REQ-01.6 missing required key | rejected — **TS2741** |
| REQ-01.7 wrong value type | rejected — **TS2322** |
| REQ-01.2 excess property | rejected — **TS2353** |

A separate `OptionsOf<S>` (required/optional split via `undefined extends S[K]`) is **structurally
equivalent** for every signed scenario. Its ONLY observable difference — a required key typed
`T | undefined` *without* a `?` modifier becomes omittable — is unwanted (a key declared without `?` is
required; an undefined-able VALUE ≠ an optional KEY), and no scenario exercises it. **`OptionsOf<S>` is
NOT introduced** (a structural no-op that would freeze dubious semantics under FIT-04).

### The actual deliverable: characterization proof + regression guard
The `create<S>` overload's type is **unchanged** — it keeps `options: { [K in keyof S]: S[K] }` (the
skeleton's homomorphic map). #2's typed-options value is to **PROVE + FREEZE** that already-correct
contract before the L1 semver lock:
- **Positive matrix** (REQ-01.1/.3/.4/.5) — `expect-type` proofs that the contract holds (multi-field,
  optional-omittable, single-field, untyped backward-compat). These are CHARACTERIZATION tests: they go
  green immediately because the behaviour exists; their value is locking it before freeze.
- **Negative matrix** (REQ-01.2/.6/.7) — `@ts-expect-error` proofs (excess, missing-required, wrong-type)
  in `permissive-proof.ts`, USED directives (real errors suppressed) from the start.
- **CI regression guard** (REQ-03) — makes the negatives regression-proof so a future refactor that
  weakens the map flips CI red.

**Strict TDD note (orchestrator):** S-01/S-02 cannot produce a RED — the behaviour already exists, so this
is CHARACTERIZATION of correct existing behaviour, not RED-driven new behaviour. The Strict-TDD RED
requirement is WAIVED for the characterization matrix (recorded). The genuine RED-driven new behaviour of
#2 is the READ track (S-04/S-05) and the CI guard's `[red-proof]` (S-03).

### No source change to the overload
`src/commons/index.ts`'s `create<S>` overload type is NOT modified (no `OptionsOf<S>`, no new aliases).
FIT-01 is trivially preserved (no new import). The OPTIONS track touches only TEST files + the CI guard +
`ci.yml`/`package.json` — zero production-type change.

---

## A4.2 — CI permissive-proof inversion design (regression-proof, two-idiom-aware)

### The problem (concrete)

`test/types/permissive-proof.ts` mixes **two opposite-exit-code idioms** in one file:

- **Idiom 1 — unused-directive (`:34-38`, `_negativeWouldBeUnused`).** A `@ts-expect-error` on code
  that is actually VALID (`PermissiveWritableHandle` HAS `remove`). Success = tsc raises **TS2578**
  ("Unused '@ts-expect-error' directive"). Exit non-zero.
- **Idiom 2 — used-directive-suppressing-a-real-error (`:56-59`, `_excessFieldRejected`).** A
  `@ts-expect-error` on code that IS a real error (excess field rejected by the mapped type). Success =
  the directive is USED, **no TS2578 from this block**. This block contributes exit 0.

The current `ci.yml` rule (`if exit 0 → fail; else pass`, `:40-46`) is **too coarse**:

1. It validates only Idiom 1 (it asserts SOMETHING errored). It cannot confirm Idiom 2's directive was
   actually USED — if the `create<S>` overload regressed so the excess field became LEGAL again, that
   `@ts-expect-error` would become UNUSED and itself raise TS2578 → the run still exits non-zero → CI
   still "passes". **The negative proof for excess (and the new missing-required / wrong-type cases)
   would silently rot.**
2. `tsconfig.permissive-proof.json` includes `src/**/*.ts` (`:3`). ANY unrelated compile error in
   `src/` makes tsc exit non-zero → CI false-greens, attributing an unrelated failure to "the proof
   working".

REQ-03 (added) demands the negative proof be CI-verifiable such that a deliberate regression flips CI
RED. The coarse rule fails REQ-03 for the Idiom-2 cases.

### The design — pin to expected TS error codes on expected lines

Replace "any non-zero = pass" with **assert the EXACT set of expected TS diagnostics**. Concretely:

1. **Capture tsc diagnostics in a stable, parseable form.** Run
   `tsc --noEmit -p tsconfig.permissive-proof.json --pretty false` and capture stdout (the
   `file(line,col): error TSxxxx:` form). `--pretty false` makes the output line-grep-stable.
2. **Assert the expected diagnostics are PRESENT, by code.** The proof passes iff:
   - **TS2578** ("Unused '@ts-expect-error' directive") appears for the Idiom-1 line(s)
     (`_negativeWouldBeUnused` `remove()` line), AND
   - **NO TS2578** appears for the Idiom-2 lines (`_excessFieldRejected` and the new
     missing-required / wrong-type negative cases) — their `@ts-expect-error` must be USED (a real
     error suppressed). If a regression makes the excess field legal, TS2578 appears on THAT line →
     the assertion fails → CI RED.
   - **No other-code errors from `src/**`** — guard against the false-green: the only acceptable
     diagnostics are the expected TS2578 lines. Any `error TS` that is NOT an expected TS2578 on an
     expected line → fail (catches unrelated `src/` compile breakage masquerading as proof success).
3. **Implement as a small Bun test, NOT a shell `if`.** Move the assertion from `ci.yml`'s inline
   shell into `test/types/permissive-proof.guard.test.ts` (a real test under `bun test`), which:
   `spawnSync("bunx", ["tsc", "--noEmit", "-p", "tsconfig.permissive-proof.json", "--pretty",
   "false"])`, parses the diagnostics, and asserts the present/absent code-on-line sets above. This
   (a) makes the proof a first-class test (mutation-resistant, runs locally), (b) removes the
   exit-code coupling entirely, (c) lets CI keep `bun test` as the single gate. `ci.yml`'s separate
   "Permissive-proof (must fail)" step is then **deleted** — the guard test subsumes it (the inverted
   exit-code idiom is retired). `package.json#typecheck:permissive-proof` stays as a dev convenience
   but is no longer the CI assertion.

   *Pinning posture:* assert by ERROR CODE + which named region (line of the `@ts-expect-error`), NOT
   by exact line NUMBER where avoidable — match the diagnostic to the directive's source line read at
   test time, so editing the file (adding cases) does not require hand-editing line numbers. If
   line-number matching is unavoidable, derive the expected lines by scanning the source for the
   `@ts-expect-error` markers, not hard-coded integers.

4. **REQ-03 deliberate-regression guard.** The guard test's value is proven by a documented red-proof:
   temporarily widening `OptionsOf<S>` back to permissive (excess legal) MUST make
   `permissive-proof.guard.test.ts` fail. Capture this as a `[red-proof]` case the same way FIT-04 does
   (`fit-04` lines 150-224) — either a sibling assertion that feeds a SIMULATED diagnostic set missing
   the expected TS2578-absence, or a documented manual procedure in the test's header comment. The
   simulated-diagnostic approach is preferred (runs every CI, no manual step) — feed the parser a
   captured "regressed" diagnostic blob and assert the guard rejects it.

   *Note (qa-engineer's lens — flagged, not owned):* whether the red-proof is a live simulated-blob
   assertion vs a documented manual step is a test-design call. Architecturally I require ONLY that the
   guard be a real `bun test` assertion keyed on error codes, not an exit-code heuristic. Final
   red-proof shape → qa-engineer.

### Why this is architecturally correct (not just more code)

The inverted-exit shell idiom encodes the proof's correctness in a CI YAML conditional — invisible to
the test suite, un-runnable locally, and blind to WHICH negative held. Moving it into a code-pinned
`bun test` puts the architectural rule (the negative type proofs are real AND specific) where every
other fitness function in this repo lives (`test/fitness/*`, `test/types/*`) — boring, consistent,
mutation-resistant. It also closes the false-green hole, which is a correctness fix, not a style one.

---

## File Changes (CONTRACT WITH SLICE)

Every read site + the fake + `OptionsOf<S>` + type tests + permissive-proof + dts baseline + CI. A read
site touched without the port (or vice-versa) is INCOMPLETE — the port and all four ride sites move as
one signature.

| Path | Action | What |
|---|---|---|
| `src/core/engine-client.ts` | Modify | `EngineClient.read(path): Promise<string>` → `Promise<string \| undefined>`. Update the file-header comment (`:2`) — `read()` now returns `string \| undefined`, not-found = `undefined`. The PORT owns the not-found contract (ADR-01). |
| `src/core/session.ts` | Modify | `Session.read` return type → `Promise<string \| undefined>`. Body unchanged: `await this.flush(); return this.#client.read(path);` — NO catch, NO `??`/`||` (ADR-01 RISK #1 fence). |
| `src/core/base-handle.ts` | Modify | `ReadOps.read(): Promise<string>` → `Promise<string \| undefined>` (public `.d.ts` surface; FIT-04 fires). |
| `src/commons/index.ts` | Modify | (a) `OptionsOf<S>` + `RequiredKeys`/`OptionalKeys` internal type aliases (A4.1); `create<S>` overload `options: OptionsOf<S>`. (b) Both handle bodies (`:29-32`, `:60-63`) read return type → `Promise<string \| undefined>` (ride `ReadOps`). (c) `find` `@example` (`:96-97`) + handle-read `@example` → trichotomy using `=== undefined` (FIT-06, tech-writer fold-in). Runtime body of `create` UNCHANGED; `find`/handle shape UNCHANGED. |
| `test/support/contract-fake.ts` | Modify | `read(filePath): Promise<string \| undefined>`. The two `throw new Error("…path not found…")` sites (`:68-69` `#deleted`, `:79` unseeded) → `return undefined`. Absence detected by **key membership** (`#deleted.has` / `!#tree.has` / `!(in #seed)`), NEVER truthiness. `""` seed / staged → returns `""` faithfully (the `#tree.get(p)!` / `#seed[p]!` paths already return the stored string, including `""`). `lastServed` semantics unchanged for found paths. |
| `test/types/typed-create.test.ts` | Modify | POSITIVE matrix: multi-field required (`{a:string;b:number}` all present compiles), optional-omittable (`{a:string;b?:number}` with `b` omitted compiles), keep REQ-01.1 single-field + REQ-01.3 untyped-backward-compat. `expect-type` at the call site. |
| `test/types/permissive-proof.ts` | Modify | NEGATIVE matrix beyond excess: missing-required (`{a:string;b:number}` with `b` omitted → `@ts-expect-error`), wrong-type (`{a:string}` with `a: 1` → `@ts-expect-error`), keep the existing excess case (`:56-59`). All are Idiom-2 (used directives — real errors suppressed). |
| `test/types/permissive-proof.guard.test.ts` | Create | The code-pinned CI guard (A4.2): spawn `tsc --pretty false` on the permissive tsconfig, parse diagnostics, assert expected TS2578-present (Idiom-1) + TS2578-absent (Idiom-2) by code+region, reject unexpected `src/` errors. Includes the REQ-03 `[red-proof]` (simulated regressed-diagnostic blob → guard rejects). |
| `.github/workflows/ci.yml` | Modify | DELETE the "Permissive-proof (must fail)" inverted-exit step (`:40-46`). `bun test` now carries the proof via the guard test. (Strict typecheck + build steps unchanged.) |
| `package.json` | Modify (maybe) | Keep `typecheck:permissive-proof` as a dev convenience. Optionally add `--pretty false` if the guard test shells the named script rather than `tsc` directly. No exports change. |
| `tsconfig.permissive-proof.json` | Modify (conditional) | ONLY if the guard test needs the include/exclude tightened (e.g. narrowing `src/**` to avoid unrelated-error noise). Default: leave as-is and let the guard's "reject unexpected codes" rule handle isolation. Flag for slice: decide include scope when wiring the guard. |
| `test/fitness/dts-baseline/core.base-handle.d.ts` | Regen | Re-baseline `read(): Promise<string \| undefined>` after `bun run build`. The regen is the intentional-freeze proof (FIT-04 green again). |
| `test/fitness/dts-baseline/commons.index.d.ts` | Regen IF diff | The handle read signature lives in `core.base-handle` (commons references handle types by name); the `@example` change is comment-stripped by FIT-04's normalizer. Regen ONLY if the emitted `commons.index.d.ts` actually diffs — apply-verify, do not pre-assert. |
| `test/fitness/dts-baseline/core.handle-state.d.ts` | Regen IF diff | `WritableHandle`/`FoundHandle extends ReadOps` — they reference `ReadOps` by name, so likely NO inline signature change. Regen ONLY if it diffs post-build. |
| #1's read-consumer test sites (`test/skeleton/*`, `test/fake/*`) | Modify (apply-verify) | Sites that asserted the fake THROWS on not-found, or assigned `const c: string = await …read()`, break under `string → string \| undefined`. See Fake Migration Plan — this list is a HYPOTHESIS, enumerated at apply time, NOT asserted here. |

---

## Flow Changes (L, user-facing — required)

The "user surface" of `@pbuilder/sdk` is the TypeScript authoring API (no UI/CLI/HTTP — baseline:
0 REST/GraphQL/WS/gRPC). "Flow" = the author's compile-time + runtime experience.

### Flow A — read-and-decide (the value flow)

| Step | Before | After |
|---|---|---|
| Locate | `const h = find("src/config.ts")` | unchanged — `find(path): FoundHandle` |
| Read | `const c = await h.read()` → `Promise<string>`; **THROWS** if absent | `const c = await h.read()` → `Promise<string \| undefined>`; absent → `undefined`, empty → `""` |
| Decide | impossible — must `try/catch` to detect absence; cannot tell absent from empty | `if (c === undefined) create(…) else if (c === "") modify(…) else modify(c)` — branchable trichotomy |
| Bug class | idempotent generator clobbers a deliberately-empty file (empty looks like "needs content") | empty (`""`) is distinguishable from absent (`undefined`) — clobber avoided |

### Flow B — typed create (the differentiator flow)

| Step | Before | After |
|---|---|---|
| Author types | `create<S>(…, { options })` narrows `options` to `{ [K in keyof S]: S[K] }` (identity) | narrows to `OptionsOf<S>` — required keys mandatory, optional keys omittable |
| Required omitted | only excess is caught; a missing required key may slip through (identity map does not force presence beyond `S`'s own shape) | missing required key → compile error |
| Wrong type | caught only as far as `S[K]` structurally implies | per-key type mismatch → compile error |
| Excess | rejected (mapped type) | rejected (preserved) |
| Untyped escape | `create(path, { options: JsonValue })` compiles | unchanged (REQ-01.3 backward-compat) |

---

## Test Derivation (every signed scenario → a test)

| REQ-ID | Scenario | Level | Test (name/path) |
|---|---|---|---|
| REQ-01.1 | typed create compiles for matching single-field schema | type-level | `test/types/typed-create.test.ts` (expect-type positive) |
| REQ-01.3 | untyped create still compiles for bare `JsonValue` | type-level | `test/types/typed-create.test.ts` |
| REQ-01.4 | multi-field all-required present → compiles | type-level | `test/types/typed-create.test.ts` |
| REQ-01.5 | optional key omitted → compiles | type-level | `test/types/typed-create.test.ts` |
| REQ-01.6 | missing required key → compile error | type-level (neg) | `test/types/permissive-proof.ts` (`@ts-expect-error`, Idiom-2) |
| REQ-01.7 | wrong-type value → compile error | type-level (neg) | `test/types/permissive-proof.ts` (`@ts-expect-error`, Idiom-2) |
| REQ-01.2 | excess field → compile error | type-level (neg) | `test/types/permissive-proof.ts` (existing, Idiom-2) |
| REQ-03.1 | deliberate over-permissive regression flips guard RED — TS2578 absent (Idiom-2) by code | architectural | `test/types/permissive-proof.guard.test.ts` (`[red-proof]` simulated diagnostic blob) |
| REQ-03.2 | unrelated compile error NOT counted as proof passing — reject non-expected `src/` codes | architectural | `test/types/permissive-proof.guard.test.ts` (`[red-proof]` unrelated-error blob → guard rejects) |
| REQ-RD-01.1 | existing file returns its exact content | contract | `test/fake/read-trichotomy.test.ts` (`=== "<content>"`) |
| REQ-RD-01.2 | not-found → `undefined` (strictly `=== undefined`) | contract | `test/fake/read-trichotomy.test.ts` (`toBeUndefined()`, NOT `toBeFalsy`) |
| REQ-RD-01.3 | empty file → `""` (`=== ""` AND `!== undefined`) | contract | `test/fake/read-trichotomy.test.ts` |
| REQ-RD-01.4 | whitespace-only `"   \n"` preserved verbatim (not trimmed, not `""`/`undefined`) | contract | `test/fake/read-trichotomy.test.ts` (mutant-killer) |
| REQ-RD-01.5 | falsy-string `"0"`/`"false"` preserved verbatim (NOT coalesced) | contract | `test/fake/read-trichotomy.test.ts` (mutant-killer, each `=== "<literal>"`) |
| REQ-RD-01.6 | three outcomes statically branchable; each branch hit by its fixture | type-level + integration | `test/skeleton/read-trichotomy.test.ts` (`if (c===undefined)…else if (c==="")…else…`) |
| REQ-RD-02.1 | absent path does NOT throw AND resolves `undefined` (incl. the `#deleted` path) | contract | `test/fake/read-trichotomy.test.ts` (no-throw assertion) |
| REQ-RD-03.1 | public read signature `Promise<string \| undefined>` frozen in regen'd `.d.ts` baseline, FIT-04 green | architectural | `test/fitness/fit-04-dts-semver-gate.test.ts` + `test/fitness/dts-baseline/core.base-handle.d.ts` (regen) |
| REQ-RD-03.2 | fake models absence as `undefined` via key membership (seeded `""` → `""`, no `src/x.ts` → `undefined`) | contract | `test/fake/read-trichotomy.test.ts` (membership, not truthiness) |
| REQ-RD-01.1/.2/.3 | end-to-end through handle: `find(p).read()` trichotomy via real Session + unmocked fake | integration | `test/skeleton/read-trichotomy.test.ts` (cross-boundary, no mock on read) |

**Mutant-resistance posture (qa-engineer's domain — seeded, not owned):** REQ-RD assertions use strict
`=== undefined` / `toBeUndefined()` / `=== ""` and the falsy-but-present trio (`" "`, `"0"`, `"false"`)
specifically so a `read() => content || undefined` mutant (which would coalesce `""`/`"0"`/`"false"` to
`undefined`) is KILLED. NEVER `toBeFalsy`/`toBeTruthy`. The whitespace/falsy-string cases are the
load-bearing mutant-killers — without them, the trichotomy collapses silently. Final assertion design →
qa-engineer.

---

## Fake Migration Plan (RISK #1 — load-bearing; HYPOTHESIS, apply-verified)

**The change.** `ContractFake.read` (`:67-80`) goes `Promise<string>` → `Promise<string | undefined>`.
The two `throw new Error("…path not found…")` sites become `return undefined`:

- `:68-69` — `#deleted.has(filePath)` → `return undefined` (was throw)
- `:79` — neither `#tree` nor `#seed` has the path → `return undefined` (was throw)

The found paths are UNCHANGED: `#tree.get(p)!` (`:73`) and `#seed[p]!` (`:77`) already return the
stored string verbatim, INCLUDING `""`. Absence is detected by **key membership** (`#deleted.has`,
`#tree.has`, `in #seed`) — never by truthiness — so a seeded `""` returns `""`, not `undefined`. This
is the FAKE-fidelity invariant the trichotomy depends on.

**Which existing #1 tests the `string → string | undefined` widening will force to change — HYPOTHESIS.**

> **CRITICAL — this is a PREDICTION, not a fact (lesson from #1).** In sub-change #1 the
> "which-tests-break" prediction was a hypothesis that apply had to verify; treating it as fact misled
> the slice. The list below is the SET OF SITES TO CHECK at apply time, marked **`apply-verify`**. Do
> NOT pre-assert breakage; enumerate by running `tsc` + `bun test` after the fake/port edit and fixing
> the REAL breaks.

At-risk read-consumer sites to inspect (from the A2 grep — every `.read()` / `session.read` /
`#client.read` consumer in #1's suite):

- `test/skeleton/read-your-own-write.test.ts` — asserts read returns staged content; the
  `observeCallOrder` wrapper forwards `read`. **Check**: does any assertion expect a THROW on a
  not-found read? Does any annotate `const c: string = …`?
- `test/skeleton/session.test.ts` / `test/skeleton/handle-chaining.test.ts` — `EngineClient` literals
  / spies with a `read` member. **Check**: their `read` stubs' return type must widen to
  `Promise<string | undefined>` to satisfy the grown port (same mechanical sweep #1 did for
  `commit`/`discard`).
- `test/fake/*` (fidelity, contract-fake) — any test that asserted `read` THROWS on not-found now
  asserts `=== undefined`. This is a **deliberate behavioural test reversal** (like #1's
  partial-write flip), NOT a regression — track it explicitly when found.
- Any `await …read()` whose result is assigned to a `: string` annotation or passed to a
  `string`-typed parameter → now a type error under the widening.

**FENCE VIOLATIONS (review-ban, hard):**

1. **`as string` casts to "fix" the widening type error are BANNED.** Casting `(await h.read()) as
   string` re-narrows the type and DEFEATS the entire contract — it re-merges `undefined` back into
   `string`, exactly the trichotomy this sub-change exists to create. A type error from the widening
   means the consumer must HANDLE the `undefined` branch (or assert it cannot be undefined via a
   guarded `if`), not cast it away. Integration gate #2 re-runs #1's union suite with `tsc` exit 0 AND
   greps the diff for `as string` at read sites.
2. **`||` / `??` coalescing at the not-found mapping is BANNED** (RISK #1). `content || undefined`
   merges `""`/`"0"`/`"false"` into not-found. The fake returns by key membership; `Session.read` does
   not coalesce. The mutant-killer tests (`" "`/`"0"`/`"false"`) catch this; review bans it.

**FIT-01 re-run.** `OptionsOf<S>` is type-level → invisible to the import scanner; FIT-01
(commons-no-AST) must stay green as a regression gate against any runtime schema-read drift. Re-run in
#2's fence.

---

## Public surface / docs (tech-writer fold-in)

- **`read()` `@example` (FIT-06 forces an `@example` on exports).** It MUST show the trichotomy branch
  using strict `=== undefined`, NEVER `if (!content)`. Concretely (in the `find`/handle JSDoc):
  ```ts
  const c = await find("src/config.ts").read();
  if (c === undefined) create("src/config.ts", { template, options });
  else if (c === "") modify("src/config.ts", seedContent);
  else modify("src/config.ts", patch(c));
  ```
  The `if (!content)` falsy form is a documented ANTI-pattern: it re-merges `undefined` and `""` (and
  `"0"`/`"false"`), reintroducing the exact bug this sub-change removes. The example is the canonical
  teaching surface — it must model the correct branch.
- **Contract/naming doc.** `read()` returns `string | undefined`: *content* / *not-found → `undefined`*
  / *empty → `""`*. Document the not-found sentinel is `undefined` (not `null`, not a throw) and that
  genuine read failures (permission/transport) still reject (→ #3). `OptionsOf<S>` is INTERNAL — not
  documented as a public export. Final prose/naming → tech-writer.

---

## architecture_impact: modifying (justified by §A3)

Two `deviates` rows in the A3 table, both mapping to ADR-01 (the `EngineClient.read` port signature +
behaviour change and its public `ReadOps` `.d.ts` projection — one logical signature at two layers).
The change MODIFIES an established contract (the port's `read` return type and its throw-on-not-found
behaviour, and the baseline §Data flow "Read path" line + the §Notes `EngineClient` port description
which both pin `read` as `Promise<string>`). No architectural layer is added or removed; no new
dependency edge; the layered-modules-behind-an-IR-seam pattern is intact. `OptionsOf<S>` is additive
type-level surface within the existing `commons` module (`aligns`). Therefore **modifying**, not
`breaking`. Post-final-verify refresh REQUIRED for: baseline §Data flow Read path
(`Promise<string | undefined>`, not-found → `undefined`) and §Notes `EngineClient` port surface line
(`read` now nullable).
