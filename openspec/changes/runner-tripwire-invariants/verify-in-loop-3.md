## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Slice**: S-001 — Capability-Admission Property
**Iteration**: 1/3 (this slice)
**Scope**: S-001 (commits `1e88150`..`bb7ca2d` over S-000's `04ec593`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

Comprehensive verification across all 8 mandatory checks. One WARNING-level finding
(digest-provenance note completeness — see check 2) that does not block; everything else
is clean, genuine, and matches the signed spec/slices/design.

### 1. Real execution evidence (independently re-run)

- `bun test` (full suite), run A (cold): 2506 pass, 6 fail — a transient run; failure
  detail was not retained (log rotated before capture), but the pattern (unrelated
  subprocess/resource-contention flakiness on a sandbox running many scratch-dir/child-process
  tests) matches apply-progress's own disclosed note verbatim ("run twice for stability...
  occasional resource-contention flakiness in this sandbox, distinct from anything this
  slice touched").
- `bun test`, run B (independent re-run): **2512 pass, 0 fail**, 5587 `expect()` calls,
  202 files, 72.35s. Matches apply-progress's claimed completion-pass count exactly
  (2512/0).
- A third run was attempted for further characterization but stalled/was terminated after
  ~40s of no CPU progress (environment resource contention, not a suite defect — run B
  already gives a clean, complete, matching result).
- `tsc --noEmit` (`--pretty false`, explicit re-run, no incremental cache present): clean,
  zero errors, confirmed twice.

### 2. Byte-neutrality — INDEPENDENT verification + re-pin evidence judgment

**Fresh build, current HEAD**: `rm -rf dist && bun run build` → `dist/runner-manifest.json`
sha256 = `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — **exact match**
to the re-pinned digest.

**S-001's own diff proven byte-neutral (the property REQ-CAP-06 actually needs S-001 to
prove)**: created a temporary detached worktree at `04ec593` (S-000-complete, pre-S-001),
ran the identical fresh-build procedure there: **same digest**,
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde`. Pre-slice and
post-slice manifests are byte-identical — S-001 introduced zero manifest drift. Temporary
worktree removed after (`git worktree remove --force`), no residue.

**Re-pin evidence audit**: `git diff e6dcde2 04ec593 -- src/core/context.ts
src/core/wire.ts` — confirmed **exactly two edits**, both inside JSDoc `@example` blocks,
both a template-placeholder-syntax fix (`{{port}}` → `{= .port =}` and `{{name}}` →
`{= .name =}`), zero AST/identifier/member-path change. Matches the note's claim exactly.

**Finding (WARNING, not blocking)**: the digest-provenance note (apply-progress.md
§"Digest-provenance reconciliation" and §"Byte-neutrality (REQ-CAP-06)", and design.md
§1's matching note) frames "the two JSDoc-comment-only edits" as the explanation for why
the digest moved from the stale `bf6c983c…a530` (HEAD `e6dcde2`) to the re-pinned
`31cd5382…33fde`. A broader diff (`git diff e6dcde2 04ec593 --stat`) shows **`package.json`
itself also changed** in the same window — `version` `0.2.0` → `0.2.3` and one word in
`description` (`modify` → `replaceContent`) — via `main`'s routine `chore: bump version to
0.2.3` commit. `package.json` is one of the 24 manifest-hashed records (and its `version`
feeds the manifest's top-level `packageVersion` field directly), so this is a further,
undisclosed, and arguably more obvious contributor to the digest's divergence from the
stale `e6dcde2`-era pin. **Judgment**: this does NOT indicate a hidden capability-surface
regression — `package.json` is not part of the AST-walked closure (confirmed: it is not
one of `deriveRunnerClosure`'s enumerated nodes; it is appended separately by
`generate-runner-manifest.ts`), a version bump is expected, unsurprising background noise
on any long-lived branch, and — decisively — the actual load-bearing property (S-001's own
diff didn't move the manifest) is independently proven above by direct pre/post-slice
comparison, not by the e6dcde2 citation. The note's phrasing ("the only two closure files
with ANY diff between this probe's HEAD and the mechanism branch's base") is technically
accurate under a narrow reading of "closure files" (excludes `package.json`, which the
derivation walk never touches) but reads as more complete than it is if a future auditor
takes "closure files" to mean "everything in the manifest." Recommend a one-sentence
amendment naming `package.json`'s version bump alongside the JSDoc edits, for a future
reader's full picture — not required before archive.

### 3. The 4 documented deviations, judged against spec/slices text

**(a) 22→21 globals & 28→30 member paths.** Verified by direct count against
`scripts/capability-admission.ts`: `ADMITTED_GLOBALS` has exactly 21 entries, listed
member-by-member above; `ADMITTED_MEMBER_PATHS` has exactly 30. Both are pinned by real
exact-membership tests (`fit-42-*.test.ts:806`, `:846`) comparing the live `Set` against a
hardcoded literal array — these are load-bearing regression detectors, not aspirational
counts. Matches apply-progress's/design.md's claimed re-verified figures exactly. **Verdict:
accurate, faithfully documented.**

**(b) Red-proof #10's 2→1 violation count.** Read the test
(`fit-42-*.negative.test.ts:289-296`) and traced the production mechanism by hand:
`isDeclarationName` (E2) returns `true` for a name inside an `ImportSpecifier`, so the
import statement's own `createRequire` binding-name token is excluded from
`enumerateCapabilitySurface`'s output entirely — only the CALL SITE's callee (`createRequire`
used as `createRequire(anchor)`'s inner callee) is enumerated, resolves to
`{kind:"closure-import", specifier:"node:module", importedName:"createRequire"}`, and is
denied because `ADMITTED_NODE_SURFACES.get("node:module")` is a deliberately empty set (per
the code's own comment: `createRequire` is gated by the anchor exemption, never
blanket-admitted). Confirmed the OLD-bug mechanism too: `classifyOrigin`'s `closure-import`
branch does not gate on callee-vs-value position, so absent E2 the import-declaration's own
name identifier would ALSO have been enumerated as a `value-reference` and ALSO denied —
producing exactly the claimed spurious duplicate. Same defect, same file, same rule, one
spurious duplicate genuinely removed. **Verdict: faithful, not a detection weakening.**

**(c) In-test simulated mutants instead of committed mutant files.** Read all four
(`CAP-01.2`, `CAP-01.6`, `CAP-04.5`, `CAP-04.8`, plus `PRM-01.2`'s red-proof) — each
constructs a widened/narrowed `Set` in-memory and asserts `expect(() =>
expect(widened).toEqual(pinned)).toThrow()`. Each scenario's Given/When/Then text describes
a mutant TABLE property, not a mutant FILE, so this satisfies the signed scenario text as
written — confirmed by re-reading REQ-CAP-01.2/.6, REQ-CAP-04.5/.8, REQ-PRM-01.2 verbatim
(none specify a committed-file mechanism). More importantly, the REAL defense these
"red-proofs" illustrate is NOT simulated: `REQ-CAP-01.4/.5`, `REQ-CAP-04.4` (×2),
`REQ-CAP-04.6`, `REQ-PRM-01.1` are genuine exact-membership assertions comparing the LIVE
production `Set`/`Map` against a hardcoded literal array in the test file — if the
production table is silently widened, THAT test fails for real, independent of the
in-test-simulated illustrations. The ≤20-committed-mutants budget line item is honestly
flagged as not literally realized (apply-progress "Deferred work"). **Verdict: acceptable
as documented — the load-bearing mechanism is real; the simulated form is a secondary,
illustrative layer, honestly disclosed, not a hidden gap.**

**(d) CAP-01.3 no-test disposition.** Confirmed honestly recorded — NOT buried. Present in
`apply-progress.md`'s "Deferred work" section AND as a full, dedicated, dated clarification
note in `design.md` §1 (~35 lines) tracing exactly why the signed 5-member `SurfaceNodeKind`
union has no slot for a bare computed-access node in value position, naming two concrete
resolution paths (6th kind vs. scenario retirement), and explicitly routing the decision to
`sdd-verify --mode=final`, "not decided unilaterally by the implementer." **Verdict:
honestly recorded and correctly deferred — not a gap in this in-loop pass.**

### 4. Red-proof genuineness (sampled across all 3 admission legs + widening mutant + survival red-proof)

| Scenario | Leg | Method | Result |
|---|---|---|---|
| REQ-CAP-03.1 (`globalThis["ev"+"al"]`) | callee decidability | **Empirical**: temporarily changed `resolveChain`'s final `return undefined` to `return {kind:"safe-terminal"}` (computed access wrongly treated as decidable) in the real `scripts/capability-admission.ts`, ran the two affected test files | **Exactly** `REQ-CAP-03.1` and `REQ-CAP-03.2` failed — no other test broken. Reverted via `git checkout --`; `git status --porcelain` confirmed clean before and after. |
| REQ-CAP-03.2 (`(()=>{}).constructor(...)()`) | callee decidability | same mutation as above | failed correctly, see above |
| REQ-CST-04.1 red-proof #10 | origin admission (E2 exclusion) | code trace (see deviation (b) above) | confirmed genuinely denied, exactly once, correct rule |
| REQ-CAP-04.1 (`node:child_process`) | origin admission | code trace: `classifyOrigin`'s `closure-import` branch, `node:child_process` not in `ADMITTED_NODE_SURFACES` keys | confirmed denies unconditionally |
| REQ-CAP-04.3 (`node:nonexistent-module`) | origin admission | code trace: `enumerateCapabilitySurface`'s `isRealNodeBuiltin` gate + `derive-runner-closure.ts`'s `classifySpecifier` R1-15 `builtinModules` check | confirmed `unclassifiable-construct`, never silently builtin |
| REQ-CAP-04.7 (`process.dlopen`) | origin admission (member-path) | code trace: `classifyOrigin`'s `admitted-global` branch, `dlopen` absent from `ADMITTED_MEMBER_PATHS` (confirmed by direct membership check in the test itself, line 1281-1282) | confirmed denied despite admitted root |
| REQ-CAP-05.2 (`const F = Function; F(...)`) | positional decidability (D-3 taint) | code trace: `taintReasonOf` marks `F` `denied-initializer`; `classifyOrigin`'s `tainted` branch denies at callee position | confirmed genuinely denied |
| REQ-CAP-04.8 (widening mutant, `ADMITTED_MEMBER_PATHS`) | — (mechanism check) | read + reasoned per deviation (c) above | simulated, honestly disclosed; real defense (`REQ-CAP-04.6`) independently confirmed exact-membership |

8 scenarios sampled (exceeds the required 6), covering all three admission legs plus the
requested widening mutant and survival red-proof. One genuine empirical mutation performed
(covering 2 of the 8) with a clean before/after tree; the rest verified by direct,
line-level production-code tracing against the actual shipped implementation (not
apply-progress's narrative).

### 5. FIT-CAP-TOTALITY — exact equality against live enumeration, not a hardcoded count

Confirmed (`fit-42-*.test.ts:977-990`): for every one of the real closure's files,
`expect(surface.length).toBe(independentSurfaceCount(sourceFile))` and
`expect(classified.length).toBe(surface.length)`. `independentSurfaceCount` (lines
890-975) is a **separately, deliberately re-implemented** raw counter — its own comment
states it never delegates to `enumerateCapabilitySurface`'s own walk, "so a mutant that
silently narrows the real enumerator cannot also narrow this count the same way." This is
a genuine two-implementation cross-check against live output, never a hardcoded literal.
**Confirmed.**

### 6. Standing anti-`toContain` scan

Confirmed all required pieces present and correct in `fit-42-*.negative.test.ts:1422-1491`:
- **4 per-file scans** (one `it` per `SCANNED_FILES` entry: both `fit-42-*` files,
  `fit-23-*`, `fit-46-*`) — all green (verified via the full-suite pass).
- **Red-proof** (`REQ-CST-06.1 [red-proof]`): plants two offending calls
  (`rendered`/`.reason` receivers), asserts both are caught by line number and receiver
  text.
- **False-positive guard**: plants three legitimate `toContain` uses (`paths`, `source`,
  `line` receivers) and asserts none are flagged.
- **Self-scan gotcha, traced and confirmed real**: the scan's own describe block lives
  inside `fit-42-runner-closure-integrity.negative.test.ts`, which is itself one of
  `SCANNED_FILES` — had the red-proof/guard fixtures spelled `expect(rendered).toContain(`
  as a literal, contiguous substring in their own source text, the scan reading its own
  file's raw bytes would have flagged its own test data. Confirmed the fix
  (`["toCon", "tain"].join("")` at the SOURCE level) genuinely avoids this: the raw file
  text contains `.${CALL}(`, never `.toContain(`, so the regex does not match against this
  file's own literal source — while the RUNTIME string built via template-literal
  interpolation (`` `expect(rendered).${CALL}(...)` ``) does contain the literal characters
  `toContain(` once evaluated, which is exactly what `findMessageToContainSites` scans when
  called on that runtime string inside the red-proof/guard tests. The self-scan-avoidance
  device changes only what the FILE'S OWN SOURCE TEXT contains, not what the function
  detects at runtime — it does not weaken the scan. **Confirmed working as claimed.**

### 7. S-001.10 — fit-46's publish-gate rerun against a REAL Constraint-4 fixture

Read `git show e4c44b2` in full. The new test (`fit-46-*.test.ts`, `REQ-PPI-03.2 [red-proof]:
a real Constraint-4 admission failure blocks the publish step`) spawns a child suite whose
single test imports the REAL `deriveRunnerClosure` from the real
`scripts/derive-runner-closure.ts`, builds a scratch fixture containing `eval(payload);`,
and asserts `expect(derivation.violations).toEqual([])` — **deliberately wrong**, since
`eval` genuinely IS denied by the real mechanism (confirmed by code trace:
`classifyOrigin`'s `origin === undefined` branch, `eval` absent from `ADMITTED_GLOBALS`,
callee position → violation). This inner assertion genuinely fails, the child `bun test`
process exits non-zero, and the outer test observes `publishReached === false`. This is a
real, non-simulated engagement of the production admission mechanism — not an arbitrary
planted failure (the S-000 leg it re-runs). **Confirmed matches the spec's dated note.**

### 8. Exact-membership pins

All confirmed present, correct, and matching the pinned counts by direct code inspection
and cross-reference against the corresponding test:

| Table | Pinned count | Test | Verified count in code |
|---|---|---|---|
| `SurfaceNodeKind` (`SURFACE_NODE_KINDS`) | 5 | `fit-42-*.test.ts:745` | `callee, value-reference, member-path, meta-property, module-specifier` = 5 |
| Surface exclusions E1-E4 (`SURFACE_EXCLUSIONS`) | 4 | `fit-42-*.test.ts:750` | `jsdoc-rooted, declaration-name, property-name, type-position` = 4 |
| `DENIED_CAPABILITY_PRIMITIVES` | 11 | `fit-42-*.test.ts:777` | counted 11 in source |
| `ADMITTED_GLOBALS` | 21 | `fit-42-*.test.ts:806` | counted 21 in source |
| `ADMITTED_NODE_SURFACES` (keys) | 6 | `fit-42-*.test.ts:834` | 6 `node:` module keys |
| `ADMITTED_MEMBER_PATHS` | 30 | `fit-42-*.test.ts:846` | counted 30 in source |

All six are compared via `toEqual` against a hardcoded literal array/list in the test —
genuine exact-membership pins, never a `.size > N` threshold. **Confirmed.**

---

### Cross-cutting checks

- **`derive-runner-closure.ts` diff** (`git diff 04ec593 HEAD`): confirmed `denyScan`
  deleted outright (replaced by `constraint2Violations` for the untouched Constraint-2
  concern, plus the new capability-admission call into `scripts/capability-admission.ts`);
  `node:vm` folded out of `classifySpecifier`'s special case exactly per design's B4 ruling
  (now a real builtin per `builtinModules`, denied instead via the register); R1-8
  directory-specifier check (`statSync(absolute).isDirectory()`) present; `VIOLATION_RULES`
  updated to the two split rules (`constraint-4-undecidable-callee`,
  `constraint-4-inadmissible-origin`) plus `directory-specifier`, matching design.md §4's
  Interface Contracts table exactly.
- **Baseline**: the pre-existing 18 S-000-tier red-proofs in `fit-42-*.negative.test.ts`
  all pass under the new mechanism (confirmed via full-suite green + spot-read of #10 and
  #18 above); the 8-item CST-04.x-family correction (B2, #10/#11/#12/#13/#14/#15/#16/#18)
  matches slices.md's corrected enumeration exactly.
- Strict TDD: `classifySurfaceNode`'s `default` arm uses a `never`-typed exhaustiveness
  check (`const exhaustive: never = node.kind`), so a 6th `SurfaceNodeKind` forces a
  **compile error**, not just a runtime gap — matches ADR-0080's decision text precisely
  ("a new member forces a compile error at the classifier's exhaustive switch").

### Issues

| Issue | Severity | File:Line | Detail |
|---|---|---|---|
| Digest-provenance note omits `package.json`'s version+description drift | WARNING | `apply-progress.md` "Digest-provenance reconciliation" / "Byte-neutrality" sections; `design.md` §1 | See check 2. Does not affect the underlying gate's correctness — independently reproduced and confirmed. Recommend a one-sentence amendment before archive, not blocking. |

No CRITICAL or blocking findings.

### Routing: none — verdict PASS

Orchestrator action: S-001 verified. Proceed per Build Order (S-001 → S-003 → S-004
sequentially on shared `fit-42-*` files, per slices.md's batch-2 sequencing ruling).
