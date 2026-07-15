## Verify In-Loop Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Scope**: S-002
**Mode**: in-loop (Strict TDD)
**Date**: 2026-07-15

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 6/6 (S-002.1–.6) — all `[x]` in `slices.md`
- Tests: **1537 pass / 0 fail** (165 files, 3123 expect() calls) — full `bun test` run, matches `apply-progress.md`'s claim exactly
- Typecheck: `bunx tsc --noEmit` — clean, zero errors
- Build: `bun run build` — clean (`tsc -p tsconfig.build.json && bun build ...`), matches `apply-progress.md`'s claim
- Spec compliance for scope: 9/9 REQ-IDs (RUN-01, RUN-02, RUN-03, RUN-04, RUN-06, RUN-07, SEC-07, EXC-01, EXC-02) have named, passing, behaviorally-real tests
- Regression: S-000's e2e + fit-10/29/30/32 + S-001's `frame-reader`/`double-fault` all still green (460 pass across `test/fitness/` + `fake-engine-harness.e2e.test.ts` + `double-fault.test.ts` + `frame-reader.unit.test.ts`, scoped run); `src/core/context.ts`'s brand-marker edit changes zero observable behavior for existing callers (full-suite 1537/1537 green includes all pre-existing `skeleton`/`session` tests)
- Assertion audit (delta test files): one `not.toThrow()` usage (`single-instance-probe.unit.test.ts:77`) — NOT a banned-pattern violation, it is paired with a second, real behavioral assertion (`.ok).toBe(false)`) in the same test, not used as the sole assertion
- Triangulation: every conditional/branching function has ≥2 driving cases (`classifyExitCode` 6, `resolveFactoryExport` 7, `validateFactoryUrl` 5, `isDefineFactoryWrapped` 6, `probeSingleInstance` 5, `parseArgv` 4, `isModuleResolutionFailure` 2)
- Code smells: zero `TODO`/`FIXME`/`as any` introduced in the S-002 diff; narrowing casts (`as BareFactoryFn`, `as { code?: unknown }`) are standard post-`typeof`/post-`in` narrowing

One non-gating WARNING finding below (test-depth gap, not a functional gap — see Findings).

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive.

---

### Real Execution Evidence

```
$ bun test
 1537 pass
 0 fail
 3123 expect() calls
Ran 1537 tests across 165 files. [29.62s]

$ bunx tsc --noEmit
(clean, no output, exit 0)

$ bun run build
$ rm -rf dist
$ tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node --banner "#!/usr/bin/env node"
Bundled 9 modules in 3ms
  pbuilder-codegen.js  14.29 KB  (entry point)
(exit 0)

$ bun test test/fitness/ test/fake/fake-engine-harness.e2e.test.ts test/skeleton/double-fault.test.ts test/transport/frame-reader.unit.test.ts
 460 pass / 0 fail across 36 files   # regression guard
```

### Acceptance Spot-Checks (read + executed)

| Acceptance clause | Test | Result |
|---|---|---|
| Four-class exit matrix spawns real subprocess, asserts distinct codes 1/2/3/4 | `test/fake/exit-matrix.e2e.test.ts` — (a)-(d) | PASS — (a) argv-XOR spawned+exit 1, (b) collision spawned via `ContractFake`+`serveSpawnedRunner`+exit 2, (c) a hand-corrupted length-prefixed frame written to a raw spawned child mid-run+exit 3, (d) crash fixture spawned+exit 4. All four assert `code` from a real OS process exit, not a synthetic value |
| Double-fault preserves E1's class via `.cause` | `test/transport/exit-codes.unit.test.ts` (classifier identity-only read) + pre-existing `test/skeleton/double-fault.test.ts` (real `defineFactory` E1/E2/.cause attachment) | PASS — composition of two already-proven pieces: `double-fault.test.ts:57` proves `context.ts` attaches E2 as `E1.cause` for real; `exit-codes.unit.test.ts:42-59` proves the classifier never reads `.cause`. Together they cover EXC-02.1 end-to-end without re-deriving `context.ts`'s (Read-only) mechanism |
| argv XOR | `test/transport/runner.unit.test.ts` REQ-RUN-01.1-.3 + `exit-matrix.e2e.test.ts` (a) | PASS — both-flags/unknown-flag/neither-flag all exit 1 pre-import (`unreachedIo` throws if `writeFrame` is ever called, proving the greeting is never even reached) |
| Non-`file:`/empty-host pointer pre-import rejection | `test/transport/factory-pointer.unit.test.ts` REQ-RUN-02.1-.3 | PARTIAL — see Findings #1. The pure-function classification (`validateFactoryUrl`) is fully tested; the specific behavioral claim in RUN-02.2 ("exits 1 WITHOUT ever calling `import()` on the target") is verified by direct code read (unconditional early-return in `runner.ts:157-162`, strictly before the greeting is even awaited, before any I/O touches the factory path) rather than by an executing test with a throw-on-import fixture — unlike the analogous SEC-07/RUN-07 claims, which DO have real never-executes proofs |
| Double-wrap reject with arity-2 negative (ADR-04) | `test/skeleton/definefactory-brand-marker.test.ts` + `factory-pointer.unit.test.ts` REQ-RUN-06.1/.2 | PASS — wrapped-default/wrapped-named rejected; bare-arity-1 and bare-arity-2 (`.length===2`, genuinely 2 required params, not spec-rejected arity-sniffing) both proceed to normal wrapping |
| Brand marker doesn't change `defineFactory` semantics for existing callers | `git diff 36ecda2..1394760 -- src/core/context.ts` (read in full) + full suite | PASS — the diff is a pure rename (returned closure→`const wrapped`) plus a non-enumerable `Object.defineProperty` stamp after the closure is built; no change to `wrapped`'s own logic. Full regression (1537/1537, includes all pre-existing `skeleton`/`session` tests) confirms zero observable behavior change |

