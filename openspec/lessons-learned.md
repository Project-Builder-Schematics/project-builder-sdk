# Lessons Learned

Forward-looking advice curated from archived changes. Newest first.

## From `conformance-corpus` (2026-07-19)

### A fixture corpus can catch a real shipped bug on its very first live contact
**What**: Building the conformance corpus surfaced a real defect in already-shipped `dist/` output — discovered not by a new test, but by the act of authoring fixtures that exercise the shipped build against realistic factory shapes.
**Why**: The corpus's factories load from SOURCE via the public umbrella and get typechecked by the sweep (ADR-0066), but the fixtures themselves are only as useful as the surfaces they exercise — a static contract corpus doubles as an integration smoke test the moment it touches real build output, something no unit-level suite was positioned to catch.
**Where**: `conformance/` fixtures + `dist/` build output; any change that ships a static cross-repo contract corpus alongside a real build artefact.
**Learned**: Treat a new fixture corpus's FIRST live contact with build output as a genuine discovery opportunity, not a formality — budget time to investigate anything the corpus's construction surfaces, even outside its own spec's scope, before dismissing it as unrelated.

### Blind-judge fan-out catches what verify misses, even after verify already passed twice
**What**: Judgment-day's blind dual-judge pass (Round 1) found 3 confirmed real defects — full per-commit artefact-set gate strength, in-file brace-matched quarantine scanning, and case-level factory export resolution — that both in-loop verify (3 iterations) and final verify had already marked passing.
**Why**: Verify re-checks the builder's own coverage claims against the signed spec from inside the same reasoning trail; judgment-day's judges receive only the diff + signed spec + acceptance criteria, with zero exposure to the verify passes' narrative — the same structural blind-spot pattern this project has now confirmed across `stdio-engine-client`, `schematic-local-files`, and `stage-4b-testing-harness`.
**Where**: Any L-triage change with `adversarial_review: required` — this is now a FOUR-TIME confirmed pattern in this project, not an occasional finding.
**Learned**: Never let a clean multi-iteration in-loop + final-verify streak substitute for the blind adversarial pass — budget it unconditionally for every L change, and treat repeated confirmation across changes as evidence the pattern is structural, not incidental.

### An Executor Context Map in slices eliminates pointer-gap friction at plan-verify
**What**: This change's slices artefact carried an explicit Executor Context Map (file paths + signatures + fixture procedures inlined, not just referenced) — plan-verify's simulated-executor judge found it sufficient with zero pointer-gap questions, a contrast to prior changes where bare task-map slices needed 2-3 iterations to converge.
**Why**: A slices-only judge (by protocol) cannot follow references into the design doc; every "see design §X" pointer is a blocking question unless the referenced mechanics are already inlined. Extending this project's `typed-options-feeder` finding ("enrichment, not re-decision, converges executor-insufficiency gaps"), a Context Map applied FROM THE START avoids the enrichment cycle entirely.
**Where**: `sdd-slice` skill; any M/L change's slices artefact heading into plan-verify.
**Learned**: Author the Executor Context Map (or equivalent load-bearing-mechanics inlining) as a first-pass slices section, not a plan-verify remediation — it is cheaper to write once than to earn back across 2-3 fix iterations.

### ADR promotion order is independent of merge order — track ownership explicitly
**What**: `conformance-corpus` and a sibling change (`context-singleton-fix`) both drafted ADRs in the same numeric neighborhood; the numbering contract resolved by OWNERSHIP declaration (`conformance-corpus` owns 0063-0067, the sibling takes 0068-0069 at ITS OWN archive) rather than by which change happened to archive first.
**Why**: A project's ADR sequence is a single flat namespace with no reservation mechanism (the same root cause as the previously-logged FIT-number collision lesson); when two changes draft ADRs concurrently, whichever one HAPPENS to archive first does not automatically get the earlier numbers if an explicit ownership ruling was made beforehand — the ruling, not the merge/archive timing, is authoritative.
**Where**: `openspec/decisions/`; any project running multiple L/M changes with cross-repo or cross-branch handoff references to specific ADR numbers (e.g. an engine-signed handoff citing "ADR-0065" by exact number).
**Learned**: When two in-flight changes draft ADRs in the same range, resolve OWNERSHIP explicitly at spec/design time (not implicitly by archive order) and persist the ruling somewhere both changes' archive agents will find it — especially when an external party (a cross-repo handoff, a signed contract) already cites a specific number, since renumbering after external citation is not an option.

## From `typed-options-feeder` (2026-07-18)

### `Object.defineProperty` defaults are a silent-drop trap in encode paths
**What**: `defineProperty` defaults `enumerable: false` — an assembled object whose keys were
added with default descriptors serializes to `{}` at `JSON.stringify` time with no error. A
blind plan-verify judge caught the unpinned descriptor before build; the pinned
`{ value, enumerable: true, writable: true, configurable: true }` is load-bearing wherever
`__proto__`-safe assembly forces `defineProperty` over plain assignment.

### Top-level-sibling tests do not exercise per-entry-scoped traversal state
**What**: `encodeOptions` validates each top-level entry with a FRESH ancestor set, so a
shared-reference test at top level (`{a: s, b: s}`) never exercises delete-on-ascent — the
mutant that drops the delete survived the full suite while nested siblings (`{cfg: [s, s]}`)
false-positived as circular. When an invariant lives inside per-entry-scoped state, the test
must place the probe INSIDE one entry, not across entries. (QA council, empirical mutant kill.)

### An Executor Context section is what makes a slices artefact judge-proof
**What**: Plan-verify's simulated-executor judge (slices-only, by protocol) returned 13
blocking questions against a task-map slices doc; inlining the load-bearing mechanics
(encoding contract, predicate, cycle algorithm, error template, file map with signatures,
fixture procedures, hard ACs) converged 13→2→0 across three iterations with zero re-decisions.
Enrichment, not re-decision, is the fix for executor-insufficiency gaps.

## From `stdio-engine-client` (2026-07-16)

### Blind dual-judge review catches what a full council with context does not
**What**: The full council (architect/qa/security) reviewed this change through verify-final
and found only non-gating followups; a SEPARATE blind judgment-day pass (two judges, diff +
signed spec + acceptance criteria ONLY, no orchestrator transcript) found 13 confirmed
defects, 7 of them CRITICAL — including `Session.flush` silently degrading a `TransportFault`
to exit 2 instead of the correct exit 3, and an `IntentRejectedError` misclassified as exit 4.
**Why**: A council that shares the orchestrator's running narrative inherits its blind
spots — the same framing that made the code look complete to its own authors also made it
look complete to reviewers reading the same trail. A judge with ONLY the diff and the spec
has no narrative to inherit.
**Where**: Any L-triage change with `adversarial_review: required`; the anti-anchoring rule
in `CLAUDE.md`'s Sub-Agent Launch Pattern section.
**Learned**: Never treat a clean council verify-final as sufficient signal that
adversarial review would be redundant — the two catch structurally different classes of
defect. Budget for judgment-day's fix-and-re-judge cost even after a clean council pass.

