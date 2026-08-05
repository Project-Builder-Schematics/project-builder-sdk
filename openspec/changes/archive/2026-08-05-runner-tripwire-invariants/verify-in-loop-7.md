## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Slice**: S-005 — Documentation Counts Derived From Live Derivation (FINAL slice)
**Iteration**: 1/3 (this slice)
**Scope**: S-005 (commits `8547d00`, `01ae6d6`, `a6878cd` over `32e8003`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All 6 checks confirmed, including the build-close sweep. No CRITICAL or WARNING findings.

### 1. Execution, typecheck, and docs-only byte-neutrality

- `bun test` full suite: run A showed the SAME known 6-failure pattern already root-caused
  at S-004's verify (all 6 in `test/e2e/installed-consumer.e2e.test.ts`, all inside
  `ensurePackedConsumer`'s `bun install` step — environmental subprocess contention, not
  re-investigated here since already conclusively diagnosed as unrelated to this change's
  code). Run B: **2548 pass, 0 fail**, 5650 `expect()` calls, 202 files — matches
  apply-progress's claimed slice-close count exactly.
- `tsc --noEmit --pretty false`: clean, zero errors.
- **Docs-only scope, confirmed by diff, not by trusting the slice description**:
  `git diff 32e8003 HEAD --name-only` returns exactly 4 files:
  `docs/runner-integrity-invariants.md`, `test/docs/runner-integrity-docs.test.ts`, and the
  two openspec bookkeeping files (`apply-progress.md`, `slices.md`). Zero `scripts/**`, zero
  `src/**`, zero other `test/fitness/**` files touched.
- **Byte-neutrality**: `rm -rf dist && bun run build` →
  `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — exact match,
  unchanged from every prior slice's close. Expected and trivial given the confirmed
  docs-only diff, but verified directly rather than assumed.

### 2. DLV-01.2's two mutants — genuinely discriminating, empirically spot-checked

Read `findStaleCountClaims` and both red-proof tests in full
(`test/docs/runner-integrity-docs.test.ts:336-386`). Each mutant test does a targeted
`.replace()` on ONE real doc phrase and asserts the function returns EXACTLY one mismatch,
naming the correct label and live value — proven exact (`toEqual([{...}])`), not merely
non-empty, so a mutation cannot collaterally trip an unrelated template without the test
noticing.

**Empirical spot-check, independent of the test's own fixture**: wrote a standalone script
importing the REAL `deriveRunnerClosure` and reproducing `findStaleCountClaims` verbatim,
then applied a DIFFERENT mutation than either committed red-proof uses (`"entry #24
because"` → `"entry #99 because"`, vs. the test's own `"entry #25 because"`) against the
real doc file. Result: **exactly one mismatch**, `{label: "entry #N because",
liveValue: 24}` — correct label, correct live value (`closureFileCount` independently
computed as 23, +1 = 24), nothing else flagged. The clean (unmutated) doc produced `[]`
against the same script. **Confirmed genuinely discriminating, not vacuous.**

### 3. `findStaleCountClaims` — live binding confirmed real, templates confirmed non-drifted

- **Live binding**: `beforeAll(() => { const distDir = ensureTscBuild(); closureFileCount =
  deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).nodes.length; })` — a genuine call into
  the real derivation function against a real fresh build, not a cached or hardcoded number.
  No `23`/`24` literal appears anywhere in the describe block's own source (confirmed by
  reading the full block) — the templates receive the count as a parameter. Independently
  corroborated: my own standalone script's fresh call to `deriveRunnerClosure` also
  returned 23, matching.
- **Template-vs-doc drift check**: rather than trust that the 7 frozen templates match the
  doc's current wording, ran a standalone script that flattens the real
  `docs/runner-integrity-invariants.md` and checks each of the 7 rendered strings
  (`lists 24 files: the`, `Hashing our own 24 files does`, `verifying 24 digests is
  equivalent`, `entry #24 because`, `` the 23 emitted `.js` files ``, `23 closure files
  plus`, `all 23 closure files:`) for literal presence. **All 7 found, none missing** —
  confirms the templates are not a vacuous check frozen against stale prose; they match the
  doc as it exists on disk today.

### 4. S-005.3 prose — full 11-member register confirmed, matches what the code enforces

Read the diff (`8547d00`) and the current doc text (Constraint 4 section,
`docs/runner-integrity-invariants.md:108-123`). The new prose names, verbatim: `eval`,
`Function`, `createRequire`, `Bun.plugin`, `process.binding`, `node:vm`,
`node:child_process`, `node:worker_threads`, `WebAssembly`, `module.register`,
`module.registerHooks` — 11 members. Cross-checked against
`scripts/capability-admission.ts`'s `DENIED_CAPABILITY_PRIMITIVES` (verified directly in
this slice's own read, and previously counted exactly 11 at S-001's verify): **identical
set, same order**. The prose also correctly replaces the retired "the same scan covers..."
deny-scan framing with default-DENY capability-admission language, and correctly states the
S-002 exemption-forfeiture rules (unaliased, resolve-only, never laundered through a
re-export or a drifted anchor) — matching XPO-01's actual mechanism exactly, not a stale
description. **Confirmed: the doc's enforcement promise matches the code exactly.**

### 5. Pre-existing 23 doc tests — untouched, additive audit

`git diff 32e8003 HEAD -- test/docs/runner-integrity-docs.test.ts` shows exactly ONE removed
line: the original `import { describe, it, expect } from "bun:test";` statement, replaced to
add `beforeAll` to the import list (needed by the new `REQ-DLV-01` describe block) — purely
additive in effect, not a content change. Full file re-run: **27 pass, 0 fail** (23
pre-existing + 4 new: non-vacuity guard, the real-doc match, and the 2 red-proofs) — matches
apply-progress's claimed net +4 exactly. No pre-existing assertion touched.

### 6. Build-close sweep (final slice)

- **`apply-progress.md` coherence**: contains all 6 slice sections (S-000, S-001, S-003,
  S-004, S-002, S-005), each with its own Status line. S-002's section states "6/7 tasks"
  with S-002.3 explicitly named as deferred to archive time; S-005's own "Next recommended"
  section independently cross-references the SAME item ("S-002.3 (the anchor-site code
  comment) remains its own, separately-tracked, deliberate archive-time obligation... not
  resolved by this slice's docs work") — consistent, not contradictory, across the two
  places it's mentioned.
- **`slices.md` completeness**: `rg "^\- \[ \]"` across the entire file returns exactly ONE
  match — S-002.3, carrying its full inline deferral rationale (byte-neutrality
  infeasibility + design.md's own archive-time classification). Every other task box across
  all 6 slices (S-000 through S-005) is checked.
- **Standing anti-`toContain` scan**: re-run in isolation, **6 pass, 0 fail** — still green
  at build close.
- **Working tree**: `git status --porcelain` clean throughout this verify pass (confirmed
  before and after every check, including after the standalone empirical scripts, which
  were run from `/tmp` and never touched the repo).

---

### Issues

None.

### Routing: none — verdict PASS

Orchestrator action: S-005 verified. All 6 slices (S-000, S-001, S-002, S-003, S-004, S-005)
of `runner-tripwire-invariants` are now in-loop-verified PASS. S-002.3 is the one
consciously-deferred, non-blocking archive-time obligation, tracked consistently across
`slices.md`, `apply-progress.md`'s S-002 and S-005 sections, and `design.md`'s Open
Questions. Per the coordinator's own framing, proceed to the single build-end PR for
`S-001..S-005` on `feat/tripwire-mechanism` (S-000 already shipped as its own PR per the
Delivery mechanics ruling).
