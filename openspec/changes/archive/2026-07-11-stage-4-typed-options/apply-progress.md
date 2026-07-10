# Apply Progress: stage-4-typed-options

**Cumulative scope**: S-000 (walking skeleton), S-001 (Bin CLI Discipline), S-002 (Schema
Contract Fitness), S-003 (Run-Boundary Validation Matrix), S-004 (Reserved Lifecycle Names),
S-005 (Cross-Domain No-Echo Verification + Discoverability), S-006 (Reason-Literal
Finalization) — ALL 7 SLICES COMPLETE, plus an in-loop fix on the S-001/S-002 delta (ADR-0032
position locator, below) and a coordinated Stage-2 amendment-code pass (below). **Mode**:
Strict TDD.
**Status**: S-000..S-006 complete. The S-006 gate opened 2026-07-10 (coordinated AEC
amendment landed, commit `1c1188d`, spec V3 signed) and was built the same run. The change is
now ready for `sdd-verify --mode=final`/archive.

## Slices Built This Run (Coordinated AEC Amendment Code + S-006)

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| (amendment code, not a slice) | Stage-2-owned, authorized by spec V3 | complete | n/a |
| S-006 | edge-case | complete | 4/4 |

### Sub-scope A — Coordinated Stage-2 AEC Amendment Code

Authorized exclusively by `openspec/specs/authoring-error-contract/spec.md` V3 (REQ-AEC-01/07/08/09,
signed 2026-07-10) — NOT by this change's own slices.md. Extended `src/core/authoring-error.ts`'s
closed `AuthoringReason` union from six to eight values (`invalid-input`, `reserved-name`),
`originFor` (both map to `"authoring-rejected"`), and `messageFor`.

**`messageFor` design decision (flagged, not silent)**: REQ-AEC-09's two new template rows need
`{field}`/`{expectedType}`/`{name}` — data `messageFor` cannot derive from `verb`/`path` alone (unlike
the six legacy reasons). Rather than corrupt `verb`/`path`'s existing typed meaning, the
`AuthoringError` constructor gained ONE new optional field, `message?: string`, which overrides the
derived template when supplied. `messageFor`'s `invalid-input`/`reserved-name` arms exist only to
satisfy the exhaustive-switch compile-time pin (ADR-0021 mechanism) and throw if reached — these two
reasons have no default template and MUST be constructed with an explicit `message`. This is a
deliberate, minimal, purely-additive extension (documented here per the craftsman preamble's
pushback-not-silent-deviation rule) beyond the literal "add the two enum members" — it is the
infrastructure S-006 needs to construct byte-identical REQ-AEC-09 messages through the public API,
and it does not itself trip FIT-04 (an added optional field is a pure line addition, not a removal;
only the `AuthoringReason` union's single-line growth is what FIT-04 flags, matching REQ-AEC-01's own
declared stance that reason-union growth is breaking).