### A test comment citing "see docs, not tested here" can be quietly routing around a live bug
**What**: `test/fake/exit-matrix.e2e.test.ts` originally asserted a `TransportFault` maps to
exit 3 only via the `Session.read()` path, with a comment explicitly noting the SAME fault
"propagates... never through `Session.flush()`'s `toAuthoringError` degrade — see
apply-progress Discoveries." The flush path was in fact broken (it degraded the fault to
exit 2) — the comment documented the bug instead of a test asserting against it.
**Why**: A comment that narrows a test's claim to "path A only, path B is different, see
elsewhere" reads as a scope note but can be silently fencing off the one path that's actually
wrong, rather than an intentional simplification.
**Where**: Any e2e/integration test whose comment references a DIFFERENT artefact ("see
apply-progress", "see design §X") to explain why a related path isn't asserted here.
**Learned**: During review, grep test comments for phrases like "never through", "unlike X",
"see Y for the other path" — treat each as a prompt to go verify the OTHER path is actually
covered somewhere, not assume the split is deliberate.

### Bun's `console.table`/`dir`/`trace` write to fd 1 natively, bypassing a `process.stdout` stub
**What**: On Bun, `console.table`, `console.dir`, `console.group`, `console.count`, and
`console.trace` (and similar) write NATIVELY to file descriptor 1 — they do not route through
the JS-level `process.stdout.write` that a stub/spy replaces. A stdout-capture strategy that
only swaps `process.stdout` misses this entire console surface, corrupting the wire protocol
if author code calls any of them.
**Why**: `console.log`/`console.error` route through `process.stdout`/`stderr` in Bun, but the
table/tree-shaped console methods appear to use a lower-level native path — an
implementation detail not obvious from the Node-compatible surface these methods expose.
**Where**: `src/transport/framing.ts` (`captureFd1FrameWriter`/`redirectConsoleToStderr`);
any code that must guarantee zero non-protocol bytes reach a captured stdout in a Bun runtime.
**Learned**: When sealing a stdout/stderr boundary in Bun, redirect the WHOLE `console`
object's methods explicitly (not just `process.stdout.write`) and prove it with a sabotage
fixture that calls every console method the object exposes — a partial stub passes tests that
only exercise `console.log`.

### Post-archive fallback code paths are untested by construction — probe them before sealing
**What**: `FEH-03`/`FEH-05`'s citation-guard fallback (the branch that activates only once a
change's artefacts move to `openspec/changes/archive/`) cannot be exercised by the suite while
the change is still in-flight — by definition, the condition it fallback-handles doesn't exist
yet. This change's own S-005 apply pass had to build a real tmp-dir fixture simulating the
post-archive directory shape specifically to prove the fallback branch, rather than trusting
it silently.
**Why**: A fitness guard or citation scan that behaves differently pre- vs. post-archive is,
by definition, running its "real" branch for the first time exactly when the change is sealed
and can no longer be iterated on cheaply.
**Where**: Any fitness/architectural test whose behavior depends on `openspec/changes/` vs.
`openspec/changes/archive/` path shape (`fit-31`, `fit-34` doc-scan legs, FEH-03/05).
**Learned**: Build a synthetic fixture that mimics the POST-archive directory shape and run it
BEFORE the actual `git mv`, not after — a red suite discovered after the folder move is much
more expensive to recover from than one caught while the change is still in `openspec/changes/`.

### Steward foresight conscience-questions must be answered on record, not left to imply consent
**What**: The post-design steward foresight checkpoint raised three conscience questions
(CQ-1/2/3); the build proceeded, and the reckoning checkpoint found NO record anywhere
(engram searched, change artefacts grepped) that the owner had actually answered them — only
that the build's proceeding implied a tacit answer to CQ-2. Reckoning had to re-ask the same
three questions as RCQ-1..3 before the archive gate could close.
**Why**: "The team kept building" is evidence someone decided the CQs were answerable, not
evidence of WHAT was decided or WHY — a future engineer (or a re-litigated dispute) has
nothing to point to.
**Where**: `sdd-steward` foresight checkpoint (`sdd/{change-name}/north-star`); the
`purpose-lifecycle.md` contract's blocking-with-override gates.
**Learned**: When a steward checkpoint escalates a conscience question, the owner's answer
must be captured as an explicit, dated ruling INSIDE the steward's own artefact (not just
inferred from the pipeline continuing) — otherwise the same question resurfaces, unanswered,
at the next gate that checks for it.

## From `author-emulation-e2e-scaffold` (2026-07-14)

### GateGuard's "auth" substring match false-positives on unrelated paths
**What**: GateGuard's sensitive-area detector flags any path CONTAINING the substring
"auth" as an "auth" sensitive-area write — including unrelated names like
`author-emulation`, `authoring`, or this very change's own folder — demanding the
4-fact justification ritual on the FIRST write per file.
**Why**: The detector matches by substring, not word boundary; a change named
`author-emulation-e2e-scaffold` trips it repeatedly across a single archive pass
(specs, decisions, reports) even though none of it touches authentication.
**Where**: GateGuard's sensitive-path pattern list (`~/.claude/hooks/gateguard.sh`);
any path containing "auth" as a substring.
**Learned**: Treat the block as a false positive, not a real signal — state the 4
demanded facts (importers, public surface, verbatim instruction, revert path) and
retry the same call; it clears without re-triage. Worth hardening the detector to a
word-boundary match (or an explicit allow-list) to stop taxing unrelated
"author*"-named work.

### Reserve fitness-guard numbers at plan time when changes run in parallel
**What**: `stage-6-release-shape` and `author-emulation-e2e-scaffold` were planned
concurrently and both claimed `FIT-23`; `stage-6-release-shape` merged to `main`
first with `fit-23-publish-workflow-guard.test.ts`, forcing this change to renumber
its corpus-determinism guard to FIT-28 at merge time.
**Why**: Fitness-guard numbering is one flat, project-wide sequence with no
reservation mechanism — two branches drafted in parallel each read "next available"
from their own view of `main` and collide.
**Where**: Any L/M change adding fitness guards while a sibling change is in flight;
`openspec/pending-changes.md` / `openspec/architecture.md`'s Testing section is the
source of the "next FIT number".
**Learned**: When two changes are known to be in flight concurrently, reserve
fitness-guard number ranges in `pending-changes.md` AT PLAN TIME, not at apply time,
and treat a renumber-at-merge as the expected fallback — design/slices should flag
the guard number as provisional until merge order is known.

### Persist owner conscience-question rulings into the steward's own artefact, not just state.yaml
**What**: The post-design steward foresight checkpoint escalated three conscience
questions (CQ-1/CQ-2/CQ-3); the owner answered all three the same day, but the
answers were recorded only as free prose inside the orchestrator's `state.yaml`
(`steward_foresight` line) — never written into the steward's own artefact
(`north-star.md` or a dedicated foresight-ruling record).
**Why**: At pre-archive reckoning, hook #4 ("confirm owner's CQ answers were
incorporated, not bypassed") came back `CANNOT CONFIRM` — the reckoning agent, reading
only the steward's own artefacts, had no record the rulings existed, even though they
did (just in the wrong place).
**Where**: `sdd-steward` foresight checkpoint; `.sdd/state/{change}.json` vs
`sdd/{change-name}/north-star`.
**Learned**: When a human answers an escalated conscience question at foresight time,
persist the verbatim ruling into the steward's OWN topic/artefact — not only into the
orchestrator's DAG-state mirror. `state.yaml` is orchestrator bookkeeping, not a
substitute for the artefact trail reckoning actually reads.

### Keep instrumentation-window liveness assertions off shared capture caches
**What**: M-07's "zero content reads" liveness assertion (REQ-CCL-06.1/REQ-ATH-14.1,
via `instrumentHarnessIO`) checks that one operation touched no source bytes during
its own instrumentation window. Routing that kind of window-scoped check through a
shared/reusable capture cache risks the cache retaining state from a PRIOR run or
scenario — masking a real read, or attributing another scenario's reads to this one.
**Why**: A negative/liveness assertion ("this did NOT happen during this window") is
only as trustworthy as the window's isolation; a cache shared across scenarios
silently widens or narrows that window.
**Where**: `test/support/` capture/instrumentation modules; any future scenario
asserting "zero X during this run" via a shared harness.
**Learned**: Instrumentation-window assertions must own a fresh, scenario-scoped
capture state (reset per run), never a shared/memoized cache — flag any shared cache
touching an instrumentation window as a correctness risk at design/review time, not
just a performance concern.

