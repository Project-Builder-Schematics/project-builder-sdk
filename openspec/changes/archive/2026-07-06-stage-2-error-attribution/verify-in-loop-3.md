## Verify In-Loop Result

**Change**: stage-2-error-attribution
**Iteration**: 1/3 (batch 2: S-001..S-004) — report #3
**Scope**: S-001, S-002, S-003, S-004
**Mode**: in-loop (Strict TDD)
**Delta reviewed**: `git diff 4738496..HEAD` — commits `5b75692` (S-001), `fb9e3f5`
(S-004), `d52a498` (S-003), `66945b1` (bookkeeping), `aa69123` (S-002)

---

### Verdict: PASS

All scope checks green. /build can close and hand off to /evaluate.

### Execution Evidence

| Command / Probe | Result |
|---|---|
| `bun test` (full suite) | 334 pass / 0 fail / 601 expect() calls across 50 files |
| `bunx tsc --noEmit` | clean, exit 0 |
| **Probe (a)** — `primaryPath` rename/move/copy arms → destination-side (`newName`/`toDir`/`to`) | **12 fail** — all 6 REQ-14.2 cross-boundary source-path cases + 6 REQ-AEC-01.1 unit cases; wrong-path attribution, the targeted failure mode |
| **Probe (b)** — `ContractFake` `appliedCount` → cumulative-across-flushes counter | **1 fail** — exactly the REQ-15.1/15.2 multi-flush test (`expected 1, got 2`) |
| **Probe (c)** — `originFor` collapses `outside-run` into `write-rejected` | **2 fail** — context.test.ts REQ-AEC-02.1 + error-attribution.test.ts REQ-AEC-02.3 contrast |
| All probes reverted | `git diff HEAD -- src/ test/support/` empty; suite re-run 334 pass / 0 fail |

### Constraint Checks

- **Frozen vocabulary**: reason/origin/code unions untouched; the only new public union
  is `ContentState` ("absent"|"empty"|"present"), sanctioned by REQ-RT-01.4 with its own
  never-arm compile pin (`test/types/content-state.test.ts`). ✅
- **EmitRejection port-internal**: zero references in `src/commons/`, `src/index.ts`, or
  either dts baseline; FIT-10 green. ✅
- **FIT-11 genuineness**: dictionary imported from `test/support/rejection-messages.ts`
  (same module the fake's 11 throw sites compose from); scan uses
  `Object.getOwnPropertyNames` (non-enumerable covered — the REQ-AEC-05.3 plant includes
  a negative-control `Object.keys` assertion proving why); `.cause` walk bounded
  (depth 20) + identity cycle guard with a time-bound assertion; 3 permanent planted-leak
  red-proofs all exercise the scan for real. Old weak message/stack scan (incl. dead
  "OpMove") removed in S-000, not duplicated — only a descriptive comment remains. ✅
- **Droppability (constraint 3)**: `classifyContent`/`ContentState` referenced ONLY by
  `src/commons/classify-content.ts`, the severable `commons/index.ts` re-export cluster,
  its dts baseline mirror, `classify-content.test.ts`, and `content-state.test.ts`.
  `doc-discoverability.test.ts` carries zero REQ-RT-03 assertions (they live in
  `classify-content.test.ts` per the constraint). ✅
- **FIT-04**: `commons.index.d.ts` baseline delta is additive-only (2 export lines +
  JSDoc prose; no removals); gate rebuilds and passes in the full run. ✅
- **context.test.ts pin (discretion point b)**: the `:12` substring pin
  ("can only be used while a schematic is running") preserved verbatim; the full original
  prose moved unmodified into `messageFor`'s outside-run template; instanceof/origin/
  reason assertions added alongside per the Pin Disposition table. ✅

### TDD Posture (declared deviations judged, not inherited)

| Slice | Declared posture | Judgment |
|---|---|---|
| S-001 | must-fail-first | Legitimate — production change (`context.ts` plain Error → AuthoringError); the REQ-AEC-02.1 test fails against the old code by construction; probe (c) confirms sensitivity. |
| S-002 | must-fail-first per design; DEVIATION declared in apply-progress (all 11 cases green on first run, reframed characterization over the S-000-generalized mechanism) | **Legitimate, not theatre** — the deviation was declared, not hidden, and its mutation-meaningfulness claims are exactly what probes (a) and (b) independently verified (destination-path mutant → 6 S-002 failures; cumulative-counter mutant → the REQ-15 failure). Recommend verify-final record the design-tag mismatch (must-fail-first → characterization) as a lesson, not a violation. |
| S-003 | [permanent-fixture] + [characterization] (RED taxonomy (d), pre-sanctioned in slices.md) | Legitimate — FIT-11 plants are genuine red-proofs; doc pins characterize S-000-authored JSDoc. |
| S-004 | [characterization] (pre-sanctioned in slices.md) | Legitimate — falsy-trio cases kill a truthiness-coalescing mutant; type pin compiles the closed union. |

### Coverage Delta (claimed vs evidenced)

| Slice | Claimed | Evidenced |
|---|---|---|
| S-001 | REQ-AEC-02.1, REQ-AEC-02.3 | 2/2 ✅ (`context.test.ts`, `error-attribution.test.ts:97`) |
| S-002 | REQ-14.1–.3, REQ-15.1–.2, REQ-17.1 | 6/6 ✅ (REQ-14.1 via the S-000 iteration-2 mid-batch test; REQ-14.2 8 cases; REQ-14.3 round-trip-drop + cap in `batch-cap.test.ts`; REQ-15 multi-flush; REQ-17.1 e2e with real switch-arm proof) |
| S-003 | REQ-AEC-05.1–.4, REQ-AEC-03.2, REQ-AEC-04.3–.4, REQ-16.1 | 8/8 ✅ (`fit-11-*.test.ts`, `doc-discoverability.test.ts`, `fit-08` AuthoringError not-kit pin) |
| S-004 | REQ-RT-01.1–.4, REQ-RT-02.1–.3, REQ-RT-03.1–.2 | 9/9 ✅ (`classify-content.test.ts`, `content-state.test.ts`) |

**25/25 batch scenarios evidenced by passing runtime/compile tests; 49/49 for the change
overall.** S-000 unregressed (suite green; probes confirm its guards still bite).

### Findings

| # | Severity | File | Finding |
|---|---|---|---|
| 1 | MINOR (housekeeping) | `openspec/changes/stage-2-error-attribution/slices.md` (working tree) | S-002/S-004 task checkboxes marked `[x]` in the working tree but uncommitted (`.sdd/state` mirror also dirty). Commit the bookkeeping before /evaluate so the archived artefact matches reality. |

Carried forward to verify-final (unchanged by this delta): FIT-04 `DTS_PAIRS` lacks a
`core.authoring-error.d.ts` pair (iteration-1 Finding 2); design-tag mismatch on S-002
REQ-14/15/17 (must-fail-first → characterization) as a lessons-learned entry.

### Orchestrator Action

Close /build; proceed to /evaluate (verify --mode=final). Triage is L →
`adversarial_review: required` at final. Iteration 1 of 3 used for this batch.
