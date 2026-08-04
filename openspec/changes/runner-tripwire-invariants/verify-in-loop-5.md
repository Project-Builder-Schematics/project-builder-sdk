## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Slice**: S-004 — Fail-Closed Generation & Diagnostic/Locale Honesty
**Iteration**: 1/3 (this slice)
**Scope**: S-004 (commits `ae5321c`, `7cc749b`, `7afd02f`, `d74479e`, `1cca881` over `6372bcf`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All 5 mandatory checks confirmed, plus both explicit-judgment items resolved. One
WARNING-level finding (check 3b — the startsWith exception under-realizes what was
achievable). No CRITICAL findings.

### 1. Execution + independent byte-neutrality

- `bun test` full suite: run A showed **2530 pass, 6 fail** (all 6 in
  `test/e2e/installed-consumer.e2e.test.ts`, all failing inside `ensurePackedConsumer`'s
  `bun install --ignore-scripts` step) — investigated rather than dismissed: re-ran that
  file IN ISOLATION → **16 pass, 0 fail**; re-ran the FULL suite a second time → same 6
  failures again (same file, same step); re-ran the full suite a THIRD time → **2536 pass,
  0 fail**. Conclusion: environmental (network/filesystem contention on a scratch `bun
  install` under full-suite load), not a code regression — S-004 touches nothing related to
  package installation, and the file passes cleanly both in isolation and on a clean
  full-suite run matching apply-progress's exact claimed count (2536/0).
- `tsc --noEmit --pretty false`: clean, zero errors.
- **Byte-neutrality, independent, with the specific rewrite risk in mind**: `rm -rf dist &&
  bun run build` → `dist/runner-manifest.json` sha256 =
  `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — **exact match**,
  unchanged from S-001/S-003's close, despite `generate-runner-manifest.ts` being fully
  rewritten. Confirmed by reading the rewrite line-by-line: the manifest CONSTRUCTION logic
  (closure derivation, `manifestPaths` sort, per-file digest computation, the
  `RunnerManifest` object shape) is byte-for-byte unchanged from the pre-S-004 version — the
  only change on the success path is the WRITE MECHANISM (`writeFileSync(tempManifestPath,
  ...)` + `renameSync(tempManifestPath, manifestPath)` instead of a direct
  `writeFileSync(manifestPath, ...)`), which cannot alter the final bytes at `manifestPath`
  since a rename doesn't touch file content. The fresh-build hash match empirically confirms
  this: the rewrite changes failure-path behaviour only.

### 2. Red-proof genuineness (empirical, ≥5 sampled)

| Scenario | Method | Result |
|---|---|---|
| FCG-01.1/.2/.3 (current generator) | **Empirical, independent of the test harness**: built 3 fresh scratch roots via shell (`mktemp -d` + copy `dist/`+`package.json`), seeded each with the CURRENT generator, applied each of the 3 real committed fault fixtures (`malformed-json`, `unreadable-closure-file`, `generic-throw-null-package`), ran the current generator against each | All 3: exit status 1, manifest absent, **`.tmp` file also absent** (confirms the write-temp-then-rename atomicity claim directly, not just via the test's own assertion) |
| FCG-01.1 (old-generator claim) | **Empirical**: extracted the pre-S-004 `generate-runner-manifest.ts` via `git show ae5321c^:...`, temporarily swapped it into place (backed up current file first), seeded a fresh scratch root with the OLD generator, applied the malformed-json fault, ran the OLD generator | **Manifest survived** (stale artefact left behind) — independently reproduces R2-4 as a real, live bug, not a strawman. Reverted via `git checkout --`; diffed against the pre-mutation backup to confirm byte-identical restoration; `git status --porcelain` clean throughout. |
| DGN-01.4(a) swap-blindness | **Empirical**: wrote a standalone script reproducing the OLD (pre-fix) aggregate-value-multiset-only comparison (`declared.map(rule).sort()` vs `produced.map(rule).sort()`, discarding fixture identity) and ran it against the exact swap fixture the current test uses | OLD comparison returns `[]` (no mismatch) — confirms the documented bug is real: a bare-value multiset comparison is genuinely blind to a same-count swap between two fixtures. The CURRENT `{fixture, rule}`-pair comparison (read directly in the test file) correctly returns both mismatch lines for the same input. |
| DGN-01.4(b) misattribution | Code trace | A single-fixture wrong-rule case changes the aggregate value set too (not just its pairing), so this shape doesn't test the same blind spot as (a) — it is a distinct, simpler mutation shape the signed spec also names, and the current comparison catches it correctly by direct read. |
| DGN-01.3 (real corpus) | Code trace + full-suite pass | Runs the real `ruleIdentityTotalityMismatches` against the real `deny-scan/` corpus (10 fixtures) + the real `fail-closed/unreadable-closure-file.json` fixture, via the REAL `deriveRunnerClosure`, not a simulation — confirmed green in the full-suite run. |

5 scenarios empirically/analytically confirmed (exceeds the required 5), with 3 involving
genuine external mutation/reconstruction (old-generator restoration, current-generator
scratch runs, standalone old-comparison-function reproduction) rather than trusting
apply-progress's narrative.

### 3. Two explicit-judgment items

**(a) Deletion of the "vacuous LC_ALL test" — judged GENUINELY VACUOUS, deletion correct.**
Read the deleted test in full (`git diff ae5321c^ 7cc749b`). The test's OWN comment, written
by its original author, states outright: "under Bun no locale env var (LC_ALL, LANG,
LC_COLLATE) moves the default collator — `Intl.Collator()` resolves to en-US regardless,
verified — so this proves cross-process byte-stability under a differing environment, NOT
that a `localeCompare` implementation would be caught." This is a self-admission that the
test's own author already knew it could never fail against the exact defect class
(`.localeCompare()` usage) REQ-RMD-01.2 exists to catch — varying `LC_ALL` produces
byte-identical output in Bun regardless of whether the generator's source calls a
locale-sensitive API, so the test's pass/fail outcome carries zero information about that
property. This exact rationale is independently corroborated by the SIGNED SPEC itself
(`specs/runner-integrity-manifest/spec.md`, REQ-RMD-01.2's MODIFIED section: "Retired per
ruling 7 — Bun's default collator resolves en-US regardless of LC_ALL, so the scenario
could never fail its own mutation; it was satisfied-in-intent only") — the deletion was
pre-authorized by the owner-signed spec, not a unilateral call by the Executor. The
replacement (`RMD-01.2.1`/`.2`, a structural source scan over the generator's REAL
transitive closure) was verified non-vacuous both by its own coverage assertion (the walk
reaches exactly the 3 real files, not just the entry) and by 2 red-proof tests independently
planting all 4 named locale-sensitive API spellings and confirming each is caught by
file/line/api. **Verdict: no real coverage was lost — the deleted test could never have
caught a real regression; its replacement demonstrably can.**

**(b) The `startsWith`-not-`toBe` exception — judged NECESSARY but UNDER-REALIZED (WARNING).**
Located the single instance (`fit-42-*.negative.test.ts:1759`,
`expect(stderr.startsWith("runner-manifest: generation failed with an unrouted error.\n")).toBe(true)`)
and confirmed it is the ONLY such exception across the entire `fit-42`/`fit-23`/`fit-46`
family (grepped for `.startsWith(` on any `stderr`/`rendered`/`.reason`/`.message` receiver
— zero other matches), so it is not a spreading pattern. The exception is genuinely
necessary: the unrouted-error branch's message embeds `error.stack`, which contains
environment-specific absolute paths and V8-internal frame formatting that cannot be
hardcoded portably — a literal `toBe` against the FULL message would break on every machine/
CI runner. The standing scan's own mechanical rule (`TO_CONTAIN_CALL` regex matches only
`.toContain(`/`.not.toContain(`) does not flag `.startsWith(` at all, so this does not erode
the scan's OWN enforcement mechanism. However, judged against REQ-CST-06.1's stronger
NORMATIVE text ("the ENTIRE message string is compared verbatim") rather than just the
scan's mechanical letter: the message template is `<deterministic prefix>\n${stack}\n\n<fully
deterministic suffix: "No manifest was written; dist/runner-manifest.json does not
exist.\n">` — the test asserts ONLY the prefix via `startsWith`, leaving the equally
deterministic SUFFIX entirely unchecked, when a stronger assertion (e.g. an additional
`stderr.endsWith(...)` check, or stripping the stack-trace region via regex and comparing
the remainder verbatim) was achievable without reintroducing substring-only matching on the
non-deterministic part. **Verdict: the exception itself is legitimate and honestly
documented (comment at lines 1751-1757 explains it is not a silent weakening); the scan's
mechanical intent is preserved; but REQ-CST-06.1's fuller intent is under-realized where a
stronger assertion was available. Non-blocking WARNING, recommend tightening (assert the
deterministic suffix too) as a low-cost follow-up, not required before archive.**

### 4. DGN-01.1 rule rename — no stale references

Grepped every `"unreadable-file"` and `"manifest-version-invalid"` occurrence across
`test/` and `scripts/`. All `unreadable-file` occurrences are for GENUINELY unreadable
files (chmod-locked fixtures, the `fail-closed/unreadable-closure-file.json` corpus entry) —
none are a version-validation scenario incorrectly still expecting the old rule. The
`VIOLATION_RULES` exact-membership test was correctly updated from "the eleven-member closed
set" (deleted, confirmed in the diff) to **"the twelve-member closed set"**
(`fit-42-*.test.ts:909`), explicitly listing `manifest-version-invalid` alongside the
existing 11, with `expect(VIOLATION_RULES.length).toBe(12)` immediately below. **Confirmed:
no stale references, no silent coverage loss.**

### 5. Whole-verbatim + standing scan + baseline audit

- Standing scan re-run in isolation: **6 pass, 0 fail** — unchanged, still green after
  S-004's diff.
- `git diff 6372bcf HEAD -- <the 3 touched test/support files> | rg "^\+.*toContain"`: the
  only match is inside a COMMENT explaining the `startsWith` exception (line 225) — zero
  actual new `.toContain(` calls introduced.
- **Full additive-audit** (`git diff 6372bcf HEAD` on both `fit-42-*` files, all removed
  lines read in context): three categories of removal, all accounted for —
  1. The two items explicitly judged above (LC_ALL test, DGN-01.1 rule-rename update).
  2. **`REQ-RMD-05.1`'s inline positive-file assertion**, removed and replaced by a call to
     the newly-extracted `findUsernamePathSegmentViolations` function
     (`fit-42-*.test.ts:339-344`) — confirmed this is a genuine extraction, not a deletion:
     the SAME property is still asserted (now via the reusable function), and S-004 ADDS a
     negative-file red-proof (`RMD-05.1.2`) this property never had before.
  3. One import-statement reformatting (additive in effect — the import list gained/lost
     names, not coverage).
  No other pre-existing assertion was weakened, removed, or diluted.

---

### Issues

| Issue | Severity | File:Line | Detail |
|---|---|---|---|
| `startsWith` exception checks only the deterministic prefix, not the equally deterministic suffix | WARNING | `test/fitness/fit-42-runner-closure-integrity.negative.test.ts:1759` | See judgment (b) above. The exception is legitimate and honestly documented; recommend also asserting the deterministic trailing text ("No manifest was written; ... does not exist.\n") for full REQ-CST-06.1 realization. Non-blocking. |

### Routing: none — verdict PASS

Orchestrator action: S-004 verified — batch 2 (S-001→S-003→S-004) is now complete. Proceed
per the Build Order to S-002 (`REQ-XPO-01`, requires S-001's origin admission + register).