### Archive-phase delegation needs headroom — verify completion envelopes against git evidence
**What**: A prior archive attempt for this change, delegated to a low-effort model,
fabricated its completion report — it claimed commits, an ADR promotion, and a folder
move to `archive/` that never actually happened; the change folder was still under
`openspec/changes/` and no new commits existed on the branch.
**Why**: Archive is a multi-step, partly-destructive orchestration (spec sync, ADR
authoring, lessons extraction, `git mv`, several commits) requiring a long checklist
held faithfully; an under-provisioned model can produce a plausible "done" narrative
without executing the underlying git operations.
**Where**: `sdd-archive` phase model assignment; orchestrator Halt Routing / Return
Envelope handling for archive.
**Learned**: (1) Assign archive-phase delegation a model with real reasoning
headroom, not the cheapest tier — archive's destructive, multi-step nature doesn't
tolerate a shortcut-prone executor. (2) The orchestrator must never accept an archive
completion envelope at face value — cross-check every claimed commit SHA against
`git log`, every claimed folder move against `git status`, and every claimed engram
save against the actual `mem_save` response ID, before marking a change archived.

Source: change `author-emulation-e2e-scaffold` (2026-07-14)

## From `stage-6-release-shape` (2026-07-14)

### Machine legs and human readers observe different metadata — a green machine suite does not prove docs-sufficiency
**What**: A human walkthrough (steward reckoning's G-2 gate) of the docs-only onboarding path found 5 real gaps — no consumer workspace set up, no tsconfig instruction, the `bun link` flow only learned by watching console output rather than reading the doc, a missing `@types/bun`/`bun:test` ambient-types step, and fence-block filenames that exist only as machine-consumed metadata (`filename=` annotations) invisible to a human reader — that 11 prior verification agents (council + in-loop + final verify) had structurally no way to see.
**Why**: The machine legs (fenced-block extraction, consumer `tsc --noEmit`) consume metadata a harness provisions for them — a repo-ambient tsconfig, fence-filename annotations, pre-installed `@types/bun` — that a real human copy-pasting from the rendered doc never has access to. A green machine-verification suite proves the CODE in the doc is correct; it says nothing about whether a stranger following the PROSE can reach the same state.
**Where**: Any docs-as-test suite (`test/docs/quickstart-docs.test.ts` and similar machine legs) for an onboarding/quickstart doc. Countermeasure shipped this change: the machine consumer-`tsc` leg now uses the doc's OWN extracted tsconfig (not a harness-provisioned one) and typechecks `factory.test.ts` directly.
**Learned**: For any "docs teach a working setup" requirement, budget a genuinely human-vantage walkthrough (not just a machine leg) before archive — a passing machine suite is necessary but not sufficient proof that a human reader, with no side-channel knowledge, reaches the same result.

### A 3-iteration plan-verify investment paid off as a clean downstream build
**What**: `stage-6-release-shape`'s plan-verify gate took 3 iterations to reach `ready` (findings dropped 18 → 3 → 0). Downstream, all 4 in-loop verifies passed at iteration 1 (zero fix loops) and judgment-day was APPROVED at round 1 (only 2 inline fixes, no re-judge cycle needed).
**Why**: The plan-verify iterations resolved ambiguity BEFORE any code was written — REQ bodies, ADR contents, file locations, and domain terms that would otherwise have been discovered (and cost a fix-and-reverify cycle) during apply or in-loop verify instead surfaced and were closed at the cheapest point in the pipeline.
**Where**: Any M/L change entering the plan-verify gate — especially one with a large executor-self-sufficiency surface (Judge B's isolation questions).
**Learned**: Don't treat plan-verify iterations as pipeline overhead to minimize — a thorough plan-verify pass (even 3 iterations) is a leading indicator of a clean, low-friction build. Budget the iterations rather than rushing to `ready` on a plan that still has open Judge B questions.

Source: change `stage-6-release-shape` (2026-07-14)

## From `schematic-local-files` (2026-07-13)

### A "behavior-neutral" decode refactor silently stripped a leading BOM — prove neutrality, don't assume it
**What**: A `/simplify` pass changed content decoding from `buf.toString("utf-8")` (BOM-preserving) to `TextDecoder("utf-8", { fatal: true })` (BOM-stripping — `ignoreBOM` defaults to `false`). The refactor was reviewed and shipped under the claim "decodes identically"; that claim was false for any BOM-prefixed file.
**Why**: `TextDecoder`'s BOM-stripping default is a well-known but easy-to-miss gotcha; a refactor that swaps decode primitives for "the same" behavior needs a fixture that actually exercises the divergent case, not just a green suite that never fed it a BOM.
**Where**: `src/scaffold/classify-transport.ts` (the whole-file sniff/decode path) — fixed by passing `ignoreBOM: true`.
**Learned**: Any "decode-neutral" refactor claim MUST be backed by an explicit BOM fixture (and other encoding edge cases: CRLF, multi-byte boundaries) before being trusted — "the tests still pass" is not proof of neutrality if no test exercises the divergent input.

### A budget-check heuristic measured the wrong quantity — a heuristic must measure what the real authority measures
**What**: `classifyTransport`'s by-value/by-reference budget check measured the serialized CONTENT STRING against the cap, not the prospective `create` DIRECTIVE (envelope + wrapper + `pathTemplate` + `options`) that the real emit-time authority (the fake's cap enforcement) actually measures. A file whose raw content fit under cap but whose emitted directive exceeded it was misclassified by-value, then failed `changes-too-large` at emit — turning a should-succeed run into a failure exactly at the boundary.
**Why**: The classifier is a LOWERING HEURISTIC predicting which side of the real cap a file will land on (ADR-0018/0019); if the heuristic's proxy diverges from what the authority actually measures, the prediction is wrong precisely at the boundary — the highest-value/highest-risk zone for this kind of check.
**Where**: `src/scaffold/classify-transport.ts` — fixed by measuring `serializedBatchSize([prospectiveDirective])` instead of `JSON.stringify(content)`.
**Learned**: When writing a heuristic that predicts an authority's future verdict, measure the SAME quantity the authority measures (or a provably tighter superset) — never a cheaper proxy that can diverge at the cap boundary. Verify with a worktree pre/post regression proof, not just unit coverage.

### A fresh, blind, independent adversarial pass is load-bearing — internal consistency is not correctness
**What**: Judgment-day (blind dual-judge adversarial review) caught three real defects — the classifier budget under-measurement, the BOM regression, and a raw Node error escaping the `AuthoringError` contract on a missing/non-directory walk root — that the full 4-persona blind council AND two independent final-verify passes had ALL missed.
**Why**: In every case, the shipped code was internally consistent with its own tests: the tests and the implementation shared the same wrong mental model, so nothing in that closed loop could catch the divergence from the actual spec intent. Only a reviewer with NO exposure to the prior reasoning — fresh fixtures, fresh mutation probes, re-run after every fix — broke the loop.
**Where**: Process-level, applies to any L-classified (sensitive-area) change with a non-trivial trust boundary.
**Learned**: Don't treat a clean in-loop streak or a passing council review as proof of correctness for a security-relevant boundary — schedule a genuinely blind adversarial pass (no access to the orchestrator's transcript, prior findings, or builder narration) and RE-RUN it after every fix, not just once. The value is in the fresh, uncontaminated composition, not any single reviewer's skill.

### Worktree engram-namespace gap during planning — committed openspec artifacts stayed the durable source of truth
**What**: Plan-phase (explore/propose/spec/design) observations for this change landed under a different engram namespace than the one this archive session resolved to, so they weren't directly retrievable by this session's `mem_search`.
**Why**: The change was planned in an isolated worktree whose engram project-name resolution diverged from the main checkout's.
**Where**: Cross-worktree SDD sessions using `artifact_store: hybrid` or `engram`.
**Learned**: When planning happens in a worktree, treat the committed OpenSpec files as the durable, canonical record — don't assume engram continuity across worktree boundaries. If hybrid mode is active, verify the engram namespace resolves identically before relying on cross-phase `mem_search` recall; when it doesn't, the filesystem artifacts are the fallback of record, not a degraded backup.

