# Final-verify remediation delta, iteration 1

**Change**: schematic-local-files
**Iteration**: 1/3
**Scope**: remediation-delta (10-item blind Council pass on the final-verify report,
commits `d01a927`..`64c9089` on `feat/schematic-local-files`, plus the two chore commits
`7a074c4`/`fb18aa7` that record the delta in `apply-progress.md`/`verify-report.md`)
**Mode**: in-loop (Strict TDD) — REMEDIATION RE-VERIFY, not a full re-verify (final-verify
already passed at `pass-with-followups`; this pass focuses exclusively on the delta)

---

### Verdict: PASS

All 10 remediation items close their claimed Council finding, with real, independently
reproduced execution evidence — no regression, no drift, no theatre found.

---

## Per-Item Confirmation Table

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | SECURITY (headline): `runScaffold` walk-root containment | **CLOSED** | Own exploit constructed (not copied from the suite): escaping `from` (`../<out-of-ceiling>`) and symlinked `from` both reject `source-outside-package`; spied `readdirSync`/`lstatSync` myself and confirmed **zero calls** touch the out-of-ceiling tree. Applied a mutant (deleted the `validateSourceRootContainment` call in `expander.ts:117`) — my exploit test then FAILED with `readdirSync` receiving the escaping path, proving the fix genuinely gates enumeration, not just verdict shape. Reverted the mutant, re-confirmed green. Confirmed `validateSourceRootContainment` is built on the SAME extracted `resolveContainedRealpath` (`containment.ts:134-200`) that `validateSourceContainment` (file callers) uses — no parallel/weaker check forked for the directory case. Happy-path in-ceiling `from` scaffolds successfully (own test, third case). `spec.md` REQ-PRC-10 (scenarios .1/.2/.3) matches the shipped test cases 1:1 — no drift. |
| 2 | MICRO-UNFREEZE: oversized-file message reworded | **CLOSED** | `rg` for the old string (`"exceeds the serialized frame budget"`) across `src`/`test`/`openspec/specs` returns zero hits outside the historical apply-progress prose describing the diff. New string (`"is too large to render inline (over the 4 MiB limit)"`) present in `classify-transport.ts:94`, `scaffold/index.ts:31`, and the one pinning test (`test/e2e/scaffold.e2e.test.ts:214`) — code↔test in sync. No `spec.md` scenario quoted the old literal text, so no drift possible there either. |
| 3 | TEST: CCL-06 mutation coverage (`readFileSync` spy) | **CLOSED** | Applied my own mutant (deleted the `stat.size > BATCH_CAP_BYTES` gate in `classify-transport.ts:105-112`) — the strengthened test (`test/scaffold/classify-transport.test.ts:162`) FAILED as expected (`readSpy` received 1 call instead of 0), proving the assertion is a genuine gate-removal mutant-killer, not decorative. Reverted; test green again. |
| 4 | TEST: REQ-05.1 cross-chunk fixture | **CLOSED — no real atomicity bug, claim sanity-checked** | Reverted the fixture to the old 1.5+1.5 MiB sizing (under `BATCH_CAP_BYTES`) — `expect(result.emitted.length).toBeGreaterThan(1)` FAILED (`Received: 1`), confirming the old fixture never actually crossed a chunk boundary. Restored 2.2+2.2 MiB — test passes, `emitted.length > 1` AND `result.tree.size === 0` both hold, meaning the second (colliding) flush's rollback genuinely discards the first (already-succeeded) flush's staged content. The agent's "no real bug, only the fixture was too small" claim checks out. |
| 5 | TEST: PRC-07.1 message-shape parity | **CLOSED** | `test/scaffold/containment.test.ts` now asserts `errExisting.message` and `errMissing.message` are identical modulo the `relPath` substring, closing the scenario's explicit "message" clause that only `reason`/`origin` covered before. Read in context — sound, no existence leak possible through the message template (`sourceRejection` derives the message from `reason`+`path` alone). |
| 6 | TEST: FEH-04.3 `copyIn` void-return type pin | **CLOSED** | `test/types/copyin-return.test.ts` added, mirrors the established `scaffold-return.test.ts` sibling convention (`expectTypeOf(copyIn).returns.toEqualTypeOf<void>()`), type-level only, never invoked at runtime — consistent with the file family's own precedent. |
| 7 | CONTRACT: outside-run message verb-enumeration drop | **CLOSED — covers copyIn/scaffold correctly** | `authoring-error.ts:184-187`'s `outside-run` template now reads "authoring verbs can only be used…" with no per-verb list. Confirmed `currentContext()` (`context.ts:80-86`) is the SINGLE throw site — it constructs an `AuthoringError{reason:"outside-run"}` whose message is entirely derived by `messageFor`, so `scaffold`/`copyIn`/every other verb shares the identical message with no verb-specific branch — no false-exempt implication possible. `rg` for the old enumeration string (`"file verbs (create, find, modify…"`) returns zero hits outside `openspec/changes/archive/**` (historical, expected). Pinned substring (`"can only be used while a schematic is running"`) preserved byte-for-byte — zero tests needed updating, matches the commit's own claim. |
| 8 | HARDENING: exhaustiveness guards on the two directive apply-sites | **CLOSED — real `never` arms** | `Directive` (`src/core/wire.ts:28-39`) is a genuine 7-member discriminated union on `op`. Both `ContractFake#apply` (`src/testing/contract-fake.ts`) and `run-vehicle.ts`'s `applyDirective` now end with `const _exhaustive: never = directive; throw ...`, mirroring the pre-existing `authoring-error.ts` idiom. Because the union is real (not `any`/loosely typed), TypeScript would flag these lines if an 8th op were added without a matching branch — not a decorative guard. |
| 9 | FITNESS: FIT-22 scaffold leaf-rule | **CLOSED — scans the direction it claims** | Ran `test/fitness/fit-22-scaffold-leaf-rule.test.ts` directly: 38/38 pass. Confirmed both directions are real (not vacuous): direction 1 walks every file under `src/core/**`/`src/dry-run/**` and asserts none resolve an import into `src/scaffold/**` (plus a red-proof fixture that IS flagged); direction 2 walks every `src/scaffold/**` file and asserts every import resolves to intra-scaffold, `src/core/**`, or a `node:` builtin (plus red-proof fixtures for a `../commons` import and a bare `zod` import, both correctly flagged). Full fitness suite: 276/276 pass across 23 files (was 238/22 pre-remediation — exactly +38/+1, matching FIT-22 alone). |
| 10a | DOCS: `DryRunEntry.kind` axis reframe | **CLOSED** | `dry-run/plan.ts` and the `commons/index.ts` mirror (+ dts baseline) now correctly describe `kind` as present only on package-local-READ/classified verbs (`create`→`"rendered"`, `copyIn`→`"copied"`), explicitly carving out `copy` (materializes content but predates the axis) instead of the old, technically-false "content-materializing entries" framing. Comment-only; `bun test`/FIT-04 unaffected. |
| 10b | DOCS: `PC-PROTO-01` gloss in `pending-changes.md` | **CLOSED** | One-line gloss added at the BRC-02/BRC-08/PRC-06 rows section pointing to the fuller upstream definition — read in place, accurate and appropriately scoped. |