### SEC-07 Verification (real execution)

- **Resolution-only, before-import**: `src/transport/runner.ts:184-188` calls `probeSingleInstance(moduleUrl)` and returns exit 1 on failure BEFORE the `await import(moduleUrl)` at line 192 — structurally unconditional (no branch skips the check). Confirmed at the e2e level too: `exit-matrix.e2e.test.ts`'s SEC-07 split test builds a real out-of-tree fixture whose `factory.ts` throws `"factory module executed — SEC-07 should have blocked this"` if ever imported, spawns the real runner against it, and asserts `exitCode===1`, `requests===[]`, and `stderr` never contains that string — genuine proof of no-import, not an inference.
- **Split detection triggers exit 1**: same e2e test, plus `single-instance-probe.unit.test.ts` REQ-SEC-07.2 (a real out-of-tree `node_modules/@pbuilder/sdk` fixture whose `index.js` throws at top level, proving the mismatch path never imports it either).
- **Fallback path tested**: `single-instance-probe.unit.test.ts` "self-contained fallback" test exercises the REAL (uninjected) `createRequire` resolver against a real in-repo fixture (`test/fixtures/frame-runner/happy/factory.ts`) and confirms the self-reference-gap recovery returns `{ok: true}`.
- **ADR-05 mechanism deviation — independently re-verified, not trusted from the narrative**:
  1. `tsconfig.build.json` sets `"types": ["node"]` (confirmed by reading the file) — no `bun-types`, so `import.meta.resolveSync` (Bun-only) would not typecheck under it. `bun run build` (which runs this exact config) passed clean in this session, consistent with `resolveSync` no longer being referenced anywhere in the source.
  2. Empirically re-ran the self-reference resolution from a probe script anchored inside this repo's own `test/fixtures/frame-runner/happy/` tree (removed after the check; `git status` confirmed clean): `createRequire(anchor).resolve("@pbuilder/sdk")` → `Cannot find module '@pbuilder/sdk'`; `import.meta.resolveSync("@pbuilder/sdk")` → resolved successfully to `dist/index.js`. This directly confirms the documented self-reference gap that motivated the fallback.
- **Verdict**: mechanism-level conformance with ADR-05's intent (resolution-only realpath comparison, before import) — REQ-SEC-07's normative source (spec.md REQ-SEC-07 + design ADR-05) is satisfied; the API-choice swap (`createRequire`-sole vs. `resolveSync`-primary) is a verified, necessary implementation detail, not a decision reversal. No finding.

### Deviation Adjudication (apply-progress.md § Discoveries/Deviations)