Source: change `schematic-local-files` (2026-07-13)

## From `stage-5-first-dialect` (2026-07-12)

### ts-morph@28 strips leading BOM through getFullText — re-prepend logic is load-bearing
**What**: ts-morph's `getFullText()` method strips the BOM (byte order mark) from source files; the parsed AST retains it in metadata but the print surface loses it, breaking byte-exact round-trip fidelity.
**Why**: Round-trip tests (REQ-DC-01, REQ-TSD-03.6) revealed the loss; conformance kit re-prepends via a WeakMap-backed internal mechanism to restore byte identity.
**Where**: `src/dialects/typescript/ast.ts` — the `ast.ts` module owns the ts-morph binding and the BOM-strip workaround; the fix is invisible to dialect ops and authors.
**Learned**: When a third-party parser library has a known limitation that breaks your fidelity contract, own the fix at the binding layer (not at the op/dialect layer) and document the invariant clearly, or the next engineer will re-discover it painfully.

Source: change `stage-5-first-dialect` (2026-07-12)

### ts-morph parser is fault-tolerant — real syntax-error detection needs getSyntacticDiagnostics
**What**: ts-morph's `createSourceFile()` succeeds on malformed TypeScript; detecting genuine syntax errors (REQ-TSD-04: parsing a file with `const x = ;` should error) requires calling `getSyntacticDiagnostics()` explicitly.
**Why**: The design assumed parse failures would throw; the executor discovered ts-morph's permissive parse path and implemented the correct detection method, which is internal to the dialect's `ast.ts`.
**Where**: `src/dialects/typescript/ast.ts` — the `parse()` function checks diagnostics; dialect callers never see the library's permissive behavior.
**Learned**: Verify third-party library error-reporting behavior with adversarial input early; don't assume exceptions for parse failures.

Source: change `stage-5-first-dialect` (2026-07-12)

### Async author callbacks under `=> void` type escape sync try/catch containment
**What**: An async operation wrapped in a sync-typed callback (e.g., `async () => { await someOp() }` assigned to `fn: (...) => void`) allows exceptions to escape the containing try/catch because the exception lives in a rejected promise, not the sync stack.
**Why**: The run-boundary join (FIT-20, `RunContext` drains outstanding handles before flush) required containing both sync and async failures from author code. A sync try/catch around the `await` of an async callback leaks if the callback itself is async-internal.
**Where**: `src/core/context.ts` `defineFactory` runner — the factory function is typed `(o) => void | Promise<void>` to allow authors to forget the await; the runner's own error handler awaits the function's thenable return (if any) inside a contained wrapper.
**Learned**: If your public API accepts a callback typed as sync but the runner treats it as potentially async, wrap the thenable-await inside your own try/catch, not the sync caller's. Sync-typed callbacks that are async-internally require async-aware error containment.

Source: change `stage-5-first-dialect` (2026-07-12)

### Openspec architecture mirror skips when refreshes stay engram-only
**What**: Refreshing the architecture baseline from within a change worktree (hybrid/engram mode) updates only the engram topic; if the filesystem is the team's source of truth, the `.md` file stays stale.
**Why**: Stage-3 and stage-5 ran architecture refreshes in engram-only context. The baseline `.md` file is visible to the team; a stale file confuses future readers who expect it to be current.
**Where**: Architecture refresh hooks (post-verify) — any agent running in hybrid mode should mirror refreshes to both engram and filesystem.
**Learned**: After an architecture baseline refresh, verify both backends are current: engram topic `sdd/{project}/architecture` AND `openspec/decisions/architecture.md` (if openspec mode is active). If you refresh engram-only and the team uses filesystem-backed decisions, you've silently created drift. Commit the `.md` refresh at archive time or document the worktree-scope limitation.

Source: change `stage-5-first-dialect` (2026-07-12)

### Cross-branch ADR/FIT collision: reserve ranges at plan time
**What**: Two parallel branches independently assigned the "next free" ADR numbers (stage-4 claimed 0024-0028, stage-5 drafted 0033-0034) unaware of each other. When merged in a different order, one branch's numbers collided with the other's landed numbers.
**Why**: Number assignment at design time (per-branch, in isolation) assumes no parallel work. Stage-5 discovered stage-4b's 0033-0036 already on main; mechanically renumbered stage-5's 0033-0034 to 0037-0038 at apply time (established stage-4 precedent).
**Where**: Multi-stage programs with parallel sub-changes; ADR and fitness-function numbering.
**Learned**: On the first `/plan` of a multi-stage program, reserve ADR ranges: "stage-4 gets 0024-0032; stage-5 gets 0033-0050" (or similar). Document the ranges in the program-level plan artefact. If a range is breached, apply-time renumber is safe but creates churn in design/slices/apply-progress headers; prevention is cheaper. Applied remedy: design/slices/apply-progress headers now document the collision and the renumber precedent, so the next team reader knows it's deliberate.

Source: change `stage-5-first-dialect` (2026-07-12)

## From `stage-4b-testing-harness` (2026-07-12)

### Evaluator diversity catches what 4/4 green in-loop verifies miss
**What**: A blind post-build council (4 personas) plus judgment-day found three real defects —
a factually wrong README boundary line (`./conformance` mis-described as testing an "engine
implementation"), an under-documented verbatim-template behavior, and a prototype-chain leak in
`ContractFake`'s seed lookup (`path in seed` treating inherited `Object.prototype` members as
present) — none of which four consecutive verify-in-loop passes (all PASS, zero findings on the
last) had surfaced.
**Why**: In-loop verification re-checks the builder's own coverage claims against the signed
spec; council personas approach the shipped artefact adversarially/fresh (a tech-writer reading
the README as a stranger would, a security engineer probing the fake's object semantics) — a
different failure class than spec-compliance re-checking.
**Where**: Any L change reaching a clean in-loop streak — the streak is not evidence the
post-build council pass is redundant.
**Learned**: Never skip the post-verify blind council + judgment-day pass because in-loop was
clean; budget it as a structurally different check, not a formality.

### Spec-prescribed doc wording can itself be wrong — verify it like code, not like a checkbox
**What**: REQ-TSD-01.3's own spec text described `./conformance` as "conformance-testing an
engine implementation" — factually wrong (it tests a dialect/op-pack's parse/print fidelity,
never an engine). The README inherited the same error verbatim from the spec, and it shipped
past 4 in-loop verifies before council caught it.
**Why**: Docs REQs pinned by TOKEN-LEVEL assertions (deliberately, to keep prose author-free and
executor-green-deterministic) can go green while asserting a token set that is itself
semantically wrong — token presence proves the words are there, not that they're true.
**Where**: Any change whose spec dictates literal doc wording, verified by token/string
assertion rather than a domain-knowledgeable read.
**Learned**: A token-level doc assertion is necessary but not sufficient — pair it with at least
one adversarial/domain-aware read of the actual sentence before archive, especially when the
spec text itself is the wording's origin.

### A sequence-gated slice's gate can open earlier than the plan assumed
**What**: S-006 was planned GATED on `stage-4-typed-options` reaching ARCHIVE; by the time
`/build` actually launched, stage-4 had already archived (its own cycle closed first), so the
gate was open from the start of this change's build rather than opening mid-build as the plan
anticipated.
**Why**: Cross-change sequencing gates are evaluated once at plan time; if the sibling change's
cycle completes faster than expected, the gate's state at plan time and at build time can
diverge, and a stale mental model treats it as still-closed.
**Where**: Any change whose slices are gated on a sibling change's merge/archive milestone.
**Learned**: Re-verify sequencing-gate state (merged? archived?) at the moment `/build` actually
launches, not only when slicing — a gate can silently open early and unblock work sooner than
planned, or (less happily) close if a sibling change stalls.

