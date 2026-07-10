## Verify In-Loop Result

**Change**: stage-4-typed-options
**Iteration**: 3 (delta-scoped re-verify of the `verify-in-loop-2` HALT resolution ONLY)
**Scope**: REQ-TFO-04.4 locator fix (design rev 6 §4.16, ADR-0032) atop the S-001/S-002 batch
**Mode**: in-loop (Strict TDD)
**Base**: `e9a3cee` + uncommitted S-001/S-002 batch (verified in `verify-in-loop-2`, all clean except this finding) + uncommitted fix delta

---

### Verdict: PASS

The `verify-in-loop-2` SPEC finding is resolved by re-design, not by relaxing the scenario:
REQ-TFO-04.4's position-known branch is now genuinely reachable under Bun via the hand-rolled
scanner (`src/core/schema/schema-locate.ts`), the fallback branch is bounded and has LIVE
fixtures at both unit and e2e level, and the dead V8-only regex is deleted. All checks below
verified with evidence I generated myself.

### 1. Fidelity to design rev 6 §4.16 + ADR-0032

| ADR-0032 clause | Verified |
|---|---|
| `locateFirstJsonSyntaxError(raw): {line,column} \| undefined`, pure, zero-dep, no I/O | ✅ read the module — no imports beyond types, no I/O; single export matching the contract signature |
| Scanner runs ONLY in `schema-parse.ts` catch branch (no hot path) | ✅ diff shows the only call site is inside `catch` after `err instanceof SyntaxError` |
| Six MUST-pin structural classes yield a position | ✅ empirical (below): EOF/truncation, unquoted key, trailing comma, stray/garbage token, empty doc, malformed number — all pin concrete `{line,column}`; unit tests cover each class explicitly (8 cases in `schema-locate.test.ts`) |
| In-string `\u`/escape violation MAY fall back — branch must be LIVE, not dead | ✅ committed fixture `test/fixtures/red/schema/bad-unicode-escape/schema.json` is genuinely rejected by Bun's `JSON.parse` (`"\uZZZZ" is not a valid unicode escape` — verified directly) yet the scanner returns `undefined` → `(position unknown)` renders through the real built bin (e2e test asserts it) AND directly at unit level. Both branches exercised by passing tests at runtime. |
| Non-syntax invalid-shape (missing `"properties"`) NOT consulted by scanner | ✅ `parseSchema` unchanged there — `line/column: undefined` |
| Dead `locateFromSyntaxError` deleted; `err.message` never inspected | ✅ diff confirms deletion; `rg` finds no remaining `at position` regex |
| One locator serves both surfaces via `SchemaParseFailure.line/.column` | ✅ bin `formatParseError` untouched (diff of `bin/pbuilder-codegen.ts` vs `e9a3cee` is hash-identical to what iteration 2 reviewed) |

### 2. Empirical re-probe (my original six malformed shapes, real `parseSchema` path)

```
truncated           => problem: invalid JSON | line: 1 | column: 34
bad token           => problem: invalid JSON | line: 1 | column: 3
trailing comma      => problem: invalid JSON | line: 1 | column: 8
multi-line bareword => problem: invalid JSON | line: 3 | column: 3
empty string        => problem: invalid JSON | line: 1 | column: 1
non-json prose      => problem: invalid JSON | line: 1 | column: 1
```

Every shape that fell into `(position unknown)` at iteration 2 now surfaces a concrete
1-based line/column. The multi-line probe independently confirms the newline-aware walk.

**Column-only falsification**: `test/fixtures/red/schema/malformed-syntax/schema.json` places
`"type": BOGUS` on line 4 (verified by reading the fixture — `B` sits at column 15 of line 4);
both `schema-locate.test.ts` and the CLI e2e assert strict equality on `{line: 4, column: 15}`
/ the literal `(line 4, column 15)` — a column-only implementation (right column, wrong/absent
line) fails both.

**Message format unchanged**: `formatParseError` template byte-identical
(`pbuilder-codegen: <file>: <problem> (line L, column C)` with `(position unknown)` fallback);
`problem` vocabulary unchanged (`invalid JSON`); only the position slot now populates. The
previously-dishonest test name in `schema-parse.test.ts` ("...and a line/column locator...")
now actually asserts `.line`/`.column` — the exact evidence gap iteration 2 named.

### 3. FIT-14 baseline additions

Exactly three new tarball entries: `dist/core/schema/schema-locate.{js,d.ts,d.ts.map}` —
the locator's own build artifacts, nothing else. `exports` (3 keys unchanged), `files`
(`["dist"]`), `bin`, and `shebang` untouched. FIT-14 passes against a REAL
`bun pm pack --dry-run` listing (part of the green suite), so baseline↔reality parity is
machine-checked, not asserted.

### 4. Scope containment (fix delta vs iteration-2 review)

- Byte-stable vs iteration 2 (diff hashes/line-counts unchanged): `bin/pbuilder-codegen.ts`,
  `src/core/schema/index.ts`, `openspec/changes/stage-4-typed-options/slices.md`.
- Declared fix scope, confirmed present and nothing more: `schema-locate.ts` (new),
  `schema-parse.ts` (catch-branch rewire + dead-code deletion only), `schema-locate.test.ts`
  (new, 8 cases), `codegen-cli.test.ts` (the single mis-covering `(position unknown)` test
  replaced by the two-branch pair), `schema-parse.test.ts` (+2 assertions), fixtures
  `malformed-syntax/` + `bad-unicode-escape/` (the red/ tree gains exactly these two),
  `pkg-surface-baseline.json` (+3 locator entries).
- Companion artefacts, consistent not smuggled: `design.md` → rev 6 (§4.16 delta table),
  `openspec/decisions/0032-*.md` (new ADR), `openspec/decisions/0027-*.md` (Gap-8 section
  annotated SUPERSEDED with original text preserved — required by ADR-0032's supersedes
  claim), `apply-progress.md` (fix run documented incl. TDD evidence), `.sdd/state`
  (orchestrator mirror).
- Stage-2-owned files: still untouched.

### 5. Execution evidence

```
$ bun test
482 pass
0 fail
808 expect() calls
Ran 482 tests across 71 files. [1.66s]

$ bunx tsc --noEmit
(no output, exit 0)
```

(471 → 482: +8 `schema-locate.test.ts`, +1 net in `codegen-cli.test.ts` from the branch
split, +2 remaining across the updated files — all accounted for by the fix delta; 0 fail.)

### 6. Strict TDD (delta)

- RED evidence: module-not-found for the new unit file (standard for new modules);
  `schema-parse.test.ts`'s note is honest about the pre-existing test having passed trivially
  and about verifying the would-fail-against-old-impl via the empirical probes rather than a
  literal revert — acceptable, since the old regex provably never matched under Bun, making
  the new `.line`/`.column` assertions fail-by-construction against it.
- No banned assertion patterns (`toBeUndefined()` in the fallback tests asserts the
  contract's specific documented return value, not mere shape — not a tautology).
- Triangulation: 6 position-known classes + 2 fallback cases; both branches of the wiring
  conditional exercised.

### Residual notes (carried, non-blocking)

- `-h` short-flag alias in `runCli` remains untested (shares `--help`'s branch) — carried
  from iteration 2, sub-critical, for final-mode attention.
- ADR-0032 is DRAFT until archive, per house convention.

---

Orchestrator action: finding resolved — batch S-001/S-002 exits the loop. Proceed per the
build order (`/build --scope=slice:S-003` / `S-004`). Final-mode verify will re-audit the
whole change including this fix.