**1. ADR-05 mechanism deviation** (`createRequire(...).resolve` sole mechanism + self-contained fallback, dropping `import.meta.resolveSync`).
**Verdict: conformant-with-rationale, no finding.** See "SEC-07 Verification" above — both premises (compile-time unavailability, self-reference gap) independently re-verified by this evaluator, not taken on the implementer's word. The self-contained fallback is scoped exactly to this repo's own dogfooding fixtures (confirmed by reading the fallback's guard: `packageRootFor(fileURLToPath(factoryUrl)) === runnerRoot`) and does not weaken the real production check — a genuine external consumer's factory always resolves via the primary `createRequire` path and never reaches the fallback branch.

**2. EXC-01.3's "handshake trio" ships as a duo** (WPS-02 + SEC-07 tested; BRB-01 deferred to S-003).
**Verdict: legitimate per build order, no finding for THIS slice.** `slices.md`'s Build Order table explicitly sequences S-003 as "bridge reuses S-002's gates (BRB-01.3)" — `bootstrap-bridge.ts` does not exist until S-003, so the third leg is structurally impossible to test now. The deviation is documented (not silent) in `apply-progress.md`, and S-002's own Covers list is REQ-ID-granular (`EXC-01`, not `EXC-01.3` specifically) per `slices.md`'s Coverage Check methodology, which tracks coverage at REQ-ID level. **Risk flagged for the orchestrator**: S-003's acceptance criteria and its own in-loop verify MUST explicitly close REQ-EXC-01.3's third leg (BRB-01 bridge mismatch → exit 1) — this is a carried-forward obligation, not a closed one; final verify should not treat EXC-01 as fully compliant until S-003 lands it.

**3. `dispatchToFake`'s `ir.emit` error-shaping leg** (new try/catch translating `EmitRejection` into the WPS-08 wire error envelope).
**Verdict: anticipated, no finding.** Read `git diff 36ecda2..1394760 -- test/fake/fake-engine-harness.ts` directly: S-000's original comment explicitly said "Happy dispatch only in S-000; error-shaping legs... land in later slices" — S-002's diff replaces exactly that comment with the EXC-01.2(b) collision leg's implementation, scoped ONLY to `ir.emit` (not `read`/`commit`/`discard`, which remain happy-dispatch-only per the diff). Narrowly scoped, forward-anticipated, not scope creep.

None of the three deviations rise to ARCHITECTURAL or SPEC halt category.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: concerns
**Delta scope**: 6 test files (5 new/modified unit test files + 1 new e2e file), 6 impl files (`exit-codes.ts` [new], `context.ts`, `factory-pointer.ts`, `single-instance-probe.ts` [new], `runner.ts`, `fake-engine-harness.ts`)

#### Findings
1. **REQ-RUN-02.2/.3's explicit "no author code executes" claim is untested at runtime — WARNING, not halt.**
   Spec scenario REQ-RUN-02.2 states: "THEN it exits 1 WITHOUT ever calling `import()` on the target — no author code from that URL executes." The only test coverage for RUN-02 is `factory-pointer.unit.test.ts`'s direct calls to the pure `validateFactoryUrl(url: string)` function — it never goes through `runRunner` with a real (or throw-on-import) factory fixture the way RUN-07's and SEC-07's analogous "never executes" claims do (both of THOSE have a fixture that throws if imported, spawned/run for real, asserting the throw never surfaces). The functional guarantee is real and verified by this evaluator via direct code read (`runner.ts:157-162`'s unconditional early-return strictly precedes the greeting await and the `import()` call at line 192, with no branch that could skip it) — so this is a test-depth gap, not a functional defect. Given the sibling REQs in the same slice (RUN-07, SEC-07) hold themselves to a higher bar (executing proof), the inconsistency is worth closing.
   **Recommended fix** (cheap, not required to unblock the loop): add one case to `runner.unit.test.ts` under REQ-RUN-02 using `unreachedIo()` (already proves "writeFrame never called" ⇒ greeting never reached ⇒ import never attempted) with a non-`file:` or non-empty-host pointer targeting `HAPPY_FIXTURE_DIR` — mirrors the existing RUN-01 pattern exactly, ~10 lines.
   **Routing**: LOCAL (test-only addition, no production code change) — does not block this iteration's PASS; recommend closing before `/evaluate` final mode, since final mode's assertion-quality audit has zero tolerance for sub-critical gaps that in-loop tolerates.

#### Tolerated for now (flagged for final)
- Finding #1 above — sub-critical for in-loop (the underlying behavior IS correct, confirmed by code read); final mode should require the executing proof before REQ-RUN-02 is marked ✅ COMPLIANT in the compliance matrix, not just ⚠️ PARTIAL-by-inference.
- TDD cycle granularity remains per-task-within-a-slice-commit (tests and implementation land together, e.g. `d671846`, `59d7290`, `c0b2c7a`), consistent with S-000/S-001's already-verified convention — spot-checked across 3 of S-002's 5 code commits (`d671846`, `59d7290`, `c0b2c7a`) by reading `git show --stat`; each pairs exactly one new/modified impl file with its test file, no separate post-hoc test commit.

#### Halts (if verdict = halt)
N/A — no halt. "concerns" (not "ok") reflects Finding #1 only; it is explicitly tolerated for in-loop per `strict-tdd-verify.md`'s own tolerance list ("coverage gaps... not touched in this iteration" — here, gaps in *proof depth* for code that WAS touched, but low-risk given the structural read).

---

### Slice Audit Notes Cross-Check

`apply-progress.md`'s own Step 7c notes (Groups 1-3, no Bug/Architecture findings) were spot-verified rather than trusted:
- REQ coverage confirmed independently for all 9 REQs (table above + Acceptance Spot-Checks).
- Zero `as any`/`TODO`/`FIXME` confirmed via `git diff 36ecda2..1394760` scan of the full S-002 diff (context.ts, exit-codes.ts, factory-pointer.ts, single-instance-probe.ts, runner.ts, fake-engine-harness.ts all read in full).
- `bun run build` re-run independently in this session (not trusted from the report) — clean, matches the claimed evidence.
- One discrepancy found and reported above (Finding #1) that the slice audit's Group 1 ("every REQ-ID... has ≥1 test citing it directly") did not surface — technically true (a test exists) but does not audit whether the test proves the REQ's full scenario-level behavioral claim.