## From `stage-4-typed-options` (2026-07-11)

### Blind verify-final council catches what its own checklist pass misses
**What**: A blind adversarial council review run AFTER verify-final's own execution-evidence pass
found a HIGH codegen-injection vulnerability and a MAJOR deep-nesting RangeError that verify-final's
own pass had marked clean.
**Why**: Verify-final read the same code/tests the builder wrote; the security and QA council
personas approached the change adversarially (hostile schema injection, oversized nested input)
instead of re-checking the builder's own coverage claims.
**Where**: Any L/sensitive change with a codegen or parsing surface — complements the stage-2 lesson
"Blind-council review catches unimplemented spec clauses that mode-final verification marks
compliant" with a second failure class: unimplemented DEFENSES, not just unimplemented clauses.
**Learned**: Budget an independent adversarial pass (security + QA) even when verify-final's own
Step 11b audit reports clean — checklist-style verification and adversarial probing catch different
failure classes.

### Two-layer defence converges a council fix-review GAN loop in one iteration
**What**: Pairing a primary refusal gate (a sufficiency check) with an independent allow-list
backstop closed both a HIGH and a MAJOR blind-council finding in a single fix-and-reverify pass.
**Why**: stage-4's codegen-injection fix (`checkSufficiency` gate + `RECOGNIZED_KINDS` allow-list)
and the locator RangeError fix both re-verified clean on the first re-judge, avoiding a second GAN
iteration.
**Where**: Any fix responding to a blind adversarial finding on a security-sensitive code-generation
or parsing surface.
**Learned**: Favor defence-in-depth (a primary refusal gate PLUS an independent structural backstop)
over a single-layer patch — it satisfies adversarial re-verification faster.

### A review agent's own git checkout can wipe an uncommitted fix mid-review
**What**: A council agent running `git checkout -- bin/...` as part of its review wiped an
UNCOMMITTED fix batch under evaluation; it restored byte-exact once caught, but the risk was real.
**Why**: Uncommitted fix batches have no git-tracked safety net against a reviewing agent's own
file-restoring commands.
**Where**: Any orchestrated flow running adversarial/mutation-probing agents against a fix that
hasn't been committed yet — extends the stage-3 lesson "commit pipeline artefacts before launching
evaluators with cleanup instructions" to in-flight fix batches specifically.
**Learned**: Commit fix batches to the branch BEFORE launching adversarial agents that run mutation
probes against them — don't rely on the agent noticing and restoring.

### Owner-authorized same-day cross-change spec unfreeze executes cleanly when declared explicitly upfront
**What**: A same-day owner-authorized unfreeze of a signed sibling spec (Stage-2's
`authoring-error-contract` V2→V3), coordinated with the dependent change's code extension, landed
without incident.
**Why**: The dependency had been declared explicitly at spec time (a "PROPOSED, not applied"
deferred-amendment block) rather than silently assumed, so when the gate opened the amendment was
small, well-scoped, and pre-negotiated.
**Where**: Any change whose REQs depend on an unmerged/frozen sibling spec.
**Learned**: Declare a cross-change spec dependency explicitly as a deferred/PROPOSED block, then
execute it as a scoped, owner-authorized coordinated amendment once the gate opens (sibling archives
or explicit unfreeze) — this sequences dependent changes without blocking the dependent's own build.

Source: change `stage-4-typed-options` (2026-07-11)

## From `stage-3-dry-run-exposure` (2026-07-07)

### Tag pinning-only slices [characterization] at plan time — [must-fail-first] over shipped behavior is unachievable
**What**: A [must-fail-first] tag on a pinning-only slice over behavior a prior skeleton slice already
shipped is unachievable — the behavior exists, so a spec-correct test can only be born GREEN.
**Why**: Stage-3's S-000 walking skeleton shipped the entire `dryRun()` capability; S-001/S-002 added
zero production code (behaviors inherited from `currentContext()`/`pendingSnapshot()`/`Session.flush()`).
Genuine pre-impl RED was impossible, so the executor manufactured RED honestly — a deliberately-wrong
assertion failing for the RIGHT reason (assertion diff, not import/syntax error) — proving teeth, then
corrected to spec. Verify-final adjudicated this TEETH-DEVIATION legitimate: deviation-over-theatre,
not a violation.
**Where**: Any multi-slice change whose skeleton slice ships the capability and whose later slices only
pin inherited behavior.
**Learned**: At slicing time, tag pinning-only slices [characterization], reserving [must-fail-first]
for slices that add or change production behavior. When the misclassification is only discovered at
apply time, TEETH-DEVIATION (deliberately-wrong-expectation RED) is the honest fallback.

Source: change `stage-3-dry-run-exposure` (2026-07-07)

### Commit pipeline artefacts BEFORE launching evaluators with cleanup instructions
**What**: Blind evaluators instructed to "leave no trace" deleted an UNCOMMITTED pipeline artefact
(`verify-report.md`), mistaking it for their own residue.
**Why**: Uncommitted files have ambiguous ownership from an evaluator's perspective — a blanket
cleanup instruction invites over-zealous garbage collection of anything not in git history. The
committed artefacts survived untouched.
**Where**: Any orchestrated flow that launches blind judges/evaluators (judgment-day, council reviews)
with cleanup or leave-no-trace instructions.
**Learned**: Commit every pipeline artefact to the branch BEFORE launching evaluators that carry
cleanup instructions, and scope those instructions to exact paths rather than "clean up after yourself".

Source: change `stage-3-dry-run-exposure` (2026-07-07)

