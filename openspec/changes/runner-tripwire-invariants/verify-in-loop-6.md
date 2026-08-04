## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Slice**: S-002 — Exemption Proof Obligation (createRequire anchor)
**Iteration**: 1/3 (this slice)
**Scope**: S-002 (commits `44c537f`, `d8838de`, `01b4bc3`, `3499a2b`, `5c9c218` over `9ae7408`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All 6 mandatory checks confirmed, including the carryover audit. No CRITICAL or WARNING
findings (S-004's WARNING from verify-in-loop-5 is resolved — see check 5). One SUGGESTION
(minor, non-blocking test-count observation).

### Audit of `44c537f` — confirmed benign, not smuggled

`44c537f` ("strengthen the unrouted-error stderr assertion with a suffix pin") is a
test-only, single-hunk change to `fit-42-runner-closure-integrity.negative.test.ts`,
explicitly captioned in its own commit message as a direct response to
"verify-in-loop-5 finding (non-blocking)." Read the full diff: it adds one `endsWith`
assertion for the message's deterministic trailing segment, alongside the existing
`startsWith` check, and rewords the adjacent comment to describe both bounds. No
production code touched, no scope beyond the exact finding it cites. **Confirmed benign
bookkeeping — not smuggled code.**

### 1. Execution + independent byte-neutrality

- `bun test` full suite: **2544 pass, 0 fail**, 5646 `expect()` calls, 202 files, confirmed
  on two independent runs (both 2544/0, stable — no flakiness this pass). Note: apply-progress
  records 2545; my two runs both show 2544. Non-root environment (`id -u` = 1000) rules out
  the obvious `skipIf(process.getuid?.() === 0)` explanation (those tests run, not skip, in
  both environments). SUGGESTION, not a finding: a 1-test discrepancy with 0 failures on
  both sides and internal consistency across my own reruns does not indicate a defect;
  flagging for awareness only, not investigated further given the stable, passing result.
- `tsc --noEmit --pretty false`: clean, zero errors.
- **Byte-neutrality, independent** (three scripts touched this slice —
  `capability-admission.ts`, `derive-runner-closure.ts`, `generate-runner-manifest.ts`):
  `rm -rf dist && bun run build` → `dist/runner-manifest.json` sha256 =
  `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — **exact match**,
  unchanged from S-001/S-003/S-004's close. This build's success is also corroborating
  non-vacuity evidence for XPO-01.5 (below): the newly-wired `findAnchorDriftViolations`
  check ran against the real closure and did not fail it.

### 2. Red-proof genuineness (empirical, ≥3 required)

| Scenario | Method | Result |
|---|---|---|
| XPO-01.3 (aliasing forfeiture) | **Empirical**: reverted `buildFileContext`'s exemption grant in the real `scripts/capability-admission.ts` to the pre-fix, unconditional form (`exemption = {...}` regardless of aliasing), alongside the XPO-01.4 mutation below in the same pass | `REQ-PPI...` — `expect(violations.length).toBe(2)` failed with **Received: 1** — exactly the documented red evidence ("1 violation... not the expected 2 — the resolve-shaped use through the alias was silently admitted"). |
| XPO-01.4 (re-export laundering) | **Empirical**: reverted `classifyOrigin`'s closure-import branch to the pre-fix unconditional admission (`if (!origin.specifier.startsWith("node:")) return admitted`), same pass as above | `expect(classifiedAs(root)).toEqual([{rule:..., file:"entry.js"}])` failed with **Received: []** — exactly the documented hole ("0 violations where 1 was expected"). Ran both affected test files together: exactly these 2 failures, 218 pass, nothing else broken. Reverted via `git checkout --`; `git status --porcelain` clean before and after; re-ran, 220/220 green. |
| XPO-01.5 (anchor drift + non-vacuity) | Code trace + build reproduction | `findAnchorDriftViolations` is a pure, 3-line predicate (`derivedNodes.includes(anchorFile)`), independently unit-tested both directions (drift caught / no drift). Confirmed it is wired ONLY into `generate-runner-manifest.ts`'s real `generate()` (immediately after the derivation-violations check), never into `deriveRunnerClosure` itself — read the exact wiring diff, matches the documented rationale (synthetic fixtures use unrelated entry files and would spuriously trip it). The non-vacuity claim ("the real closure includes the anchor file") is independently reproduced: my own fresh `rm -rf dist && bun run build` above completed successfully with this check now live in the real build path — if the anchor had drifted out of the real closure, this exact build would have failed closed. |

3 scenarios covered (meets the required minimum), 2 with genuine empirical mutation +
revert against the real production file, 1 confirmed by direct wiring/build-reproduction
evidence (a live-fire, not merely narrated, non-vacuity proof).

### 3. The two "beyond-literal-task-text" fixes — required by the acceptance criterion, stricter-only

Both fixes in `d8838de` go beyond S-002.1/.2's literal task-list wording, but are directly
named by the slice's own **Acceptance** block (`slices.md`, S-002 section): "any other
arrangement (**aliased**, **re-export-laundered**, anchor drifted out of the closure)
forfeits and denies every bound name (XPO-01.3/.4/.5)." Both "aliased" and
"re-export-laundered" are cited verbatim — neither fix is scope creep; both are the literal
acceptance criterion's own named arrangements.

**Stricter-only, confirmed by diff direction**:
- Aliasing fix: `exemption = {...}` (unconditional) → `if (!isAliased) { exemption = {...} }`
  — this REMOVES a previously-granted admission path (an aliased anchor binding no longer
  gets an `ExemptionProof`). No new admission path is added anywhere.
- Re-export-laundering fix: `if (!origin.specifier.startsWith("node:")) return admitted` →
  `if (!origin.specifier.startsWith("node:") && !DENIED_CAPABILITY_PRIMITIVES.has(origin.importedName)) return admitted`
  (else: violation) — this REMOVES admission for the specific subset of closure-imports
  whose imported name is itself a denied register primitive. No new admission path is added.

Both diffs are pure narrowing of a previously over-permissive branch — confirmed no widening
anywhere in either commit.

### 4. S-002.3 deferral — genuinely classified archive-time, byte-neutrality rationale verified directly

`design.md`'s Open Questions section (final paragraph, ~line 427) lists, verbatim, "an
explicit code comment at the anchor site cross-referencing REQ-CST-04.4 and REQ-XPO-01.2 so
the synthetic-vs-real scoping is not left implicit (spec Open Item 2)" among three items
explicitly headed "recorded as **archive-time obligations**, not design blockers" — matches
apply-progress's citation exactly, not fabricated.

**Byte-neutrality rationale, verified directly (not trusted)**: read `tsconfig.build.json`
(the config `bun run build`'s `tsc -p tsconfig.build.json` step actually uses) and
`tsconfig.json` — neither sets `removeComments`, and TypeScript's own documented default for
`removeComments` is `false` (comments ARE preserved in emitted `.js` output). This
independently confirms: editing `src/transport/single-instance-probe.ts` to add the
cross-referencing comment WOULD change `dist/transport/single-instance-probe.js`'s bytes,
which WOULD move the manifest's digest for that file and break REQ-CAP-06. This is also
corroborated by an already-existing, independently-designed test in the same suite
(`REQ-RCD-03.3`'s JSDoc-quoting-files test, S-000 tier), whose entire premise is that source
comments survive byte-for-byte into `dist/`. **Confirmed: the deferral is real, the design
citation is accurate, and the technical rationale holds under direct inspection.**

### 5. S-004's WARNING — resolved in this pass, not carried to S-005

Confirmed via the `44c537f` audit above: the exact WARNING from `verify-in-loop-5`
("the `startsWith` exception checks only the deterministic prefix, not the equally
deterministic suffix") was directly addressed BEFORE S-002's own commits began, by adding
the `endsWith` check for the fixed trailing segment. Read the current test
(`fit-42-*.negative.test.ts:1759-1763`): both bounds are now asserted, leaving only the
genuinely non-deterministic stack-trace fragment in the middle unassorted — exactly the
strongest assertion achievable given the real constraint (an embedded `error.stack` cannot
be hardcoded portably). **Status: RESOLVED, does not carry forward to S-005.**

### 6. Standing scan, whole-verbatim, baseline additive-audit

- Standing scan re-run in isolation: **6 pass, 0 fail** — unchanged, still green.
- New `toContain` calls introduced by S-002's diff: exactly one
  (`expect(derivation.nodes).toContain(CREATE_REQUIRE_ANCHOR_FILE)`,
  `fit-42-*.negative.test.ts:288`) — an ARRAY-MEMBERSHIP check on a closure-path list, not a
  message/rendered/reason/stderr receiver, matching the scan's own documented exemption for
  membership/content checks (same pattern as pre-existing `paths.toContain(...)` uses
  elsewhere in the family). Not a whole-verbatim violation.
- **Additive-audit** (`git diff 9ae7408 HEAD` on both `fit-42-*` files, every removed line
  read in context): three categories, all accounted for —
  1. The `44c537f` carryover's comment rewording (superseded by the stronger version, not a
     weakening — see check 5).
  2. **S-002.5's threshold-to-exact tightening**: both removed `toBeGreaterThanOrEqual(2)`/
     `(1)` lines replaced by exact `toBe(2)`/`toBe(1)` on the SAME two S-001-era tests named
     in apply-progress (the aliased-execute and unaliased-decoy forfeiture cases) — confirmed
     by reading the diff hunks directly; this is strictly STRONGER (a lower-bound assertion
     tolerates extra spurious violations; an exact count does not).
  3. One import-list addition (`findAnchorDriftViolations` added to the import block —
     additive).
  No other pre-existing assertion was weakened, removed, or diluted.

---

### Issues

None blocking. One SUGGESTION (test-count discrepancy, check 1) logged for awareness only.

### Routing: none — verdict PASS

Orchestrator action: S-002 verified — batch 3 is complete. Per the Build Order, S-005
(documentation counts derived from live derivation, SC-4) is the only remaining slice.