**Files changed**:
| File | Action | What Was Done |
|---|---|---|
| `src/core/authoring-error.ts` | Modified | `AuthoringReason` extended to eight values; `originFor` extended (`invalid-input`/`reserved-name` → `"authoring-rejected"`); `messageFor` extended (two `throw`-on-reach arms + doc); constructor gained optional `message?: string` override field. JSDoc updated (six→eight, `@example` switch cases added). |
| `test/types/authoring-reason.test.ts` | Modified | Exhaustive-switch compile-time pin extended to eight `AuthoringReason` members + the `expectTypeOf` union pin. |
| `test/skeleton/authoring-error.test.ts` | Modified | `AuthoringError` imported as a value (not type-only). New REQ-AEC-07.1/REQ-AEC-08.1 describe block (origin classification for both new reasons, direct construction — no `EmitRejection` path exists for these SDK-side reasons). New REQ-AEC-09 describe block (explicit-message-override proof + no-message-throws proof for both reasons). `closedReasons` list in the REQ-AEC-01.2 test extended to eight. |
| `test/fitness/fit-11-whole-object-leak-scan.test.ts` | Modified | `AuthoringError` imported as a value. Two new direct-construction helpers (`invalidInputRejection`, `reservedNameRejection`) added to REQ-AEC-05.1's case list — the amended eight-family leak-scan completeness proof. |
| `test/fitness/dts-baseline/core.authoring-error.d.ts` | Modified (regenerated) | `bun run build` via FIT-04's own self-building `beforeAll` (never invoked directly — session rule), then `dist/core/authoring-error.d.ts` copied over the baseline. Diffed byte-for-byte against the prior baseline before copying: exactly two deltas — (1) the `AuthoringReason` union line growth (six→eight, the FIT-04-flagged breaking delta, per REQ-AEC-01's own stance) and (2) the new optional `message?: string` constructor field (a pure addition, does not itself trip FIT-04's removal-based gate). Nothing else drifted. |

**TDD Cycle Evidence**:
| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `AuthoringReason` union + exhaustive pin | `test/types/authoring-reason.test.ts` (whole file) | unit(type) | `tsc --noEmit`: `TS2678: Type '"invalid-input"' is not comparable to type 'AuthoringReason'` (×2) + `TS2344` on the `expectTypeOf` union pin | done | n/a — type-level pin, single case | none needed |
| `originFor`/classification | `authoring-error.test.ts::REQ-AEC-07.1/REQ-AEC-08.1` (2 cases) | unit | `messageFor: unhandled reason invalid-input` / `...reserved-name` (constructor threw — union/message-override not yet implemented) | done | 2 cases (both new reasons) — forces `originFor`'s new arm, not just one | none needed |
| `messageFor` override mechanism | `authoring-error.test.ts::REQ-AEC-09` (3 cases) | unit | 1 real assertion failure (override didn't exist, `messageFor`'s old default arm threw `unhandled reason`); 2 cases already passed incidentally (the pre-existing default-arm throw already satisfied "no message → throws", now for the RIGHT documented reason) — flagged, not silently accepted, per strict-tdd's "test passes immediately" guidance; verified these 2 continue to test real behavior (my new explicit-message-required error, not the old generic one) | done | invalid-input vs reserved-name — 2 distinct reasons prove the override isn't hardcoded to one | none needed |
| FIT-11 leak-scan (amended 8-family list) | `fit-11-whole-object-leak-scan.test.ts::REQ-AEC-05.1` (2 new cases) | architectural | `messageFor: unhandled reason invalid-input` / `...reserved-name` (same underlying gap) | done | n/a — completeness-list addition, not a new algorithm | none needed |
| FIT-04 baseline | `fit-04-dts-semver-gate.test.ts::core/authoring-error` | architectural | `core/authoring-error: no breaking removals vs committed baseline` — the old 6-value union line flagged as a "breaking removal" (matches REQ-AEC-01's declared stance) | done (post baseline regen) | n/a | none needed |

### Sub-scope B — S-006: Reason-Literal Finalization

**GATE task**: read `src/core/authoring-error.ts` (post my own sub-scope A work, verified as
though I hadn't written it) — confirmed it carries `origin`/`reason` generalized to eight members
including `invalid-input`/`reserved-name`, both mapping to `origin: "authoring-rejected"`. GATE
PASSED — proceeded.

**Files changed**:
| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/input-rejection.ts` | Modified | `rejectionFor`/`rejectionForReservedName` upgraded from plain `Error` to `AuthoringError{origin:"authoring-rejected", reason:"invalid-input"\|"reserved-name"}`, constructed via the amended public API's `message` override field. Message literals BYTE-UNCHANGED (verified — see below). Return types narrowed from `Error` to `AuthoringError`. |
| `test/skeleton/input-rejection.test.ts` | Modified | Flipped the three `.not.toBeInstanceOf(AuthoringError)` interim assertions to `.toBeInstanceOf(AuthoringError)` + `origin`/`reason` equality. NOT separately enumerated in slices.md's task list (which names only the three integration/e2e test files), but this file directly unit-tests the exact two functions S-006 upgrades — its own interim assertions would otherwise contradict the new behavior. Flagged as a discovered gap in the task-list enumeration, not scope creep (the functions under test ARE input-rejection.ts's, explicitly in scope). |
| `test/skeleton/run-boundary-validation.test.ts` | Modified | REQ-RBV-01.2 (wrong-typed value) flipped: `toBeInstanceOf(AuthoringError)` + `origin`/`reason` equality. REQ-RBV-05's schema-read/parse-failure assertions (`chmod-000`, malformed JSON, invalid-shape) deliberately LEFT UNCHANGED — verified these throw via `context.ts`'s `malformedSchemaMessage`, a DIFFERENT code path than `input-rejection.ts`, and the closed `AuthoringReason` enum has no member for "schema file itself unreadable/malformed" (REQ-AEC-07 scopes `invalid-input` strictly to "resolved input fails schema-derived validation", not schema-file corruption). A stale forward-looking comment in `context.ts` (line ~100, "upgraded to AuthoringError in S-006") suggests broader scope was once anticipated; not acted on — out of S-006's actual authorized scope (input-rejection.ts only) and outside the closed enum's coverage. Flagged for the Planner, not silently resolved either way. |
| `test/skeleton/reserved-lifecycle-names.test.ts` | Modified | REQ-RLN-01.1 (pre-execute.ts sibling) flipped: `toBeInstanceOf(AuthoringError)` + `origin`/`reason` equality. REQ-RLN-02.1 gained a `reason` equality assertion (in-kind distinguishability, not just message-literal). The "constraint 4: non-ENOENT unreadable package dir" test LEFT UNCHANGED (same rationale as RBV-05 above — a scan-infrastructure failure, not a "declares a reserved name" rejection; still plain `Error` via a different `context.ts` throw site). |
| `test/e2e/typed-factory.e2e.test.ts` | Modified | The RBV-01.1 site-proof reject case flipped: `toBeInstanceOf(AuthoringError)` + `origin`/`reason` equality, replacing the interim `.not.toBeInstanceOf` assertion. |

**AEC-09 message-template assertions (3 rows) — confirmed byte-identical post-upgrade**:
`"invalid input: port must be number"` (type-mismatch), `"invalid input: extra is a reserved or
disallowed key"` (reserved/excess key), `"reserved lifecycle name: pre-execute is reserved and
cannot be declared by a factory module"` (reserved-name) — all three still assert verbatim in
`input-rejection.test.ts`, `run-boundary-validation.test.ts`, `reserved-lifecycle-names.test.ts`,
`typed-factory.e2e.test.ts`. `test/security/canary-no-echo.test.ts` (task 5) — untouched, still
green: its own header comment noted it was designed to survive S-006 ("once S-006 adds
`origin`/`reason` string fields") via a generic own-enumerable-string-property scan.

**TDD Cycle Evidence**:
| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `rejectionFor`/`rejectionForReservedName` upgrade | `input-rejection.test.ts` (3 new/flipped cases) | unit | `expect(received).toBeInstanceOf(expected)` — received a plain `Error` (`invalid input: port must be number` / `...extra is a reserved or disallowed key` / `reserved lifecycle name: pre-execute...`), expected `AuthoringError` | done | missing/wrong-type vs disallowed-key vs reserved-name — 3 distinct call sites, same upgrade mechanism | none needed |
| Wiring proof (integration/e2e) | `run-boundary-validation.test.ts::REQ-RBV-01.2`, `reserved-lifecycle-names.test.ts::REQ-RLN-01.1/REQ-RLN-02.1`, `typed-factory.e2e.test.ts` (4 cases across 3 files) | integration/e2e (outer loop) | Same shape: `toBeInstanceOf(AuthoringError)` failed against the pre-upgrade plain `Error` | done | schema-validation path (RBV) vs reserved-name path (RLN) vs full e2e site-proof (typed-factory) — 3 distinct wiring paths, not just the unit-level function | none needed |

### Post-Slice Audit (Step 7c, code-audit.md `slice` mode, self-run — architecture.adrs non-empty: ADR-0027..0032)

- **Group 1**: AEC-07(.1), AEC-08(.1), AEC-09(.1,.2) — implementing code + test present. RBV-01.2,
  RLN-01.1, RLN-02.1 wiring re-proven end-to-end post-upgrade.
- **Group 2 (Architecture)**: `input-rejection.ts` remains the sole Stage-2-coupled module
  (constraint 1) — verified no other file constructs an `AuthoringError` for these two rejection
  paths. `authoring-error.ts`'s amendment stays inside its own file (no new cross-module coupling).
  No `Map<string,*>`/`Record<string,*>`-as-tree pattern introduced. Constraint 6 (only S-006 asserts
  an exact `reason` string) honored — reason-string assertions added ONLY in this run's files.
- **Group 3 (Code quality)**: No untyped casts beyond the established `as Error`/`as AuthoringError`
  narrowing already used elsewhere in these same test files for `catch (err) { ... err as Error }`
  patterns. No magic numbers. No TODO/FIXME. No dead code — `messageFor`'s two throw-only arms are
  reachable (proven by the REQ-AEC-09 no-message tests) and documented as intentionally
  unreachable-in-normal-use.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

## Slices Built This Run (S-005) [prior run in this session]

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-005 | edge-case | complete | 4/4 |

(S-000/S-001/S-002/S-003/S-004 — see the sections below, carried forward unchanged.)

## Files Changed — S-005 (Cross-Domain No-Echo Verification + Discoverability)

| File | Action | What Was Done |
|---|---|---|
| `test/security/canary-no-echo.test.ts` | Created | REQ-RBV-04.1/.2 dictionary-seeded canary scan (design §4.2/§4.6 File Changes/Test Derivation rows). Drives every rejection branch the change introduces — RBV-01.1 (missing, via a co-resident field's canary value), RBV-01.2 (wrong-type), RBV-01.3 (excess key), RBV-01.4 (non-JSON/function, canary embedded in the function's own source text), RBV-01.5 (reserved-name-as-input-key), RBV-01.6 (`__proto__`), RBV-01.7 (null-vs-missing trichotomy), TFO-04.1 (bin malformed-schema STDOUT/STDERR), RLN-02.1 (reserved-lifecycle-name rejection) — with a fresh, unpredictable `canaryToken()` seeded as the VALUE under test each time, and a generic `surfaceContains` scan over `.message`/`.stack`/every own enumerable string property (so the same scan still holds once S-006 adds `origin`/`reason`). A separate REQ-RBV-04.2 case pins the asymmetry: an excess key literally NAMED the canary token legitimately appears in the message. Self-building `beforeAll` (S-001 `codegen-cli.test.ts` precedent) since this file also spawns the built `dist/bin/pbuilder-codegen.js` for the TFO-04.1 branch. |
| `test/fitness/definefactory-jsdoc.test.ts` | Created | REQ-FPS-05.2/.3/.4 dedicated doc-assertion (design §4.2 Gap 5). Reads `src/core/context.ts` via the shared `jsDocBefore` helper (`test/support/jsdoc-scan.ts`) and asserts `defineFactory`'s JSDoc carries `@example` naming `pbuilder-codegen`/`schema.json`/a typed `defineFactory<...>` call/`schema.generated`, and `@remarks` naming both `pre-execute` and `post-execute`. Also carries REQ-FPS-05.4 (no dedicated home named by design's Gap-13 resolution; landed here alongside its REQ-FPS-05 siblings): asserts `README.md` contains the qualifying line verbatim, byte-for-byte. `fit-06-example-jsdoc.test.ts` left byte-for-byte UNTOUCHED, as designed (its `PUBLIC_PATHS` never reaches the internal-kit `defineFactory` export). |
| `src/core/context.ts` | Modified | `defineFactory`'s JSDoc comment expanded with `@param fn`, `@param options.packageDir` (the two opt-out tiers, `import.meta.dir` vs. the `import.meta.url` misuse warning), `@remarks` (naming `pre-execute`/`post-execute` as reserved, `add`/`remove` NOT reserved here), and `@example` (bin invocation → typed `defineFactory<Input>` call, mirroring `test/fixtures/typed-factory/factory.ts`'s actual shape). Doc-comment-only change — zero behavior/signature change (confirmed: full suite green, `tsc --noEmit` clean, no runtime code touched). |
| `README.md` | Modified | Added the REQ-FPS-05.4 qualifying line VERBATIM immediately after the "Anatomy of a schematic" code block's closing fence (the anchor line `schema.json # typed inputs` lives inside that fence, per the iteration-4 plan-verify pin — the qualifying line goes right below it as normal markdown, not inside the fence). |

## TDD Cycle Evidence — S-005

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `canary-no-echo.test.ts` (10 cases) | `test/security/canary-no-echo.test.ts` | integration | **Passed immediately on first run (10/10 green, 0 failures)** — see Deviations below for the RED-posture reassessment (`[must-fail-first]` → `[characterization]`, justified) | done (no fix needed — behavior already correct) | n/a — the no-echo property already held generally across every branch; nothing to force | none needed |
| `definefactory-jsdoc.test.ts` (3 cases) | `test/fitness/definefactory-jsdoc.test.ts` | contract (doc-assertion) | 3 real assertion failures: `expect(DEFINE_FACTORY_DOC).toContain("pbuilder-codegen")` — received the pre-S-005 JSDoc (no `@example`/`@param`/`@remarks`); `expect(DEFINE_FACTORY_DOC).toContain("pre-execute")` — same; `expect(readme).toContain(README_QUALIFYING_LINE)` — README had no qualifying line at all | done | n/a — each is a single fixed-shape pin (the JSDoc content, the README literal), no class of inputs implied by the scenario language | none needed |

## Deviations from Design

Carried forward from prior runs (see below), plus this run's:

9. **`canary-no-echo.test.ts`'s `[must-fail-first]` RED-posture tag did not hold — reassessed
   as `[characterization]`, not silently accepted.** All 10 cases passed on the very first
   run (0 failures). Investigated before accepting this, per strict-tdd's Phase-1 halt
   guidance ("Test passes immediately on first run → HALT... either the behaviour already
   exists... or the test is asserting nothing real"): read `schema-validate.ts`,
   `input-rejection.ts`, `schema-parse.ts`, and `bin/pbuilder-codegen.ts` in full — none of
   them ever call `String()`/`.toString()`/echo raw content anywhere on a rejection path;
   `expectedTypeFor` always renders the DECLARED kind, never the received value; the bin's
   `formatParseError`/`malformedSchemaMessage` render only fixed author-vocabulary strings.
   The no-echo discipline was genuinely built correctly into S-000/S-003/S-004 from the
   start (mirrors constraint 2's "written correctly in S-000, not bolted on later" framing,
   applied here to REQ-RBV-02/04 rather than SEC-1). The assertions themselves are real and
   comprehensive (a fresh, unpredictable canary token per case; a generic surface scan over
   message/stack/own-properties; 8 distinct branches + a subprocess stdout/stderr scan) — not
   vacuous, so this is the "behaviour already exists" diagnosis, not the "asserting nothing"
   one. Same judgment-call shape as S-004's deviation 6 (a prior test-passes-immediately
   signal in this same change, assessed low-risk and not re-done via a contrived
   revert/rewrite). Not re-attempted via a fabricated pre-implementation revert, since the
   PRODUCTION code these tests exercise was never written as part of this task — reverting it
   would mean reverting S-000/S-003/S-004's own already-verified, already-audited work, which
   is out of this slice's scope and would fabricate RED evidence for code this slice did not
   write.
10. **`test/security/canary-no-echo.test.ts` gained its own self-building `beforeAll`**, not
    itself listed among the iteration-4 "Self-building artifact tests" pin's two named files
    (`fit-14-package-surface.test.ts`, `codegen-static-scan.test.ts`). Same reasoning as
    S-001's deviation 1 (`codegen-cli.test.ts`): this file also spawns the built
    `dist/bin/pbuilder-codegen.js` (TFO-04.1 branch), so a bare `bun test` on a fresh
    checkout — or an isolated `bun test test/security/canary-no-echo.test.ts` run — must not
    depend on `test/bin/codegen-cli.test.ts` having already built the artifact as a side
    effect of running first.
11. **REQ-FPS-05.4's dedicated `fit`/test assertion has no fixed home named by the design**
    (Gap 13 says only "a fit/test asserts it byte-for-byte greppable," not which file).
    Landed it in the NEW `test/fitness/definefactory-jsdoc.test.ts` alongside its REQ-FPS-05
    siblings (.2/.3) rather than in `doc-discoverability.test.ts` (that file's own docstring
    scopes it to `authoring-error-contract`/`error-attribution-skeleton` REQs specifically) —
    same REQ family, same slice, one file for all three discoverability scenarios.

## Post-Slice Audit (Step 7c, code-audit.md `slice` mode, self-run — architecture.adrs non-empty: ADR-0027..0032)

### S-005
- **Group 1**: RBV-04(.1,.2) — `canary-no-echo.test.ts` drives all 8 named branches (RBV-01.1-.7, TFO-04.1, RLN-02.1 — 9 sub-cases across 8 branches, RBV-01.7 folding missing+null into one test per its own trichotomy shape) plus the RBV-04.2 asymmetry pin. FPS-05(.2,.3,.4) — `definefactory-jsdoc.test.ts` asserts all three.
- **Group 2 (Architecture)**: No new `src/` production modules — `context.ts`'s only change is a JSDoc comment expansion (zero runtime behavior change, confirmed by an unmodified function body + full suite green + `tsc --noEmit` clean). `test/security/canary-no-echo.test.ts` is a new top-level test directory, but it exactly matches design's own File Changes table row (`test/security/canary-no-echo.test.ts | Create`) — not a freelanced location. `test/fitness/definefactory-jsdoc.test.ts` joins the existing `test/fitness/` fixture-and-gate convention. FIT-07's recursive walk is unaffected (no new `src/core/schema/**` files this run). `defineFactory` confirmed NOT reachable from FIT-06's `PUBLIC_PATHS` (verified: `rg defineFactory src/commons/index.ts src/conformance/index.ts` — zero export-site hits, only prose mentions in doc comments), so FIT-06 staying untouched is structurally correct, not an oversight.
- **Group 3 (Code quality)**: No untyped casts beyond the established test-file convention already used elsewhere in this codebase (`as unknown as Record<string, unknown>` for reading an Error's own extra properties — the same shape as `fit-11-whole-object-leak-scan.test.ts`'s `as unknown as { cause?: unknown }`, not the banned narrowing-smuggle pattern in a NEW form). No magic numbers. No TODO/FIXME. No dead code — every new helper (`surfaceContains`, `scratchDir`) is used by every test case in its file.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

---

## Slices Built This Run (S-003, S-004)

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-003 | happy-path | complete | 6/6 |
| S-004 | happy-path | complete | 5/5 |

(S-000/S-001/S-002 — 7/7 + 6/6 + 4/4 — were built in prior runs; see the "[Prior run]"
sections below, carried forward unchanged.)

## Files Changed — S-003 (Run-Boundary Validation Matrix)

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-validate.ts` | Modified | `ValidationFinding` widened to a union (`missing` \| `wrong-type` \| `disallowed-key`). Two independent safe walks: (1) the schema's declared properties drive missing/wrong-type checks (`matchesType` per `SchemaKind`, `expectedTypeFor` renders the DECLARED kind — enum renders `one of: <choices>` — never the received value's kind, no-echo); (2) `Object.keys(input)` drives excess/reserved-lifecycle-name/`__proto__`-`constructor`-`prototype` detection, unconditionally (a reserved-name input key rejects even if a schema happens to declare that property, per RBV-01.5's literal wording), collapsed into one `disallowed-key` finding class per the branch→template mapping. A present-but-`undefined` value is treated as absent (REQ-RBV-01.7's undefined leg of the trichotomy). Safe iteration throughout (constraint 5) — only reads by key name, never writes through a computed key (the actual `__proto__`-assignment pollution vector), so the module can never pollute `Object.prototype` while inspecting a hostile key. |
| `src/core/schema/input-rejection.ts` | Modified | `rejectionFor`'s switch extended for `wrong-type` (same template as `missing`) and `disallowed-key` (the `... is a reserved or disallowed key` template). |
| `src/core/context.ts` | Modified | `validateAtRunBoundary` rewritten: ENOENT read failure → `console.warn` the pinned no-schema opt-out literal, run proceeds; non-ENOENT read failure (EACCES/EPERM/EISDIR) → fail-closed plain `Error` via a new `malformedSchemaMessage` formatter (author-vocabulary `describeReadFailure`, never the raw errno text); `SchemaParseFailure` (invalid JSON or invalid shape) → same fail-closed formatter, reusing `.problem`/`.line`/`.column`; an empty schema (zero declared properties) → distinct `console.warn` literal, validation skipped (not the same as no-schema). New shared helpers: `relativeDir` (the `<dir>` = `path.relative(process.cwd(), packageDir)` algorithm, Executor Context pin), `isErrnoException`, `describeReadFailure`, `locatorSuffix`, `malformedSchemaMessage`, `noSchemaWarning`, `emptySchemaWarning`. |
| `test/skeleton/schema-validate.test.ts` | Modified | Extended with the full unit-level matrix: wrong-type (incl. triangulating string-vs-number), excess-key, non-JSON (function value), reserved-input-key, `__proto__`/`constructor`/`prototype` (incl. a dedicated safe-iteration-no-pollution proof with a real `Object.prototype` canary), the null/undefined/empty-string trichotomy, template-syntax opaque-pass-through, and enum branch rendering (valid choice, invalid choice, missing-enum-key). |
| `test/skeleton/input-rejection.test.ts` | Modified | Extended for `wrong-type` (incl. the enum `one of: ...` rendering) and `disallowed-key` message assertions + plain-`Error`-never-`AuthoringError` proof for the new kind. |
| `test/skeleton/run-boundary-validation.test.ts` | Created | Integration-level: drives `defineFactory` end-to-end against `mkdtempSync` scratch package dirs (`seedSchema` from `test/support/canary.ts`) — RBV-01 site-proof sampling (wrong-type/excess/non-JSON/reserved-key/proto-key-no-pollution/trichotomy/template-opaque), RBV-02 no-echo, RBV-03 stateless per-run/per-factory warning proof (`spyOn(console, "warn")`), RBV-05 EACCES fail-closed + malformed-JSON + invalid-shape + empty-schema-distinct-warning. |

## Files Changed — S-004 (Reserved Lifecycle Names)

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-discovery.ts` | Modified | New `findReservedSibling(packageDir)`: `readdirSync` the package dir, normalize each entry (lowercase, strip a recognized `.ts`/`.js` extension) so file-form, dir-form, and case variants all compare equal against `RESERVED_LIFECYCLE_NAMES`. ENOENT (package dir doesn't exist) → `undefined` (not a failure, mirrors the RBV-03 opt-out posture); any other read error fails closed (thrown). Never inspects `schema.json` or resolved inputs (REQ-RLN-01.4's boundary). |
| `src/core/schema/input-rejection.ts` | Modified | New `rejectionForReservedName(name)` — the RLN-02.1 pinned literal, colocated with `rejectionFor` so the eventual S-006 `AuthoringError` upgrade has one file to touch for both throw families. |
| `src/core/schema/index.ts` | Modified | Barrel exports `findReservedSibling` + `rejectionForReservedName`. |
| `src/core/context.ts` | Modified | New `checkReservedNames(packageDir)` called BEFORE `validateAtRunBoundary` in `defineFactory`'s runner (structural check first, then the per-call input check). Non-ENOENT scan failures reuse the same `[pbuilder]`/`relativeDir`/`describeReadFailure` machinery S-003 built. |
| `test/skeleton/schema-discovery.test.ts` | Modified | Unit coverage for `findReservedSibling`: clean package, pre-execute/post-execute file-form, dir-form, case-insensitive, schema.json-field-is-not-scanned boundary pin, ENOENT-is-not-a-failure, non-ENOENT-fails-closed (root-guarded chmod-000). |
| `test/skeleton/reserved-lifecycle-names.test.ts` | Created | Integration-level: drives `defineFactory` end-to-end — RLN-01.1/.2/.3 (pre-execute/clean/post-execute), dir-form, non-ENOENT fail-closed (root-guarded), RLN-02.1 distinguishable-by-literal, and the RLN-01.4/RLN-03.1/.2 boundary-pin characterization scenarios (schema-field / `add` / exported `remove` NOT rejected). |
| `test/fixtures/red/reserved/{pre-execute-file,post-execute-file,pre-execute-dir,pre-execute-case}/*` | Created | Permanent red fixtures (never walked) for FIT-16's direct-call red-proofs — file-form ×2 (pair triangulation), dir-form, case-insensitive. |
| `test/fixtures/red/reserved/untethered-factory.ts` | Created | Permanent red fixture: a `defineFactory<...>(...)` call whose options argument never threads the packageDir opt-in — FIT-16's 3rd-signal red-proof. |
| `test/fitness/fit-16-reserved-name-scan.test.ts` | Created | FIT-16: always-on walk over `ALWAYS_ON_SCAN_ROOTS` reusing `findReservedSibling` (green) + a 3rd-signal substring check (`hasUntetheredDefineFactory`) over the reference schematic's `factory.ts` (green) + 6 red-proofs via direct function calls against `test/fixtures/red/reserved/**` (never walked). |

## TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `schema-validate.ts` matrix | `schema-validate.test.ts` (11 new cases) | unit | Ran against the pre-S-003 implementation (missing-only): 3 real assertion failures shown (`wrong-type`/`disallowed-key`/enum-`expectedType` expected, `[]` or wrong string received) before implementing | done | string-vs-number (missing↔wrong-type), enum valid/invalid/missing (3 branches), null-vs-missing-vs-empty-string (the trichotomy itself IS the triangulation) | none needed |
| `input-rejection.ts` extension | `input-rejection.test.ts` (4 new cases) | unit | `TypeError: undefined is not an object (evaluating '...message')` — switch had no `disallowed-key` case, fell through to `undefined` | done | wrong-type (plain) vs wrong-type (enum `one of:`) vs disallowed-key — 3 template shapes | none needed |
| `context.ts` wiring | `run-boundary-validation.test.ts` (13 cases, new file) | integration (outer loop) | Ran the full file against the pre-S-003 `validateAtRunBoundary` (silently returns on any read error): 5 real failures — RBV-03 warn-count 0-not-3, RBV-05 EACCES/malformed/invalid-shape/empty-schema all silently passed instead of rejecting/warning | done | EACCES + malformed-JSON + invalid-shape (`missing "properties"`) — 3 distinct fail-closed paths converging on the same literal family; empty-schema vs no-schema — 2 distinct warning texts | none needed |

## TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `findReservedSibling` | `schema-discovery.test.ts` (8 new cases) | unit | `SyntaxError: Export named 'findReservedSibling' not found` — function did not exist | done | file-form (pre-execute, post-execute — pair) + dir-form + case-variant — 4 matching-shape cases; ENOENT vs non-ENOENT — 2 read-posture cases | none needed |
| `checkReservedNames` wiring | `reserved-lifecycle-names.test.ts` (9 cases, new file) | integration (outer loop) | Ran against `context.ts` pre-wiring: `pre-execute.ts` sibling did NOT reject (only the unrelated no-schema warning fired) — 4 real failures before wiring `checkReservedNames` into `defineFactory` | done | pre-execute vs post-execute vs dir-form — 3 structural-shape cases; RLN-01.4/RLN-03.1/.2 boundary pins are `[characterization]` per the slice's own RED-posture taxonomy (pin already-correct non-behavior — findReservedSibling never touches schema.json or exports) | none needed |
| FIT-16 always-on + 3rd signal | `fit-16-reserved-name-scan.test.ts` (8 cases, new file) | architectural | New file — "did not exist" RED per the established FIT-12/13/14/15 precedent (self-contained check function + its test written together). Genuine RED surfaced DURING this pass, not before: the first `hasUntetheredDefineFactory` implementation (literal `"defineFactory("` substring) never matched the real `defineFactory<Input>(...)` generic-call syntax used everywhere in this codebase — the true-positive red-proof failed, exposing the bug in the check itself, not the fixture | done | 2 positive-control roots (reserved-sibling-absent, packageDir-threaded) + 6 red-proofs (4 reserved-shape variants + untethered + negative-control) | Fixed `hasUntetheredDefineFactory` to anchor on the bare `defineFactory` identifier instead of `defineFactory(` (generics defeat the literal-paren substring); also caught and fixed the fixture's own doc-comment accidentally containing the literal opt-in token name it exists to prove absent — both caught via genuine RED runs, not by inspection |

## Deviations from Design

Carried forward from prior runs (see below), plus this run's:

6. **`rejectionForReservedName` was implemented alongside S-003's `input-rejection.ts` edit**
   (both throw-constructors colocated in one pass since they share the file and the "single
   S-006 touch point" rationale), before `input-rejection.test.ts`'s own RLN-02.1 test cases
   were written. Its first test run therefore passed immediately — a real strict-TDD
   anti-pattern signal ("test passes immediately on first run") — flagged rather than
   silently accepted. Assessed as low-risk: the function is a one-line pure mapping from a
   spec-pinned literal (no branching, no chance of the implementation being shaped to fit a
   test that hadn't been written yet), and the actual wiring into `context.ts`
   (`checkReservedNames`) DID follow the proper RED→GREEN cycle against
   `reserved-lifecycle-names.test.ts`. Not re-done via a contrived revert/rewrite, since
   that would fabricate RED evidence rather than report an honest sequencing slip.
7. **Reserved-name enforcement runs BEFORE schema validation** in `defineFactory`'s runner
   (`checkReservedNames` then `validateAtRunBoundary`), not specified by an explicit
   ordering constraint in the spec/design. Judgment call: RLN is a structural, input-
   independent check (fails the same way regardless of the call's resolved input), so
   checking it once up front avoids doing (and then discarding) input-shape validation work
   for a package that's going to reject on structure anyway. No test asserts the ORDER
   itself — both checks throw a plain `Error` and are individually well-tested; if a future
   scenario needs specific ordering it is easy to test-drive then.
8. **`isErrnoException` is now duplicated three times** (`bin/pbuilder-codegen.ts` pre-
   existing, `src/core/context.ts` and `src/core/schema/schema-discovery.ts` added this
   run) — each a 3-line type guard. Considered consolidating into a shared module but
   declined: it would require either a new `src/core/schema/` (or `src/core/`) utility file
   touched by three otherwise-unrelated modules for marginal DRY benefit, or reaching into
   `bin/` from `src/` (backwards — `bin/` may import `src/`, never the reverse, FIT-15).
   Flagged per the Boy Scout rule's own "if non-trivial, propose a cleanup slice rather than
   silently expand scope" clause — small enough that I judge it not worth a dedicated slice,
   but noting it here rather than silently accreting a third copy unremarked.

## Post-Slice Audit (Step 7c, code-audit.md `slice` mode, self-run — architecture.adrs non-empty: ADR-0027..0032)

### S-003
- **Group 1**: RBV-01(.2-.8), RBV-02(.1), RBV-03(.1), RBV-05(.1,.2) — implementing code + test present for every scenario, both at unit level (`schema-validate.test.ts`, exhaustive finding-shape matrix) and integration level (`run-boundary-validation.test.ts`, wired end-to-end proof) per design's own "unit vs integration" split intent.
- **Group 2 (Architecture)**: All changes stay inside the already-planned `src/core/schema/` cluster + `context.ts`'s existing run-boundary touchpoint (design §4.2c "aligns"/"deviates→ADR-0029" respectively — no NEW touchpoint introduced). No `Map<string,*>`/`Record<string,*>`-as-tree pattern introduced (FIT-07's recursive walk still green). `input-rejection.ts` remains the sole Stage-2-coupled-at-S-006 module (constraint 1 — verified: no other file constructs or references an `AuthoringError` for these rejection paths).
- **Group 3 (Code quality)**: No untyped casts introduced. No magic numbers (the `0o000`/`0o755`/`0o644` chmod literals in tests are POSIX permission constants, not arbitrary). No TODO/FIXME. No dead code. Every new helper in `context.ts` is used by at least one of the two failure paths it was written for.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

### S-004
- **Group 1**: RLN-01(.1-.4), RLN-02(.1), RLN-03(.1,.2), FPS-05(.3 doc note only — the dedicated JSDoc test itself is S-005's) — implementing code + test present for every scenario, unit + integration + architectural (FIT-16) levels.
- **Group 2 (Architecture)**: `findReservedSibling` lives in `schema-discovery.ts` (design's own File Changes row explicitly assigns "reserved-name sibling files" discovery to this module — not a freelanced location). `checkReservedNames` in `context.ts` mirrors the existing `validateAtRunBoundary` pattern (same file, same read-path posture, same helper reuse) rather than inventing a parallel convention. FIT-16 reuses the SAME `findReservedSibling` function the runtime throw uses (SEC-2 hybrid intent: one discovery function, two enforcement surfaces) rather than a duplicated tree-walk.
- **Group 3 (Code quality)**: No untyped casts. No magic numbers. No TODO/FIXME. No dead code. One genuine bug caught and fixed IN this run (the `hasUntetheredDefineFactory` generic-call substring miss) — not left as a known gap; a fixture doc-comment self-defeat was also caught and fixed (see Deviations item 6 note on TDD evidence, not a separate deviation since it was corrected before landing, not shipped-then-noted).
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

---

## Files Changed — S-001 (Bin CLI Discipline)

| File | Action | What Was Done |
|---|---|---|
| `bin/pbuilder-codegen.ts` | Modified | Added the CLI-only surface: `runCli(argv)` (usage/`--help`/bad-flag discipline, exit codes), `assertWriteContained` (SEC-4/TFO-05 — `realpathSync`-anchored containment against the invoking process's project root, symlink-safe via `realpathNearestExisting`), `formatParseError` (TW-m6 pinned template + ADR-0027 Gap-8 `(position unknown)` fallback), `WriteContainmentRefusal` error class. `generateSchema()` itself is UNCHANGED (containment lives only at the `import.meta.main` entry point, per S-000's own note that it was deliberately deferred here) — the existing S-000 unit test that calls `generateSchema()` against an `os.tmpdir()` path (outside the repo) still passes unmodified. |
| `test/support/canary.ts` | Created | Shared canary helper (SEC-5): `canaryToken`, `seedSchema`, `spawnCapture` (stdout/stderr captured separately). Consumed by `codegen-cli.test.ts` now; `canaryToken` is unused until S-003/S-005 — established now to match the existing `rejection-messages.ts` shared-infra precedent named in the slice's own task list. |
| `test/bin/codegen-cli.test.ts` | Created | CLI e2e (spawns the BUILT `dist/bin/pbuilder-codegen.js` via explicit `bun <path>`, ADR-0027 Gap 9): usage discipline (FPS-05.1), TFO-03.1/.2 static package.json checks, FPS-01.1 discovery, TFO-04.1-.6 malformed/success/stream/locator/non-destructive/no-raw-echo, TFO-05.1-.3 write containment (relative-escape, symlink-escape, schema-content-independence), TFO-01/SEC-1 hostile-schema emitter-inertness red-proof. Self-building via an unconditional `beforeAll` (own judgment call beyond the literal iteration-4 pin — see Deviations). |
| `test/bin/codegen-static-scan.test.ts` | Created | TFO-03.3: scans the shipped `dist/bin/pbuilder-codegen.js` text for `eval(`, `new Function(`, and non-literal-argument `import()`/`require()` calls. Self-building `beforeAll` (pinned, iteration-4 literal). |
| `test/fitness/fit-14-package-surface.test.ts` | Created | FIT-14: diffs `package.json#exports`/`#files`/`#bin`/`dependencies` and a real `bun pm pack --dry-run` listing against the committed baseline. Self-building `beforeAll` (pinned). |
| `test/fitness/pkg-surface-baseline.json` | Created | Committed baseline snapshot (`{exports, files, bin, shebang, tarball}`, Gap 11) — regenerated once more in the S-002 run (see below) when the new `schema-sufficiency.ts` dist artifacts legitimately entered the tarball. |
| `test/fitness/fit-15-bin-core-direction.test.ts` | Created | FIT-15: resolves every relative import specifier under `src/**` against its resolved target and flags any landing inside the repo-root `bin/` directory (a real path resolution, not a textual `"bin/"` substring check — avoids false positives on unrelated package specifiers). |

## Files Changed — S-002 (Schema Contract Fitness)

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-sufficiency.ts` | Created | `checkSufficiency(raw)` — hard-fail rules (REQ-SCP-02) over the RAW wrapped wire shape directly (not the narrowed `Schema` array — see Deviations for why), safe `Object.keys` iteration (constraint 5). |
| `src/core/schema/index.ts` | Modified | Barrel export for `checkSufficiency`/`SufficiencyFinding`/`SufficiencyReason`. |
| `test/support/scan-roots.ts` | Created | `ALWAYS_ON_SCAN_ROOTS = ["test/fixtures/typed-factory"]` — the single shared always-on-walk allowlist FIT-12 (this slice) and FIT-16 (S-004) both import (design §4.6a). |
| `test/fitness/fit-12-schema-parity.test.ts` | Created | FIT-12: `checkParity(packageDir)` — extracts the embedded `@schema-digest` from the committed `schema.generated.ts`, recomputes `schema.json`'s current digest, compares. Read-only (no scratch regeneration needed — see Deviations). Always-on walk over `ALWAYS_ON_SCAN_ROOTS`; red-proofs call `checkParity` directly against `test/fixtures/red/schema/{staled-digest,label-only-drift}/`. |
| `test/fixtures/red/schema/staled-digest/{schema.json,schema.generated.ts}` | Created | Permanent red fixture: committed `schema.generated.ts` carries a deliberately-wrong embedded digest (REQ-SCP-01.1). |
| `test/fixtures/red/schema/label-only-drift/{schema.json,schema.generated.ts}` | Created | Permanent red fixture: `schema.generated.ts` committed against an earlier `label` value; the adjacent `schema.json` has since been label-edited without regenerating (REQ-SCP-01.3 — digest catches label-only drift a compiled-type-text diff could not). |
| `test/fitness/fit-13-schema-sufficiency.test.ts` | Created | FIT-13: direct-call matrix (not a tree-walk, design §4.6a) — missing-type, missing-label, enum-missing-choices (absent AND empty-array), nonsensical-type (+ value echoed), three forbidden-key variants (`__proto__`/`constructor`/`prototype`), advisory-fields-pass, safe-iteration-around-`__proto__` proof. |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added the three new `dist/core/schema/schema-sufficiency.*` entries to the committed `tarball` list — FIT-14 correctly caught this as real drift on the first full-suite run after S-002; updated because these are this change's own legitimate additions, not a leak. |

## TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| CLI usage/argv/containment surface | `codegen-cli.test.ts` (whole file, 16 cases) | e2e | `SyntaxError: Export named 'USAGE' not found in module '.../bin/pbuilder-codegen.ts'` — confirmed by reverting `bin/pbuilder-codegen.ts` to its S-000 shape via `git stash` and re-running the new test file before implementing, then restoring | done | usage (no-args/bad-flag/--help), success, malformed (invalid-JSON + truncated-JSON fallback), non-destructive re-run, containment (relative-escape/symlink-escape/schema-content-independence), hostile-schema — 16 distinct cases across the CLI surface | none needed |
| static-scan | `codegen-static-scan.test.ts` (7 cases incl. 4 red-proofs) | architectural | new file — first run fails as "module not found" until created (file did not exist prior to this slice) | done | eval / new Function / non-literal import / literal-import-not-flagged — 4 direct red-proof cases | none needed |
| FIT-14 | `fit-14-package-surface.test.ts` (10 cases incl. 3 red-proofs) | architectural | new file — same "did not exist" RED | done | exports/files/bin/deps/shebang/tarball-new/tarball-missing — 7 real-state cases + 3 simulated-array red-proofs | none needed |
| FIT-15 | `fit-15-bin-core-direction.test.ts` (28 cases incl. 3 red-proofs) | architectural | new file — same "did not exist" RED; per-file assertions over the full `src/**` walk (24 files at slice time) | done | relative-escape-into-bin / bare-specifier-false-positive-guard / stays-within-src — 3 red-proofs | none needed |

## TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| FIT-12 | `fit-12-schema-parity.test.ts::REQ-SCP-01.1/.2/.3/.4` (5 cases) | architectural | new file — "did not exist" RED; the two `test/fixtures/red/schema/*` fixtures are hand-constructed with deliberately-mismatched digests (verified by inspection: the fake digest cannot collide with a real SHA-256 of different content) | done | staled-digest (raw mismatch) + label-only-drift (SOURCE-content mismatch despite same conceptual "type shape") — 2 distinct staleness classes | none needed |
| `schema-sufficiency.ts` | `fit-13-schema-sufficiency.test.ts` (11 cases) | unit(architectural, direct-call) | new file/function — "did not exist" RED | done | missing-type / missing-label / enum-missing-choices (absent + empty-array, 2 cases) / nonsensical-type / 3× forbidden-key / advisory-pass / multi-property-pass / safe-iteration-around-proto — 11 cases spanning every REQ-SCP-02 branch | none needed |

## In-Loop Fix — REQ-TFO-04.4 Position Locator (design §4.16, ADR-0032)

`verify-in-loop-2` HALTED (SPEC) on REQ-TFO-04.4: Bun's `JSON.parse` (JavaScriptCore) never
emits an `at position N` byte offset, so `schema-parse.ts`'s old `locateFromSyntaxError` regex
was dead — every malformed fixture fell into the `(position unknown)` fallback and the
scenario's "position known" branch never fired. Owner ruling: re-design, not re-spec. Design
rev 6 (§4.16) + ADR-0032 pin a hand-rolled, zero-dep JSON syntax scanner. Implemented exactly
that amendment — no other shipped module touched.

### Files Changed — In-Loop Fix

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-locate.ts` | Created | `locateFirstJsonSyntaxError(raw)` — pure minimal left-to-right JSON syntax scanner (whitespace/structural/string/number/keyword, legal-next-token state). Returns the 1-based `{line,column}` of the first grammar deviation (structural classes: premature EOF, unquoted/non-string key, trailing comma, malformed number/keyword — all MUST-pin per ADR-0032), or `undefined` when the scanner completes without finding one (in-string escape violations — bounded fidelity, deliberately not validated — or a defensive scanner/`JSON.parse` divergence). |
| `src/core/schema/schema-parse.ts` | Modified | Catch branch: deleted the dead `locateFromSyntaxError` (regex on `err.message`); now calls `locateFirstJsonSyntaxError(raw)` when `err instanceof SyntaxError`. `SchemaParseFailure.line`/`.column` populate from the new locator. Message formats unchanged (`formatParseError` in `bin/pbuilder-codegen.ts` reads the same fields, untouched). |
| `test/skeleton/schema-locate.test.ts` | Created | Direct-call unit coverage: position-known (single-line unquoted-key, multi-line — falsifies a column-only implementation, EOF/truncation, empty document, trailing comma, malformed number) and fallback (bad `\u` escape fixture, invalid escape char) — 8 cases. |
| `test/skeleton/schema-parse.test.ts` | Modified | The pre-existing "and a line/column locator" test asserted only `.problem` (the exact gap `verify-in-loop-2` flagged as evidence of the untested claim in its own name) — now asserts the real `.line`/`.column` the locator pins for its fixture. |
| `test/bin/codegen-cli.test.ts` | Modified | TFO-04.4's single all-`(position unknown)` assertion REPLACED with two tests: a structural fixture asserting a concrete `(line 4, column 15)`, and the bounded in-string-escape fixture asserting `(position unknown)`. |
| `test/fixtures/red/schema/malformed-syntax/schema.json` | Created | Permanent multi-line red fixture (unquoted `BOGUS` value) — position-known class, shared by the unit test (direct read) and the CLI e2e test (seeded into a scratch dir). Deliberately multi-line to falsify a column-only locator. |
| `test/fixtures/red/schema/bad-unicode-escape/schema.json` | Created | Permanent red fixture (`"\uZZZZ"`) — fallback class, same dual-surface sharing. Verified empirically: `JSON.parse` throws (`"\uZZZZ" is not a valid unicode escape`) while the scanner reports the string well-formed structurally, per ADR-0032's bounded fidelity. |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added the three new `dist/core/schema/schema-locate.*` entries FIT-14 correctly flagged as real drift on the first full-suite run after this fix — this change's own legitimate addition, not a leak. |

### TDD Cycle Evidence — In-Loop Fix

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `schema-locate.ts` | `schema-locate.test.ts` (whole file, 8 cases) | unit | `error: Cannot find module '../../src/core/schema/schema-locate.ts'` (module did not exist; confirmed via a `git stash` of the new module before writing tests) | done | position-known: unquoted-key / multi-line / EOF / empty / trailing-comma / malformed-number (6 structural classes, all six matching `verify-in-loop-2`'s own empirical probes); fallback: bad-`\u`-escape / invalid-escape-char (2 cases) — 8 total | none needed |
| `schema-parse.ts` rewire | `schema-parse.test.ts::...a line/column locator...` | unit | pre-existing test passed trivially before this fix (never asserted `.line`/`.column` — exactly the gap `verify-in-loop-2` named); added real assertions, confirmed they'd fail against the OLD dead-regex implementation before rewiring (verified via the empirical Bun probes in ADR-0032, not by literally reverting) | done | shares the scanner's own triangulation; single wiring-point case sufficient at this layer | none needed |
| CLI e2e wiring | `codegen-cli.test.ts::parse failure carries a concrete...` + `::...falls back to (position unknown)...` | e2e | old single test asserted `(position unknown)` unconditionally — replacing it with a concrete-locator expectation against the OLD implementation would fail (dead regex never matched under Bun); confirmed the split assertions against real bin output post-fix | done | 2 fixture classes (structural, in-string-escape) — both branches now genuinely reachable | none needed |

**Empirical verification (not fabricated)**: every new position-known assertion was checked
against BOTH `JSON.parse`'s real Bun 1.3.11 throw AND `locateFirstJsonSyntaxError`'s actual
output before being pinned in a test (see the six `verify-in-loop-2` probe shapes, all now
covered: unquoted key, trailing comma, EOF/truncation, empty document — plus a multi-line case
and a malformed-number case beyond the original six).

### Post-Fix Audit (Step 7c, self-run)
- **Group 1**: REQ-TFO-04.4 both branches (position-known, fallback) now have passing tests exercising real locator output — the exact gap `verify-in-loop-2` HALTED on is closed.
- **Group 2 (Architecture)**: `schema-locate.ts` is a pure sibling module inside the already-planned `src/core/schema/` cluster (design §4.2c "aligns", no new boundary — matches the design's own "Architecture impact of this amendment: none"). Not exported from the barrel `index.ts` — it is an internal wiring detail of `schema-parse.ts` only, consistent with ADR-0032's "single wiring point" framing; the runtime/bin consumers read `SchemaParseFailure.line/.column`, never the locator directly.
- **Group 3 (Code quality)**: No untyped casts. No magic numbers beyond the JSON grammar's own literals (`true`/`false`/`null`, 4/5-char lengths for `startsWith` offsets — inherent to the grammar, not arbitrary). No TODO/FIXME. No dead code — the old `locateFromSyntaxError` and its regex are fully deleted, not left inert.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

## Deviations from Design

Carried forward from S-000 (items 1-4, unchanged — see prior entries below), plus this run's:

5. **`bin/pbuilder-codegen.ts`'s CLI e2e test (`codegen-cli.test.ts`) gained its own
   self-building `beforeAll`** (`spawnSync("bun", ["run", "build"])`), even though the
   slices' "Self-building artifact tests" load-bearing literal (iteration-4 pin) names only
   `fit-14-package-surface.test.ts` and `codegen-static-scan.test.ts`. Reasoning: the CLI
   test also spawns the DIST artifact (per ADR-0027 Gap 9, ALL CLI e2e spawns target
   `dist/bin/pbuilder-codegen.js`), and `bin/codegen-cli.test.ts` sorts alphabetically
   BEFORE `bin/codegen-static-scan.test.ts` — on a fresh checkout with no prior build, a
   bare `bun test` would hit the CLI test first with no `dist/bin` yet to spawn, breaking
   constraint 10's "a bare `bun test` on a fresh checkout stays green" guarantee. Flagged,
   not silent — this fills what looks like a narrow gap in the pin rather than contradicting
   it (the pin says those two files self-build; it does not say a third file may not).
2. **Write-containment (`assertWriteContained`) is a CLI-entry-point-only concern**,
   deliberately NOT folded into `generateSchema()` itself — confirmed necessary (not just a
   style choice) because the pre-existing S-000 unit test
   (`test/bin/pbuilder-codegen.test.ts`) calls `generateSchema()` against an
   `os.tmpdir()`-rooted scratch dir, which sits OUTSIDE any plausible repo-root anchor;
   folding containment into `generateSchema()` would have broken that already-committed
   test. This matches S-000's apply-progress's own forward note that containment was
   deliberately deferred to S-001 "not implemented here."
3. **The TFO-05.2 symlink-escape fixture is constructed AT TEST TIME**
   (`symlinkSync` inside the test, cleaned up in `finally`), not committed as a static
   fixture under `test/fixtures/red/**` as the design's File Changes row for that directory
   might suggest. A symlink whose target must resolve OUTSIDE the repo cannot be committed
   portably across machines/CI (the external target path would need to exist at that exact
   location on every checkout). Dynamic construction against `os.tmpdir()` is the portable
   equivalent and proves the identical `realpathSync`-containment code path.
4. **SUPERSEDED by the In-Loop Fix above (ADR-0032)** — `verify-in-loop-2` correctly rejected
   this self-adjudication as an Executor call that belonged to the Planner. The owner ruled
   RE-DESIGN; the position-carrying branch is now genuinely reachable via a hand-rolled
   scanner. Original note kept verbatim below for the record, not because it still holds:
   **REQ-TFO-04.4's "position-carrying" fixture branch is unreachable under this project's
   actual runtime** — verified empirically (multiple malformed-JSON shapes tried via `bun
   -e`): Bun's `JSON.parse` (JavaScriptCore) NEVER emits an "at position N" style message,
   unlike V8/Node, which the pre-existing `schema-parse.ts` `locateFromSyntaxError` regex
   (`/at position (\d+)/`, S-000-owned, out of this slice's scope) assumes. Every malformed
   fixture therefore falls into the `(position unknown)` fallback branch in practice. This
   does not violate REQ-TFO-04.4 itself (which only requires "a locator... never raw
   content" — the pinned fallback token IS a valid locator) but means the DESIGN's §4.14
   Gap-8 instruction to test both a "position present" and a "position absent" fixture
   cannot be literally satisfied; `codegen-cli.test.ts` tests the fallback branch only, with
   an inline comment explaining why, rather than inventing an artificial "position present"
   case that misrepresents actual runtime behaviour. Not a HALT-worthy issue: REQ-TFO-04.4
   is still fully satisfied, and the dead V8-style regex in `schema-parse.ts` is harmless
   (an inert branch) — out of this slice's scope to remove (S-000-owned, already `[x]`).
5. **`checkSufficiency` re-parses `raw` schema.json text itself** rather than consuming the
   already-parsed `Schema`/`SchemaProperty` array from `schema-parse.ts`. The narrowed
   `SchemaProperty.type: SchemaKind` (non-optional) makes an absent/garbage `type` value
   impossible to distinguish at the type level without a `TS2367`-triggering comparison;
   sufficiency's entire job is auditing data that may NOT conform to that narrowed shape
   (that's what "insufficient" means). A small, self-contained raw-JSON walk (mirroring
   `schema-parse.ts`'s own `isPlainObject` checks) avoids fighting the type system for what
   is a legitimately different concern — validating the schema DEFINITION's completeness,
   not lifting trusted data into a strict model. Matches the design's own File Changes table
   treating `schema-sufficiency.ts` as an independent module.

## Post-Slice Audit (Step 7c, code-audit.md `slice` mode, self-run — architecture.adrs non-empty: ADR-0027..0031)

### S-001
- **Group 1**: TFO-03(.1-.3), TFO-04(.1-.6), TFO-05(.1-.3), FPS-01(.1), FPS-05(.1) — implementing code + asserting test present for each. TFO-01 SEC-1 row's hostile-schema CLI-level red-proof present (constraint 2's S-001-owned half).
- **Group 2 (Architecture)**: `bin/pbuilder-codegen.ts` still imports only `src/core/schema/*` (verified structurally + by FIT-15 passing against the real tree). No `src/` module imports `bin/` (FIT-15 self-check green). Containment logic stays CLI-entry-only, never leaking into the shared `generateSchema()` core. No ADR-0027/0029/0031 contradictions found.
- **Group 3 (Code quality)**: No untyped casts. `WriteContainmentRefusal` sets `this.name` matching the existing `AuthoringError`/`EmitRejection`/`SchemaParseFailure` convention (fixed during self-audit, not left as a first-pass gap). No magic numbers, no TODO/FIXME, no dead duplicates.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

### S-002
- **Group 1**: SCP-01(.1-.4), SCP-02(.1-.6) — implementing code + test present for every scenario, including both empty-array and absent-choices sub-cases for SCP-02.3 and both `constructor`/`prototype` variants alongside `__proto__` for SCP-02.5 (the REQ names all three; each gets its own case, not just the headline `__proto__`).
- **Group 2 (Architecture)**: `schema-sufficiency.ts` lives inside `src/core/schema/`, joins the existing cluster (design §4.2c "aligns"). No `Map<string,*>`/`Record<string,*>`/`tree` field introduced (would be caught by FIT-07's recursive walk if it were). No cross-module coupling beyond what's declared.
- **Group 3 (Code quality)**: The one `as unknown` cast (`JSON.parse(raw) as unknown`) is a WIDENING cast from `JSON.parse`'s `any` return down to `unknown` — the safe direction, not the banned `as unknown as X` narrowing-smuggle pattern; immediately followed by real runtime type guards (`isPlainObject`, `typeof`). No magic numbers, no TODO/FIXME, no dead duplicates. `test/fitness/pkg-surface-baseline.json` updated in the SAME run that introduced the drift it now reflects (not left stale for a future slice to trip over).
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

---

## [Prior run] S-000 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-model.ts` | Created | `SchemaKind`/`SchemaProperty`/`Schema` types (array, not Record — FIT-07 clean); `RESERVED_LIFECYCLE_NAMES` |
| `src/core/schema/schema-parse.ts` | Created | Wrapped `schema.json` bytes -> `Schema`; fail-closed on invalid JSON / missing `"properties"`; position locator (Gap 8); no raw-content echo |
| `src/core/schema/schema-validate.ts` | Created | S-000 scope: the "missing required key" finding only (RBV-01.1 site proof); safe iteration via `Object.hasOwn` over the schema's own declared properties |
| `src/core/schema/schema-discovery.ts` | Created | `schemaPathFor(packageDir)` — fixed adjacent-location discovery, no path argument |
| `src/core/schema/schema-digest.ts` | Created | SHA-256 of schema bytes via `node:crypto` |
| `src/core/schema/input-rejection.ts` | Created | Finding -> pinned REQ-AEC-09 message, thrown as a plain `Error` (constraint 1 — NO `AuthoringError` interim) |
| `src/core/schema/index.ts` | Created | Barrel for the cluster |
| `bin/emit-type.ts` | Created | Schema + digest -> `export type Input` text; escaping emitter (SEC-1: JSON.stringify all schema-derived strings, identifier allow-list for property keys, `*/`-guarded labels) |
| `bin/pbuilder-codegen.ts` | Created | `generateSchema(packageDir)` core (discover/read/parse/emit/write) + minimal CLI entry. Write-containment (TFO-05/SEC-4) and the full argv/exit/stream matrix are explicitly S-001's scope, not implemented here |
| `src/core/context.ts` | Modified | `defineFactory<O>(fn, options?: { packageDir })`; pre-`als.run` schema-conformance check when `packageDir` is threaded; bare `defineFactory(fn)` unchanged (untyped opt-out, REQ-TFO-02) |
| `package.json` | Modified | Added `#bin` field (`pbuilder-codegen`); extended `build` script with the `bun build bin/pbuilder-codegen.ts ...` step (not executed by the agent — session rule: never run `bun run build`) |
| `tsconfig.json` | Modified | Added `test/fixtures/red/**` to `exclude` (constraint 11, pre-empting S-001+'s red fixtures) |
| `test/fixtures/typed-factory/schema.json` | Created | Reference schematic schema (`port: number, required`) |
| `test/fixtures/typed-factory/schema.generated.ts` | Created | Generated via the real bin (`bun run bin/pbuilder-codegen.ts test/fixtures/typed-factory`); digest parity verified against the committed `schema.json` |
| `test/fixtures/typed-factory/factory.ts` | Created | Reference schematic factory using the schema-derived `Input` type |
| `test/e2e/typed-factory.e2e.test.ts` | Created | Outer-loop e2e (FPS-04.1, TFO-01.1, RBV-01.1 site proof) — happy path + reject variant against `ContractFake` |
| `test/types/typed-factory-options.test.ts` | Created | TFO-01.2 mutation-resistant `@ts-expect-error` proof (verified real by round-tripping the directive) + TFO-02.1 untyped-opt-out compile proof |
| `test/fitness/fit-07-no-tree-in-core.test.ts` | Modified | Recursive walk (ARCH-1) so `src/core/schema/**` is covered; surfaced two real `Record<string,...>` heuristic hits (fixed by switching to index-signature type syntax, not by weakening the checker) |
| `test/skeleton/{schema-parse,schema-digest,schema-validate,schema-discovery,input-rejection}.test.ts` | Created | Unit-level RED-GREEN coverage per module |
| `test/bin/{emit-type,pbuilder-codegen}.test.ts` | Created | Unit-level RED-GREEN coverage for the bin's core logic |

## [Prior run] S-000 — TDD Cycle Evidence

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| schema-parse.ts | `schema-parse.test.ts::lifts a wrapped schema.json...` | unit | `Cannot find module '.../schema-parse.ts'` | done | n/a — pure mapping, single case | none needed |
| schema-parse.ts (malformed) | `schema-parse.test.ts::throws SchemaParseFailure...invalid JSON` | unit | same module-not-found | done | 2 cases (invalid JSON, missing "properties") | none needed |
| schema-digest.ts | `schema-digest.test.ts::returns the SHA-256 hex digest` | unit | `Cannot find module '.../schema-digest.ts'` | done | 2 cases (determinism + byte-change) | none needed |
| schema-validate.ts | `schema-validate.test.ts::returns a 'missing' finding...` | unit | `Cannot find module '.../schema-validate.ts'` | done | 3 cases (missing / present / required:false) | none needed |
| schema-discovery.ts | `schema-discovery.test.ts::resolves schema.json adjacent...` | unit | `Cannot find module '.../schema-discovery.ts'` | done | n/a — single deterministic join | none needed |
| input-rejection.ts | `input-rejection.test.ts::renders a 'missing' finding...` | unit | `Cannot find module '.../input-rejection.ts'` | done | n/a — one finding kind this slice | none needed |
| bin/emit-type.ts | `emit-type.test.ts::emits the AUTO-GENERATED header...` | unit | `Cannot find module '.../emit-type.ts'` | done | 7 cases (header/required/optional/enum/label/quoted-key/hostile-label) | none needed |
| bin/pbuilder-codegen.ts | `pbuilder-codegen.test.ts::reads the adjacent schema.json...` | unit | `Cannot find module '.../pbuilder-codegen.ts'` | done | n/a — single integration path this slice | none needed |
| context.ts (run-boundary) | `typed-factory.e2e.test.ts::rejects a resolved input missing...` | e2e (outer loop) | assertion failure: expected `invalid input: port must be number`, got `changes could not be applied: unrepresentable-content` (proved the OLD emit-seam site fired, not the new run-boundary site) | done | n/a — S-003 triangulates the rest of the RBV-01 matrix | none needed |
| fit-07 recursive walk | `fit-07-no-tree-in-core.test.ts::recursively covers nested subdirectories...` | architectural | `toContain "schema/schema-model.ts"` failed — non-recursive scan returned only top-level files | done | n/a — structural walk fix | surfaced 2 real `Record<string,...>` hits in the new code, fixed via index-signature syntax (not by weakening the checker) |
| test/types/typed-factory-options.test.ts (TFO-01.2) | compile-time `@ts-expect-error` | unit(type) | manually verified the underlying `TS2339` fires when the directive is removed, then restored it | done | n/a — single mutation scenario | none needed |

## [Prior run] S-000 — Deviations from Design

1. **`schema-validate.ts` created in S-000**, not named in the slices task's compressed directory-group notation (`schema/{schema-model,schema-parse,schema-discovery,schema-digest,input-rejection,index}.ts`). Judgment call: S-000's own acceptance criteria requires a "missing required key" rejection at the run boundary, and `input-rejection.ts` only maps findings — something has to produce the finding. Created `schema-validate.ts` now with ONLY the `missing` finding kind (strict-TDD minimal), matching design's own File Changes table (which lists it as a Create with no slice tag) and its own task-list phrasing for S-003 ("triangulation" of the rest of the RBV-01 matrix into this same file). Flagged here per the Craftsman preamble rule — not a silent deviation.
2. **`bin/pbuilder-codegen.ts`'s CLI argv/exit/stream matrix and write-containment (TFO-05) are intentionally NOT implemented in S-000** — S-001 owns `test/bin/codegen-cli.test.ts` (the full spawn-based CLI suite) per its own task list. S-000 ships the core `generateSchema()` function (discover/read/parse/emit/write) plus a minimal `import.meta.main` entry point, sufficient to manually generate the committed fixture and prove the emitter is correct from day 1 (constraint 2). This is staged rollout per the signed slices plan, not scope-cutting.
3. **`context.ts`'s non-ENOENT read-error handling treats every read failure the same as "no schema.json"** (silently skips validation) — this is INTENTIONALLY the S-000 minimum; the RBV-05 non-ENOENT fail-closed distinction (EACCES etc. must FAIL CLOSED, never degrade to the opt-out) is S-003's explicit task. Documented inline in `context.ts` so the gap is visible to the next reader, not a silent landmine.
4. Removed a first-draft over-scope: I initially wrote the full `@example`/`@param`/`@remarks` JSDoc block onto `defineFactory` (S-005's task), including a `@remarks` describing reserved-lifecycle-name behaviour that S-004 has not built yet. Caught and reverted before commit — replaced with a plain comment; the structured JSDoc (and its dedicated `definefactory-jsdoc.test.ts` proof) is deferred to S-005 as designed.

## [Prior run] S-000 — Post-Slice Audit

- **Group 1 (subset)**: TFO-01(.1,.2), TFO-02(.1), RBV-01(.1), FPS-01(.1) — implementing code + asserting test present for each. FPS-04(.1) — covered for the "runs end-to-end, commits" clause; the FIT-12/FIT-13-passing sub-clause is out of scope until S-002 lands those gates (matches S-000's own acceptance text, which only claims run+commit, not the fitness-gate clause).
- **Group 2 (Architecture)**: No layer violations (bin imports `src/core/schema/*` only, never the reverse — FPS-03 direction holds even though FIT-15 itself lands in S-001). No ADR contradictions found against ADR-0027/0029/0031's Decision sections. Known, plan-declared gaps (write-containment SEC-4, non-ENOENT fail-closed SEC-3) are S-001/S-003 tasks per slices.md, not omissions introduced here.
- **Group 3 (Code quality)**: No untyped casts (`as any`/`as never`/`as unknown as X`) introduced. No magic numbers. No TODO/FIXME markers (deferred behaviour documented via prose comments naming the owning future slice, matching the codebase's existing convention). No dead duplicates.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

## [Prior run] Test Evidence (cumulative, after S-000..S-004 + the ADR-0032 in-loop fix)

`bun test` (full suite): **543 pass, 0 fail, 893 `expect()` calls, 74 files** (prior baseline
after S-000/S-001/S-002 + the in-loop fix was 482 pass / 71 files; +3 files this run —
`run-boundary-validation.test.ts` (13), `reserved-lifecycle-names.test.ts` (9),
`fit-16-reserved-name-scan.test.ts` (8) — plus extensions to `schema-validate.test.ts` (+11),
`input-rejection.test.ts` (+7), `schema-discovery.test.ts` (+8)).
`bunx tsc --noEmit`: clean (no output, exit 0).
`bun run build`: not run this pass (session rule — never `bun run build`; no bin/ files
touched this run, so the dist artifact is unaffected).

Per-slice isolated runs (also green, confirming no cross-slice file-order dependency):
- `bun test test/skeleton/schema-validate.test.ts` — 19 pass
- `bun test test/skeleton/input-rejection.test.ts` — 9 pass
- `bun test test/skeleton/schema-discovery.test.ts` — 9 pass
- `bun test test/skeleton/run-boundary-validation.test.ts` — 13 pass (new)
- `bun test test/skeleton/reserved-lifecycle-names.test.ts` — 9 pass (new)
- `bun test test/fitness/fit-16-reserved-name-scan.test.ts` — 8 pass (new)
- `bun test test/fitness/fit-07-no-tree-in-core.test.ts` — 24 pass (unaffected — no new src/core/schema files this run, only modified existing ones)

## Test Evidence (cumulative, after S-000..S-005)

`bun test` (full suite): **556 pass, 0 fail, 924 `expect()` calls, 76 files** (prior baseline
after S-000..S-004 + the ADR-0032 in-loop fix was 543 pass / 74 files; +2 files this run —
`test/security/canary-no-echo.test.ts` (10) and `test/fitness/definefactory-jsdoc.test.ts`
(3) — no extensions to existing files' test counts).
`bunx tsc --noEmit`: clean (no output, exit 0).
`bun run build`: not run directly by this agent this pass (session rule — never `bun run
build`); the two new test files each self-build the `dist/bin` artifact via their own
unconditional `beforeAll` (established `codegen-cli.test.ts`/`fit-14` pattern), which the
full-suite run above already exercised successfully.

Per-slice isolated runs (also green, confirming no cross-slice file-order dependency):
- `bun test test/security/canary-no-echo.test.ts` — 10 pass (new)
- `bun test test/fitness/definefactory-jsdoc.test.ts` — 3 pass (new)
- `bun test test/fitness/fit-06-example-jsdoc.test.ts` — unaffected (untouched file; still green in the full-suite run, confirming `defineFactory` is correctly out of its scan scope)

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope (cumulative) | 7 (S-000, S-001, S-002, S-003, S-004, S-005, S-006) |
| Slices complete | 7 |
| Slices in progress | 0 |
| Tasks complete | 36/36 (7 + 6 + 4 + 6 + 5 + 4 + 4) |

## Test Evidence (cumulative, after S-000..S-006 + coordinated AEC amendment code)

`bun test` (full suite): **563 pass, 0 fail, 940 `expect()` calls, 76 files** (prior baseline
after S-000..S-005 was 556 pass / 76 files — no new files this run, only extensions to seven
existing test files: `test/types/authoring-reason.test.ts`, `test/skeleton/authoring-error.test.ts`
(+5), `test/fitness/fit-11-whole-object-leak-scan.test.ts` (+2), `test/skeleton/input-rejection.test.ts`,
`test/skeleton/run-boundary-validation.test.ts`, `test/skeleton/reserved-lifecycle-names.test.ts`,
`test/e2e/typed-factory.e2e.test.ts`).
`bunx tsc --noEmit`: clean (no output, exit 0).
`bun run build`: not invoked directly by this agent — `test/fitness/fit-04-dts-semver-gate.test.ts`'s
own self-building `beforeAll` (session rule respected) produced the fresh `dist/` used to
regenerate `test/fitness/dts-baseline/core.authoring-error.d.ts`.

Per-file isolated runs (also green):
- `bun test test/types/authoring-reason.test.ts test/skeleton/authoring-error.test.ts test/fitness/fit-11-whole-object-leak-scan.test.ts` — 54 pass (sub-scope A)
- `bun test test/skeleton/input-rejection.test.ts test/skeleton/run-boundary-validation.test.ts test/skeleton/reserved-lifecycle-names.test.ts test/e2e/typed-factory.e2e.test.ts test/security/canary-no-echo.test.ts` — 43 pass (sub-scope B)
- `bun test test/fitness/fit-04-dts-semver-gate.test.ts` — 11 pass (baseline regen confirmation)

## Next Step

`/build` full deliverable (S-000..S-006) is COMPLETE — all 7 slices, 36/36 tasks. The coordinated
Stage-2 AEC amendment code (authorized by spec V3, not by this change's own slices.md) is also
complete and green. The change is ready for `sdd-verify --mode=final` per slices.md's own Build
Order ("the CHANGE reaches `sdd-verify --mode=final` + archive ONLY after S-006 lands" — S-006 has
now landed). Two items to flag to the Planner before/at verify-final:
1. A discovered gap in slices.md's S-006 task-list enumeration: `input-rejection.test.ts`'s own
   direct unit assertions needed flipping too (not separately named in the task list, but they
   directly test the two functions S-006 upgrades) — done, not left inconsistent.
2. A stale forward-looking comment in `src/core/context.ts` (~line 100) suggests the schema-read/
   parse-failure path (`malformedSchemaMessage`, REQ-RBV-05) was once expected to upgrade to
   `AuthoringError` in S-006 too. NOT done — the closed `AuthoringReason` enum has no member for
   "schema file itself unreadable/malformed" (distinct from `invalid-input`, which REQ-AEC-07 scopes
   strictly to "resolved input fails schema-derived validation"), and neither S-006's task list nor
   this agent's authorized scope covers it. Left as plain `Error`, matching the closed enum's actual
   coverage — flagging the stale comment for a future cleanup, not resolving it unilaterally.

Note the pre-existing dirty `.sdd/state/stage-4-typed-options.json` observed at session start
(before any change by this agent) — orchestrator-owned, not touched here; flagging again for
orchestrator awareness (carried forward from prior runs).

---

## Final-verify fix batch (GAN iter 2)

**Trigger**: blind verify-final council returned two `needs-iteration` verdicts over four
blocking findings (1 HIGH security, 1 MAJOR, 2 MINOR/mutation-coverage). Scope tightly limited
to these four — the ~8 non-blocking followups from the same council pass are explicitly
untouched here (registered at archive instead).

### Fix 1 — [HIGH, security] Codegen injection via unvalidated `type` field

**Root cause**: `schema-parse.ts` casts `type: value.type as SchemaKind` with zero runtime
validation; `bin/emit-type.ts`'s `emitPropertyType` returned `property.type` verbatim for any
non-`enum` type; `bin/pbuilder-codegen.ts`'s `generateSchema` never consulted
`checkSufficiency` before emitting. A hostile `schema.json` with a `type` value shaped like
`string;\nexport const PWNED = eval(...);\ntype _junk = {...` reached `schema.generated.ts`
verbatim — real top-level TypeScript text injected via a JSON field, breaking the TFO-01/SEC-1
"hostile-schema inertness" contract.

**Fix (two layers, belt-and-suspenders)**:
1. **Primary** — `generateSchema` (`bin/pbuilder-codegen.ts`) now calls `checkSufficiency(raw)`
   after a successful `parseSchema` and throws a new `SchemaSufficiencyFailure` (carrying the
   findings) when any hard-fail finding exists — refusing to emit. `runCli` formats this into
   the standard `pbuilder-codegen: <file>: <reason>` template, never echoing a finding's
   `detail` (the raw offending value) — only property keys surface.
2. **Backstop** — `emitPropertyType` (`bin/emit-type.ts`) now allow-lists `property.type`
   against `RECOGNIZED_KINDS` (newly exported from `schema-sufficiency.ts` as the single
   canonical source, not duplicated) and throws `UnrecognizedPropertyTypeError` on anything
   else — the last line of defence if the primary gate is ever bypassed. `runCli` also handles
   this error type gracefully (same template), so even the backstop path fails closed instead
   of dumping an internal `dist/bin` stack trace.

**Files**: `src/core/schema/schema-sufficiency.ts` (export `RECOGNIZED_KINDS`),
`src/core/schema/index.ts` (re-export), `bin/emit-type.ts` (allow-list guard +
`UnrecognizedPropertyTypeError`), `bin/pbuilder-codegen.ts` (`SchemaSufficiencyFailure` +
wiring + `runCli` catch branches + `describeSufficiencyFinding`/`formatSufficiencyError`).

**Tests (RED confirmed before the fix, GREEN after)**:
- `test/bin/emit-type.test.ts` — 3 new: injection payload throws; `type: "any"` (silent-widening)
  throws; thrown message names the field, never echoes the injected value.
- `test/bin/codegen-cli.test.ts` — 2 new: hostile `type` refused before any write, generated
  file absent, stderr never contains the payload AND never a raw stack trace (asserts the
  `pbuilder-codegen: ` prefix, no ` at ` frames, no `dist/bin`); `type: "any"` rejected the
  same way.

### Fix 2 — [MAJOR, QA] Deep-nesting RangeError breaks the fail-closed message contract

**Root cause**: `locateFirstJsonSyntaxError` (`schema-locate.ts`) is recursive; a ~120KB
`"[".repeat(120000)+"@"` schema overflows the call stack. The locator was invoked UNGUARDED
inside `schema-parse.ts`'s `catch` — the resulting `RangeError` is not a `SchemaParseFailure`,
so it propagated raw: the runtime path surfaced `RangeError: Maximum call stack size exceeded`
instead of the REQ-RBV-05.1 literal, and the bin path dumped the internal `dist/bin` stack.
Reproduced pre-fix via direct script execution against both `defineFactory` and the built CLI
before writing any test (see verification transcript in this run's tool history).

**Fix**: wrapped the `locateFirstJsonSyntaxError(raw)` call in `schema-parse.ts`'s catch in its
own try/catch — any throw degrades to the existing `(position unknown)` fallback, the same
branch used for a locator that legitimately returns `undefined`. Single point of the fix covers
both call sites (runtime `context.ts` and the bin), since both consume `SchemaParseFailure`'s
`line`/`column` fields.

**Files**: `src/core/schema/schema-parse.ts` (guard only — `schema-locate.ts` itself
untouched, no depth-bound added; the catch is the contract fix per the finding's own
guidance), new fixture `test/fixtures/red/schema/deep-nesting/schema.json` (120001 bytes:
`"[".repeat(120000) + "@"`).

**Tests (RED confirmed before the fix — reproduced the raw `RangeError`/internal stack, GREEN
after)**:
- `test/skeleton/run-boundary-validation.test.ts` — 1 new: asserts the exact REQ-RBV-05.1
  literal with `(position unknown)`, never `Maximum call stack`/`RangeError` in the message.
- `test/bin/codegen-cli.test.ts` — 1 new: asserts exit non-zero, the exact
  `pbuilder-codegen: <file>: invalid JSON (position unknown)` stderr line, no `RangeError`, no
  `Maximum call stack`, no `dist/bin`.

### Fix 3 — [MINOR-MAJOR, QA] Default-required mutation survives (mutation-coverage gap)

**Root cause**: `schema-validate.ts`'s `property.required !== false` (omitted `required` ⇒
required) survived mutation to `=== true` because every existing fixture sets `required`
explicitly (`true` or `false`) — the omitted-`required`-defaults-to-required behaviour was
untested. Production code confirmed CORRECT — this is a coverage gap only, no production
change.

**Fix**: added one test to `test/skeleton/schema-validate.test.ts` — a schema property with
`required` omitted entirely + absent input ⇒ `[{kind:"missing", field:"port",
expectedType:"number"}]`.

**Mutation-kill proof**: applied `property.required === true` to `schema-validate.ts`, ran the
new test — it failed (`[]` instead of the expected `missing` finding, exactly 1 test failure in
the file, all 19 others still green), then reverted. `git diff` on `schema-validate.ts` after
revert is empty (byte-identical restoration confirmed).

### Fix 4 — [MINOR, QA] Locator escape-skip mutation survives (mutation-coverage gap)

**Root cause**: `schema-locate.ts`'s `scanString`'s escape-skip `pos += 2` survived mutation to
`pos += 1` — no fixture placed a backslash-escaped quote before a later syntax error, so
ADR-0032's escape-consumption fidelity was unpinned. Production code confirmed CORRECT — this
is a coverage gap only, no production change.

**Fix**: added one test to `test/skeleton/schema-locate.test.ts` using raw content
`{"a":"x\"y", @}` — asserts the exact `{line: 1, column: 14}` locator result (the `@` after the
comma), proving the escaped quote inside the string value is consumed as one escaped character,
not mistaken for the string terminator.

**Mutation-kill proof**: applied `pos += 1` to `scanString`'s escape branch in
`schema-locate.ts`, ran the new test — it failed (`column: 10` instead of the expected `14`,
exactly 1 test failure in the file, all 8 others still green — the mutant mistook the escaped
`\"` for the string's closing quote, landing on the wrong later token), then reverted. `git diff`
on `schema-locate.ts` after revert is empty (byte-identical restoration confirmed).

### TDD Cycle Evidence — Final-verify fix batch (GAN iter 2)

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Fix 2 (runtime) | `run-boundary-validation.test.ts::a deeply-nested malformed schema.json degrades to the (position unknown) fallback...` | integration | `Expected: "...(position unknown)" / Received: "Maximum call stack size exceeded."` | ✅ | n/a — single guard covers both call sites; the bin-level test is the triangulating case | none needed |
| Fix 2 (bin) | `codegen-cli.test.ts::a deeply-nested malformed schema.json degrades to (position unknown) instead of dumping an uncaught RangeError...` | e2e (spawned built artifact) | received a full `RangeError` stack incl. `dist/bin/pbuilder-codegen.js` frames | ✅ | triangulates Fix 2's single fix point across the runtime/bin split | none needed |
| Fix 1 (unit, injection) | `emit-type.test.ts::throws instead of emitting an unrecognized type verbatim (injection payload)` | unit | "Received function did not throw" — injected text present verbatim in output | ✅ | 2 cases (injection payload + `"any"`) | none needed |
| Fix 1 (unit, widening) | `emit-type.test.ts::throws on the silent-widening variant (type: "any")...` | unit | "Received function did not throw" — `any` emitted verbatim | ✅ | see above | none needed |
| Fix 1 (unit, no-echo) | `emit-type.test.ts::the thrown error names the field but never echoes the injected type value` | unit | `caught` was `undefined` (nothing thrown pre-fix) | ✅ | n/a — assertion-only case | none needed |
| Fix 1 (e2e, injection) | `codegen-cli.test.ts::a hostile type value (injection payload) is refused BEFORE any write...` | e2e | stderr contained a raw `dist/bin` stack trace (`not.toContain("dist/bin")` failed) | ✅ | 2 cases (injection + `"any"`) | none needed |
| Fix 1 (e2e, widening) | `codegen-cli.test.ts::the silent-widening variant (type: "any") is rejected...` | e2e | same raw-stack failure mode | ✅ | see above | none needed |
| Fix 3 | `schema-validate.test.ts::treats an OMITTED required field as required (default-required)...` | unit | test passed immediately (production already correct) — validated instead via mutation-kill (see Fix 3 above) | ✅ | n/a — coverage-gap backfill, not new behaviour | none needed |
| Fix 4 | `schema-locate.test.ts::consumes a backslash-escaped quote as TWO characters...` | unit | test passed immediately (production already correct) — validated instead via mutation-kill (see Fix 4 above) | ✅ | n/a — coverage-gap backfill, not new behaviour | none needed |

### Files Changed

| File | Action | Fix | What Was Done |
|---|---|---|---|
| `src/core/schema/schema-parse.ts` | Modified | 2 | Guard the locator call in a nested try/catch; degrade to `(position unknown)` on any throw |
| `src/core/schema/schema-sufficiency.ts` | Modified | 1 | Export `RECOGNIZED_KINDS` as the canonical allow-list |
| `src/core/schema/index.ts` | Modified | 1 | Re-export `RECOGNIZED_KINDS` from the barrel |
| `bin/emit-type.ts` | Modified | 1 | `emitPropertyType` allow-lists against `RECOGNIZED_KINDS`, throws `UnrecognizedPropertyTypeError` otherwise |
| `bin/pbuilder-codegen.ts` | Modified | 1 | `generateSchema` calls `checkSufficiency` and throws `SchemaSufficiencyFailure` on findings; `runCli` formats both new error types into the standard template |
| `test/fixtures/red/schema/deep-nesting/schema.json` | Created | 2 | 120001-byte deeply-nested fixture (`"[".repeat(120000) + "@"`) |
| `test/skeleton/run-boundary-validation.test.ts` | Modified | 2 | +1 test (runtime deep-nesting fallback) |
| `test/bin/codegen-cli.test.ts` | Modified | 1, 2 | +1 test (bin deep-nesting fallback), +2 tests (hostile-type/widening refusal) |
| `test/bin/emit-type.test.ts` | Modified | 1 | +3 tests (injection throw, widening throw, no-echo) |
| `test/skeleton/schema-validate.test.ts` | Modified | 3 | +1 test (omitted-required mutation-kill) |
| `test/skeleton/schema-locate.test.ts` | Modified | 4 | +1 test (escape-skip mutation-kill) |

### Deviations from Design

None — implementation matches the four findings' prescribed fixes exactly. No production code
was changed for Fix 3 or Fix 4 (both confirmed correct; coverage-gap backfills only), per the
finding's own instruction to halt rather than silently "fix" correct behaviour.

### Halt / Issues Found

None.

### Overall Progress (this fix batch)

| Metric | Value |
|---|---|
| Findings in scope | 4 (1 HIGH, 1 MAJOR, 2 MINOR/MINOR-MAJOR) |
| Findings closed | 4/4 |
| New tests added | 9 |
| Production files modified | 5 |
| Test files modified | 5 |
| New fixtures | 1 |

### Test Evidence

`bun test` (full suite) — **before**: 563 pass / 0 fail / 940 `expect()` calls / 76 files.
**After**: 572 pass / 0 fail / 972 `expect()` calls / 76 files (9 new tests, 0 regressions,
0 new files — all additions extend existing test files except the new fixture).

`bunx tsc --noEmit` — clean, no output, exit 0.

`bun run build` — not invoked directly; `test/bin/codegen-cli.test.ts`'s own unconditional
`beforeAll` self-builds `dist/bin/pbuilder-codegen.js` (established FIT-04 precedent), which the
full-suite run above already exercised for both the pre-existing and new bin-level tests.

### Next Step

All four blocking council findings are closed with killing tests (Fixes 1/2 red-then-green;
Fixes 3/4 validated via mutation-kill-then-revert with byte-identical production diffs). Ready
for the next verify-final iteration (GAN iter 3, or final pass if the council accepts).