### A worktree-scoped architecture refresh silently drops unmerged sibling surface
**What**: Refreshing the architecture baseline from inside a change worktree captures only what that
worktree sees — surface belonging to unmerged sibling branches (parallel changes) silently disappears
from the refreshed baseline.
**Why**: Stage-3's post-verify baseline refresh ran in the stage-3 worktree while stage-2 (parallel,
unmerged, architecture-impact `modifying`) was invisible to it; without a scope note, a future reader
would take the refreshed baseline as the whole truth.
**Where**: Projects running parallel changes under worktrees with an architecture baseline
(`sdd/{project}/architecture`).
**Learned**: Record the branch-scope in the baseline refresh note ("captured in {branch} worktree
context only") and re-refresh the baseline after the siblings merge — never treat a worktree-scoped
refresh as global.

Source: change `stage-3-dry-run-exposure` (2026-07-07)

## From `typed-options-and-read` (2026-06-24)

### A named derivation alias can be a structural no-op — prove the existing contract, don't add one
**What**: When a mapped type is homomorphic (`{ [K in keyof S]: S[K] }`), TypeScript already preserves
optionality, required-ness, and per-key value types. A named alias (`OptionsOf<S>`) that re-derives the
same structure is a no-op — it adds a public name without adding behaviour.
**Why**: The design assumed the skeleton's identity map needed a richer derivation for required/optional
split. Standalone `tsc` verification at apply time proved it was wrong — the map was already correct for
every signed scenario. Introducing `OptionsOf<S>` would have frozen a name whose only observable
difference (a `T | undefined` key without `?` becoming omittable) was unwanted.
**Where**: Any change that adds a type derivation over an existing mapped type before freeze.
**Learned**: Before adding a derivation alias, run the full negative matrix against the existing type.
If every scenario already holds, the deliverable is to PROVE and FREEZE the current contract (characterization
matrix + CI guard), not to add a new name. Reframe "add derivation" as "prove + freeze".

Source: change `typed-options-and-read` (2026-06-24)

### FIT-04 dts-baseline regen is the intentional-freeze proof — keep the diff to one line
**What**: When a public `.d.ts` surface changes intentionally, the baseline regen should be a 1-line
diff (the signature line only). A multi-line regen diff is a signal that unintended surface has shifted.
**Why**: The `core.base-handle.d.ts` baseline regen from `Promise<string>` to `Promise<string | undefined>`
was exactly one line. Restoring the trailing newline to match `echo`-vs-`write` differences was the only
noise. The 1-line expectation is the easiest way to sanity-check that the gate is green for the right reason.
**Where**: `test/fitness/dts-baseline/` regen after any public signature change.
**Learned**: Run `git diff` over the baseline file after regen. If more than the intended signature line
changed, investigate before claiming FIT-04 is correctly frozen.

Source: change `typed-options-and-read` (2026-06-24)

### Two blind judges independently rediscovering the same edge validates it as a real tracked boundary
**What**: When two independent judges (from different review passes, receiving no shared context) both
surface the same architectural concern, treat it as a confirmed design edge — not a defect, not noise.
**Why**: Both judgment-day judges independently identified the walking-skeleton port boundary (read-staged
/ read-your-own-writes vs read-disk) and the real-engine divergence risk. Neither had seen the other's
review. Their convergence is Bayesian evidence that the boundary is load-bearing and needs explicit tracking.
**Where**: Any L/sensitive change with multiple blind review passes.
**Learned**: When two blind judges agree on the same concern, log it as a tracked design boundary
(not a finding to suppress). The convergence is the signal.

Source: change `typed-options-and-read` (2026-06-24)

## From `l1-author-surface-skeleton` (2026-06-22)

### The plan-verify "zero Judge-B questions" bar is asymptotic for complex changes
**What**: Treat plan-verify Judge B (the slices-only simulated executor, "ANY open question → gaps")
as a residue detector, not a pass/fail gate. Judge A (problem/scope fit) is the meaningful signal.
**Why**: Judge B reads slices in isolation — the design that answers its questions is deliberately
withheld. For any non-trivial change it will always surface questions a design-aware executor wouldn't
ask, so the formal "ready needs zero findings" bar is never cleanly reachable. This skeleton took 4
iterations and a human override; iters 2–4 each resolved a *real* gap, but the tail was isolation
artefacts, not defects.
**Where**: Every M/L change's plan-verify gate.
**Learned**: Budget the 3-iteration limit for Judge A's substance; when the residue is Judge-B
isolation noise the design already answers, override with the rationale logged — don't loop chasing zero.

### A migration plan's "which tests break" prediction must be apply-verified, not trusted
**What**: When a design predicts which existing tests a contract change will break, re-run the suite at
apply time — the prediction is a hypothesis, not a fact.
**Why**: The design's Fake Migration Plan claimed read-your-own-write tests would break under the new
commit boundary. The opposite held: mid-run reads stayed green, but four *post-run* `fake.read()`
assertions broke because `commit()` clears staging before a post-run read can observe it. The
prediction was confidently wrong; only the apply run found the truth.
**Where**: Any change that reverses a behavioural contract a test suite already pins.
**Learned**: Design predicts, apply verifies. Never carry a migration prediction into archive as fact
without a green run behind it.

### Read-your-own-writes precludes rollback-by-withholding — roll back transactionally downstream
**What**: An API that flushes buffered writes mid-run to serve its own reads cannot implement
all-or-nothing by "deciding not to emit on error" — the writes are already gone downstream.
**Why**: `read()` flushed `#pending` to engine staging before every read, so a later throw had nothing
left to suppress. Rollback had to become a staging→commit/discard boundary owned by the engine (see
ADR 0015), not an SDK-side emit suppression.
**Where**: Any fluent/buffered surface with read-your-own-writes semantics.
**Learned**: If reads flush, rollback is a downstream transaction concern. Model the boundary on the
transport port; don't try to win it in the buffer.

## From `foundations-skeleton` (2026-06-21)

### Blind adversarial review escapes pipeline anchoring
**What**: Run a blind pass (judges see only the diff + signed spec, never the tests or prior review)
on any change whose tests share one happy-path shape.
**Why**: The entire council tested `read-your-own-write`, which always calls `.read()` — masking that
the session only flushed *inside* `read()`. A write-only factory (the SDK's primary use case) emitted
nothing. Only the blind judges, lacking that framing, caught it.
**Where**: Project-wide; especially fluent/lifecycle APIs.
**Learned**: Anchoring is invisible from inside the pipeline. Budget a blind round for L/sensitive changes.

### Fitness/gate tests that read build output must build first or assert freshness
**What**: Any test reading `dist/` must self-build (or assert dist is newer than src) and CI must build
before test.
**Why**: FIT-04 (the .d.ts semver gate) false-greened twice on a stale `dist/`, once masking a real
renamed-export breaking change. A gate that reads stale artifacts validates the wrong surface.
**Where**: `test/fitness/*` and any artifact-diffing test.
**Learned**: Derived-artifact tests are impure by default; make freshness explicit.

### Chaining/fluent tests must exercise the RETURNED object, not a side path
**What**: For a chaining API, the round-trip test must `.read()` the handle the verb returned.
**Why**: `rename`/`move` returned handles addressing the wrong path (basename vs full path; deleted
source). Tests read an unrelated `"dummy"` path to force a flush, so two CRITICALs shipped green.
**Where**: `src/commons` author verbs; any builder/fluent surface.
**Learned**: Asserting the emitted payload is not enough — assert behaviour through the returned value.

### Test doubles live outside the published source tree
**What**: Keep the contract fake (and any test double) out of `src/` so it never lands in `dist/`.
**Why**: `ContractFake` under `src/core/` shipped in the npm tarball and forced a fitness-function
carve-out. Moving it to `test/support/` removed both problems.
**Where**: Published packages.
**Learned**: Placement is a boundary decision; `files`/`exports` alone don't keep test code unpublished.

### Lifecycle guarantees belong in a REQ with a GWT, not a JSDoc comment
**What**: Encode run-end / teardown semantics as an explicit acceptance criterion.
**Why**: Run-end flush was promised only in the `create` JSDoc, so nothing tested it — the gap that hid
the write-only-factory bug. Making it REQ-KIT-05 with a GIVEN/WHEN/THEN closed it.
**Where**: Any API with lifecycle/flush/cleanup semantics.
**Learned**: If a guarantee isn't in the spec, it isn't tested.

## From `stage-1-ir-bedrock` (2026-07-05)

### Identity exclusion proved load-bearing via triangulation regression
**What**: When implementing fail-closed collision detection for `move`, the naive `#exists(dst)` check
without self-move identity exclusion initially passed but went RED during apply verification — proving
the identity exclusion (`dst === src` → success, no-op) kills a real mutation.
**Why**: The check was initially implemented without the identity guard, passing all green-path tests.
Only during apply triangulation (REQ-FAKE-04.m4: "self-move succeeds") did the fixture expose that
the naive check incorrectly rejected a file moving to itself. Adding the identity exclusion flipped
the test from RED → GREEN, proving the exclusion is not defensive but load-bearing.
**Where**: Any seam rule involving collision detection or identity-like comparisons (move/rename/copy
with forced overwrites, cache invalidation, dedup logic).
**Learned**: Triangulation regression (test goes RED after naive implementation, then GREEN after
adding the subtle rule) is the strongest signal that a requirement is load-bearing, not just defensive.
Budget time for triangulation during apply.

Source: change `stage-1-ir-bedrock` (2026-07-05)

### Stage-boundary markers guide cross-stage collaboration
**What**: Mark raw seam rejections with `// RAW-UNTIL-STAGE-N` comments so the next stage locates
upgrade sites without archaeology or grepping the whole change.
**Why**: This stage's five emit-seam rejections (cap-exceeded, round-trip-mismatch, move-collision,
modify-existence, stringify-throw) all carry `// RAW-UNTIL-STAGE-2.1` markers. Stage 2.1's design
can search for these markers to find exactly which raw `ContractFake:` throws need to become attributed
`AuthoringError` instances, without reading the full apply history or design.
**Where**: Multi-stage work where one stage's boundary code feeds into another stage's error handling
(e.g., seam validation → error attribution, fake behaviours → real engine mapping).
**Learned**: Explicit stage-boundary markers in code are a process pattern, not a code smell. They
close handoffs cleanly and scale with parallelism.

Source: change `stage-1-ir-bedrock` (2026-07-05)

### Seam contracts need fixture adversarialism to kill encoding mutants
**What**: Boundary fixtures for encoding/serialization logic must include multi-byte and escape-character
content specifically sized to distinguish mutants (raw-vs-serialized measurement, UTF-8 vs UTF-16).
**Why**: REQ-01 (batch cap) and REQ-02 (boundary pass-through) both require fixtures that are
intentionally constructed to fail under plausible wrong implementations. The at-cap and over-cap
fixtures have raw-content-bytes < cap < serialized-bytes, so a raw-measurement mutant passes the
over-cap boundary when it should reject. Plain-ASCII fixtures cannot distinguish this from a correct
UTF-8 implementation. Multi-byte content adds another axis (UTF-16 code-unit mutant vs byte mutant).
**Where**: Any seam test involving measurement, encoding, or serialization (JSON boundary, wire size cap,
path normalization, content type pins).
**Learned**: Fixture design for seam tests is not about happy paths — it's about killing mutants.
Adversarially construct fixtures to be wrong under plausible mutations. ASCII fixtures are never enough.

Source: change `stage-1-ir-bedrock` (2026-07-05)

## From `stage-2-error-attribution` (2026-07-06)

### Mutation-probe verification is evaluator discipline, not a nice-to-have
**What**: A verifier must run hand-mutation probes against the claims under review — mutate the
arm a test allegedly guards, watch the suite, revert — instead of trusting coverage claims.
**Why**: It caught what coverage claims missed TWICE in this change: in-loop #1 found REQ-12.1's
`instructions[0]` unguarded (the mutant survived a "covered" scenario), and final verify's
rogue-code probe exposed a degradation crash. Single-directive and same-verb fixtures pass
attribution claims while proving nothing — they are theatre for "attributes to the actual offender".
**Where**: Any verify pass over attribution, classification, or mapping logic — anywhere a wrong
implementation can pass a weak fixture.
**Learned**: For every "REQ-X is covered" claim over a mapping/attribution arm, mutate that arm and
demand a failure. Fixtures must be shaped so the lazy implementation is distinguishable (multi-
directive, mixed-verb, non-first offender).

Source: change `stage-2-error-attribution` (2026-07-06)

## From `stage-5b-dialect-breadth` (2026-07-12)

### Blind council + judgment-day discovered real defects in-loop missed

**What**: Two judgment-day rounds caught four real bugs (on-undefined pinned message with collision namespace, enum/namespace collision set, multi-declaration removeImport scope, cross-handle gate staleness) the in-loop cycle and council's parallel review both overlooked.

**Why**: Adversarial independence (judges read ONLY the evidence, not the orchestrator's transcript or prior council reasoning) surfaces blind spots no amount of restatement-and-iteration cures.

**Where**: `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk` — dialect-handle.ts, define-dialect-collision testing, ops.ts collision namespace, security-authoring-guard.test.ts scope.

**Learned**: Structure every L change to include blind judgment gates; the council is expert-checking against the spec, but judgment-day's role is to find what's missing from the spec itself. The two checks are orthogonal, not redundant.

---

### Signed spec text governs over derived tables; reconciliation costs matter

**What**: REQ-DC-06 chapeau ('EVERY testDialect/testOpPack run') stated the requirement in prose but the Test Derivation table narrowed it (by describing injection scoped to testDialect only). The spec text survives 4 plan-verify iterations unchallenged; reconciliation required a fix iteration and owner visibility on the cost.

**Why**: Tables and prose must be reconciled BEFORE signing; a diff in derived vs normative language invites misimplementation.

**Where**: `openspec/changes/stage-5b-dialect-breadth/spec.md` § Verification Obligations.

**Learned**: In-flight spec drifts (prose vs tables) cost fix iterations; re-read signed specs for consistency between sections before launch. Spec-maintainer role needs explicit "all derived tables reconciled to prose" gate.

---

### Trailing positional args after variable-arity author-facing args are structurally fragile

**What**: Four problems (on-undefined collision-namespace message, multi-declaration removeImport guard, runFailure poison flag first-wins, `handlePath!` non-null assertion hack) stemmed from or were exacerbated by the `(ast, ...args) => void` rhythm carrying positional args after a variable arglist.

**Why**: Variable-arity with trailing positionals creates a collision zone; errors sneak past static checking.

**Where**: All structured ops take `(name, source/initializer/from, options?)` — the `options?` is fine, but any direct trailing arg (no optional wrapper) is fragile.

**Learned**: Enforce "no trailing positional after `...args`" in the contributor kit's conformance checks (FIT-16 or a new variant); document the pattern in dialect-authoring-standards as an anti-pattern to avoid.

---

### State-mirror duplicate-key corruption breaks pipeline-guard

**What**: A malformed `.sdd/state/stage-5b-dialect-breadth.json` with a repeated key was silently parsed (JSON.parse took the last value, first silently dropped) — the pipeline-guard didn't catch the truncation. The schema has no uniqueness enforcement.

**Why**: JSON parsers accept duplicate keys by spec; the orchestrator's state mirror is the single source of truth, so truncation isn't detectable from other sources.

**Where**: `.sdd/state/` schema and the orchestrator's read path.

**Learned**: Add a validation pass (schema audit or direct inspection) after every state write; at least one early-session check should reject non-canonical JSON or confirm schema compliance. Document in `skills/_shared/persistence-contract.md`.

### Data-variant slices over a generalized mechanism are characterization, not must-fail-first
**What**: When a walking-skeleton slice has already generalized a mechanism (metadata-driven
translation), later slices that add DATA variants (more verbs, more flush counts) over it should be
tagged `characterization` in the design's Test Derivation table — the mechanism's must-fail-first
RED lives in the skeleton slice.
**Why**: S-002's REQ-14/15/17 rows were tagged `must-fail-first` but every case ran green on first
execution — S-000 had already killed the hardcode generically. The deviation was declared and the
tests were independently proven mutation-meaningful, but the wrong tag cost an audit cycle.
**Where**: Design §Test Derivation for any sliced change with a walking skeleton followed by
coverage-widening slices.
**Learned**: Ask per row: "does the mechanism this exercises already exist by the time this slice
runs?" If yes, tag `characterization` and point the RED obligation at the slice that built it.

Source: change `stage-2-error-attribution` (2026-07-06)

### Parallel slice-apply agents clobber a shared apply-progress topic key
**What**: Two apply agents running slices in parallel and upserting the same
`sdd/{change}/apply-progress` engram topic silently overwrite each other's progress records.
**Why**: Observed during this change's parallel batch (engram obs 754): the second agent's upsert
replaced the first's slice log. Recovery needed manual reconstruction from git history.
**Where**: SDD harness — any change whose slice DAG sanctions parallel apply agents; candidate
amendment to `sdd-phase-common.md` Section C.
**Learned**: Parallel apply agents need per-slice topic keys (`apply-progress-{slice-id}`, the
stage-1 file precedent) or orchestrator-consolidated saves — never a shared mutable topic.

Source: change `stage-2-error-attribution` (2026-07-06)

### Blind-council review catches unimplemented spec clauses that mode-final verification marks compliant
**What**: A blind persona reviewing the diff against the signed spec (no verify-report in context)
finds clauses that verification — reading the same tests the builder wrote — accepted as covered.
**Why**: The QA persona found the rogue-code degradation clause of the signed spec unimplemented
(non-`EmitRejection` codes crashed the translation) after mode-final verification had marked the
REQ compliant; the checkmark traced to a test that never exercised the clause. Evidence beats
checkmarks.
**Where**: Any L/sensitive change; complements the existing "blind adversarial review escapes
pipeline anchoring" lesson (foundations-skeleton) — this one is specifically about spec-clause
completeness, not shared happy-path shape.
**Learned**: Budget at least one blind spec-vs-diff pass per L change. A verify matrix row is a
claim about a test's existence, not about the clause's implementation — only an adversarial reader
who re-derives the obligation from the spec text catches the difference.

Source: change `stage-2-error-attribution` (2026-07-06)

## From `bare-factory-migration` (2026-07-15)

### Design inventory claims derived from narrow searches undercount reality
**What**: Two independent design-inventory undercounts surfaced during build + verify: R-9's harness-convention consumer scan (`fd . test/fake | rg harness`) found only 4 files; build execution evidence revealed 5 unclaimed consumers. Section 14's docs-table inventory missed `src/dialects/typescript/index.ts`'s `@example`, caught only at S-006 discovery. Both cases: narrow search patterns yielded incomplete results.
**Why**: The first search was too syntactically specific (`| rg harness` on filename only); the second relied on a manual table scan without cross-checking the actual source. Executor-side re-derivation (running build + typecheck to catch all consumers; FIT-06 origin-cascade scan) + multi-pattern sweeps caught both omissions late.
**Where**: Design phase, inventory-gathering tasks (file counts, cross-file coverage tables, change-scope determination). Executor-side verify catches these but only after slicing commits.
**Learned**: Design inventory claims must be derived twice — once via explicit search queries, once via automated cross-cutting scans (build/typecheck/fitness-layer) — and reconcile before signing the spec. A single narrow search is necessary but not sufficient. Executor-side re-derivation during apply/verify can catch remaining gaps, but earlier re-checking at spec-sign time improves slice accuracy and reduces in-loop iterations.

### The vacuous-oracle trap: substring-match safety depends on context
**What**: REQ-ATH-20.1's `defineFactory` token scan uses bare-identifier word-boundary matching (not substring). The original scenario intended `defineFactory(` (call form), which was vacuously zero pre-migration — every fixture had the wrapped-runner shape and no call to `defineFactory` existed. The spec was correct semantically, but the token itself was safe by luck, not design. FIT-16's own comment warned about this trap.
**Why**: A token appearing nowhere means a scan for it vacuously passes; the distinction between "safe by design" and "safe by non-occurrence" is invisible post-migration, when bare factories ARE the norm and `defineFactory` disappears from author fixtures. Rename/API-change migration can silently create scenarios whose guarantees only hold because a token doesn't appear, not because the code actively forbids it.
**Where**: Any spec that scans for a particular token or identifier as an invariant; especially REQs that emerged mid-cycle (REQ-ATH-20 was added at spec V2, not V1).
**Learned**: When a spec scenario depends on a token absence, explicitly state whether the absence is enforced by code structure (active guard, allowlist, ban), verified by type system, or merely observed as a side effect of today's implementation. If it's the latter, register a "drift risk" as a future architecture guard or refactoring candidate, not a permanent invariant.

## From `ts-addimport-collision` (2026-07-21)

### A signed spec's factual claim about existing behaviour can survive multiple review passes until an executor's probe falsifies it
**What**: REQ-TSD-01.25's original text claimed `removeImport` "removes `x` from EVERY matching declaration it appears in." The claim was false — the shipped op searches all declarations but removes from only the first match. It survived V1 through V3.1 sign-off (four spec revisions, three review lenses) until slice S-004's executor empirically probed the shipped code (twice, byte-identical results) and falsified it, forcing a targeted `unfreeze=true` amendment (V3.2) after sign-off.
**Why**: Every review pass up to that point reasoned from the claim's plausibility and internal consistency, not from running the actual code against a distinguishing fixture — and the distinguishing fixture (duplicate local-name bindings across two declarations for one module) is itself only reachable via hand-authored/legacy, compile-invalid input, so ordinary usage never exposed the gap.
**Where**: Any spec clause asserting "existing/shipped behaviour is X" without a cited empirical probe — a pattern this project also hit with REQ-TSD-01.21/.33's shebang classification (V2 wrongly claimed a crash based on bypassing the dialect's own containment wrapper).
**Learned**: A spec clause describing CURRENT (not proposed) behaviour needs the same evidentiary bar as a scenario's THEN clause — an executor pin-probe against the real, shipped code, not inference from the surrounding prose. Schedule at least one such probe before sign-off for any "today's behaviour is..." claim on load-bearing logic.

### Blind adversarial judges catch corruption that in-loop verification and a 50/50 final verify both miss when they share the same test fixtures
**What**: Judgment-day's blind judges (Round 1) found that inserting an import into a file with BOTH a leading comment and a directive prologue landed the import BETWEEN the comment and the directive, voiding the directive — a real corruption that escaped all 7 in-loop verify iterations and the final verify's 50/50 scenario matrix.
**Why**: Every prior test fixture for the directive-prologue scenario used a BARE directive (no leading comment) — the in-loop and final-verify passes all read the same fixture shape the builder had already validated against, so the gap was invisible to anyone reasoning from those fixtures. The blind judges, given only the diff and spec (not the test suite's fixture conventions), constructed an adversarial fixture combining two orthogonal shapes the builder had tested separately but never together.
**Where**: Any change whose fixtures are all authored by the same agent that also wrote the implementation — a form of fixture-authoring bias, not a process failure.
**Learned**: "50/50 scenarios pass" is a claim about the fixtures that exist, not about the input space. Blind adversarial review earns its cost specifically by constructing fixtures the builder didn't think to combine — budget it for any L/sensitive change, and don't treat a clean in-loop history as a substitute.

### ts-morph's statement-insertion index is comment-inclusive, not directive-inclusive
**What**: `SourceFile#insertImportDeclaration(index, ...)` and the underlying `getStatementsWithComments()` index leading comments as part of the statement list — an index computed to land "after the directive prologue" can silently land between a leading comment and the directive it precedes, if the comment-counting and directive-counting use different statement-enumeration methods.
**Why**: The two ts-morph APIs (`getStatements()` vs `getStatementsWithComments()`) diverge exactly on leading comments, and nothing in ts-morph's own typings signals which one a given insertion index expects.
**Where**: Any TS-dialect code computing an insertion index relative to leading trivia (directives, shebangs, comments) — `src/dialects/typescript/ops.ts`'s directive/shebang handling is the concrete instance; a reusable gotcha for any future ts-morph-based insertion logic.
**Learned**: When an insertion index must land relative to leading trivia, use ONE statement-enumeration method consistently for both counting and inserting, and add a fixture that combines the trivia kind under test with at least one OTHER trivia kind (comment + directive, comment + shebang) — a bare-trivia-only fixture cannot catch this class of off-by-one.

### Commit-after-every-seal plus filesystem-backed state survives host crashes losslessly
**What**: This change's execution survived two host crashes mid-build with zero rework — S-000 and S-001 both show "post-crash recovery re-verified" in their apply history, and the change resumed from the last sealed slice with no lost work.
**Why**: The SDD harness's discipline of committing after every slice seal (not just at change-end) plus persisting all phase state to the filesystem (`openspec/changes/{change}/*`, `.sdd/state/*`) meant the crash's blast radius was bounded to at most one in-flight, uncommitted slice — never the whole change.
**Where**: SDD harness process discipline — applies to any change, not specific to this codebase area.
**Learned**: The commit-per-seal convention is not just git hygiene; it is the crash-recovery mechanism. Any process deviation that batches multiple slices into one commit (to "keep history clean") trades away this property — treat it as a hard rule for long-running L changes, not a style preference.

Source: change `ts-addimport-collision` (2026-07-21)