**Regressions found**: none. **Concerns found**: none blocking.

---

## Execution Evidence (run by this evaluator, not trusted from apply-progress)

| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` | ✅ **1048 pass / 0 fail** — 2013 expect() calls, 123 files, 8.59s (matches apply-progress's claimed post-remediation count exactly) |
| Typecheck | `bunx tsc --noEmit` | ✅ exit 0, clean, zero output |
| Fitness suite | `bun test test/fitness` | ✅ **276 pass / 0 fail**, 23 files (238/22 pre-remediation + FIT-22's 38 tests/1 file — arithmetic checks out) |
| Item 1 adversarial exploit (own, not from suite) | 3 tests (escaping-root, symlinked-root, happy-path) | ✅ 3/3 pass; mutant-reversion round-trip confirmed the gate is load-bearing |
| Item 3 mutation round-trip | stat-gate deletion → test failure → revert → pass | ✅ confirmed mutant-killing |
| Item 4 fixture-size round-trip | 1.5 MiB → assertion fails; 2.2 MiB → assertion passes | ✅ confirmed genuine chunk-boundary crossing |

Working tree confirmed clean (`git status --short`) before and after — no code mutation left
behind by this verification pass.

---

## Findings

None. Zero CRITICAL, zero WARNING introduced or missed by the remediation. The three
pre-existing followups carried from `verify-report.md` (permissive-proof pre-existing
failure, REQ-BRC-02/03 traceability nit, FIT-04 baseline-regen advisory) are UNCHANGED by
this delta and remain archive followups, not remediation-delta findings — none of the 10
items touch them.

---

## Envelope

- **status**: ok
- **executive_summary**: All 10 Council remediation items verified closed with independently
  reproduced, adversarial evidence — including the security headline (walk-root containment,
  confirmed via a self-constructed exploit + mutant-reversion round-trip proving rejection
  happens BEFORE enumeration, not just in verdict shape) and the two test-hardening items
  whose value could only be proven by deliberately breaking the code they guard (CCL-06 stat
  gate, REQ-05.1 cross-chunk fixture) and watching the test catch it. No regressions, no
  code↔test↔spec drift on the message-text items, no vacuous fitness function. `bun test`
  1048/0, `tsc --noEmit` clean, fitness 276/0 — all reproduced fresh, not trusted from
  apply-progress.
- **verdict**: PASS
- **routing**: n/a (no fix needed)
- **artifacts**: `openspec/changes/schematic-local-files/verify-in-loop-8.md` (this file);
  engram topic `sdd/schematic-local-files/verify-in-loop-8`
- **next_recommended**: proceed to the already-scheduled post-final-verify path —
  judgment-day (blind dual review, `adversarial_review: required` per `verify-report.md`) →
  `sdd-steward` reckoning → `sdd-archive`. This remediation delta does not need its own
  separate judgment-day pass unless the orchestrator wants the security item re-judged
  blind; the 3 pre-existing followups still ride to archive as `project/pending-changes`
  entries.
- **risks**: (1) REQ-PRC-10 is spec-additive (V3→V4) and explicitly flagged "pending owner
  sign-off at archive" in both `spec.md` and `apply-progress.md` — the archive gate must not
  skip that sign-off just because this remediation pass verified the implementation; (2) the
  3 engine-obligation seam rows (BRC-02/BRC-08/PRC-06) remain archive-gated per Q23,
  untouched by this delta — still owner sign-off pending, not a regression.
- **skill_resolution**: injected
