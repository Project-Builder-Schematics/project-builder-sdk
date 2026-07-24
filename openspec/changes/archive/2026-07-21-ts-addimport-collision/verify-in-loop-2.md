## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 2/3
**Scope**: S-000 (delta re-check of iteration-1 Finding 1 fix)
**Mode**: in-loop (Strict TDD)
**Fix commit**: `91a84ce` (diff vs `1819885`)

---

### Verdict: PASS

Iteration-1's sole WARNING is resolved. Fix is minimal, correctly scoped, correctly placed, and
`src/` is untouched as claimed. No regression.

- Delta tests: `ops-addImport.test.ts` 7/7 pass, 14 expect() calls
- Full suite: 2064/2064 pass, 0 fail, 4430 expect() calls, 191 files (+3 expect() calls vs
  iteration-1's 4427, exactly the 3 new assertions, zero new/removed tests, zero regressions)
- Typecheck: clean
- Spec compliance for scope: 11/11 REQ-IDs still hold; the fixed rows (`.10`/`.13`/`.31`) now
  assert the FULL dual observable the spec text specifies

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive.

---

### Delta Diff Review

```diff
   expect(collectModifies(emitted)).toHaveLength(0);
+  expect(await client.read("a.ts")).toBe(seed);
```
applied identically, once each, at the three claimed sites:

| Test | Spec row | Line (post-fix) | Correct placement? |
|---|---|---|---|
| `REQ-TSD-01.10: default import, SAME local name` | `.10` — default, idempotent no-op | L29-40, assertion at L39 | Correct — matches the `.10` row exactly (default-bound, byte-identical claim) |
| `REQ-TSD-01.13: namespace import, SAME local name` | `.13` — namespace, idempotent no-op | L68-79, assertion at L78 | Correct — matches the `.13` row exactly (namespace-bound, byte-identical claim) |
| `REQ-TSD-01.31: unaliased named specifier, SAME local name` | `.31` — unaliased-named, idempotent no-op | L94-105, assertion at L104 | Correct — matches the `.31` row exactly (named-unaliased, byte-identical claim) |

`.11`/`.12` (L42-53, L55-66) confirmed **correctly untouched**: both are create-branch scenarios
("SUCCEEDS — separate named decl inserted") per spec rows `.11`/`.12`, not the idempotent no-op
shape — they already assert their outcome via `modifies[0]?.modify.content).toBe(<exact merged
string>)`, which is the right assertion for a content-CHANGING case. Adding a `client.read()`
check there would be redundant (the directive's content IS the new file state) and would not
match the react precedent's convention either (react's dual-assertion pattern is reserved for the
no-op rows, `REQ-RXD-05.6`/`.9`, exactly as applied here).

Shape now matches the sibling react precedent exactly:
`test/dialects/react/ops.test.ts:470-471` / `:511-512` — `toHaveLength(0)` immediately followed
by `expect(await client.read(path)).toBe(before)`. Same order, same two-assertion structure, same
variable-naming convention (`seed`/`before` both hold the pre-run fixture text).

`git diff 1819885 91a84ce --stat` confirms `src/` is untouched — only the test file (+3 lines) and
`apply-progress.md` (+30 lines, fix-entry documentation) changed. No scope creep.

---

### Execution Evidence (real runs, this session)

```
$ bun test test/dialects/typescript/ops-addImport.test.ts
7 pass / 0 fail / 14 expect() calls — 1 file, 1.32s
(iteration-1 baseline was 7 pass / 11 expect() calls — +3 expect() calls, 0 new tests, matches
 apply-progress's fix-entry claim exactly)

$ bun test
2064 pass / 0 fail / 4430 expect() calls — 191 files, 27.76s
(iteration-1 baseline was 2064 pass / 4427 expect() calls — +3, zero regressions, zero test-count
 drift)

$ bun run typecheck   (tsc --noEmit)
(no output — clean)
```

---

### Mutation-Mindset Spot Check

**Question posed**: does the added read-back now catch a mutant that emits a spurious but
content-correct directive, or any other failure mode the count-only shape missed?

**A "spurious but content-correct directive" is NOT a new catch** — that mutant was already fully
killed by `toHaveLength(0)` alone, both before and after this fix. `toHaveLength(0)` demands
EXACTLY ZERO entries in `collectModifies(emitted)`; any directive at all, regardless of whether
its content happens to match the seed byte-for-byte, already fails that assertion. Framing the
value of this fix around that mutant class would overstate what changed.

**What the read-back genuinely adds, verified against the real architecture** (read
`src/core/dialect-handle.ts` + `test/support/spy-client.ts` this session): `collectModifies(emitted)`
inspects the WIRE-level directive-buffering mechanism (`session.buffer(...)`, `#openDirective`,
`#bufferDirective` in `dialect-handle.ts`) — it answers "did the op INTEND to hand the runtime a
change." `client.read(path)` (→ `spy-client.ts:30` → `fake.read(p)`) queries the underlying FILE
STORE directly — a structurally independent code path that never touches the directive/wire
bookkeeping at all. These two assertions now exercise two genuinely separate subsystems for the
same claim.

The fault class this closes: a bug where directive emission is SUPPRESSED (so `toHaveLength(0)`
passes) while the underlying AST/file state was nonetheless left mutated by some other path — e.g.
a buffering-gate bug in `#hasOpenPendingDirective`/`#openDirective` that drops a directive it
should have emitted, or a future refactor that coalesces/elides a directive at the wire level
based on a flawed "prints identical" check while an actual mutation occurred. Previously, the
`.10`/`.13`/`.31` tests could not detect that class at all — they never called `read()`, so a
directive-suppression-with-silent-mutation bug was structurally invisible to them. Now it is not:
if the file store diverges from `seed` for any reason, independent of whether a directive was
buffered, the test fails.

Secondary benefit: it also now exercises `client.read()`'s correctness on the addImport idempotent
path specifically — previously only exercised via `.5`/`.19`'s content-assertion tests on the
merge/create branches, never on the no-op branch.

**Net**: the fix buys a real, distinct, previously-absent guarantee (state-level, cross-subsystem
integrity) — not the mutant framed in the question, which was already covered — and it closes
iteration-1's Finding 1 as intended.

---

### Strict TDD (in-loop audit, delta)

**Iteration**: 2
**Verdict**: ok
**Delta scope**: 1 test file modified (3 lines added), 0 impl files

- No banned assertion patterns introduced.
- Regression: full suite green, 0 previously-passing tests broken, test count unchanged (7 in this
  file, 2064 overall) — confirms this was a pure assertion-strengthening fix, not new behavior.
- Fix is test-only, correctly scoped to exactly the 3 flagged cases, `.11`/`.12` correctly left
  alone — no over-application.

---

### Files Reviewed (delta)

- `git diff 1819885 91a84ce` (full commit diff — confirmed `src/` untouched, only test file +
  apply-progress.md changed)
- `test/dialects/typescript/ops-addImport.test.ts` (full file, post-fix)
- `openspec/changes/ts-addimport-collision/apply-progress.md` (Fix Iteration 1→2 entry)
- `src/core/dialect-handle.ts` (directive-buffering mechanism, to ground the mutation-mindset analysis)
- `test/support/spy-client.ts` (`read()` implementation, to confirm it's an independent code path)
- `test/dialects/react/ops.test.ts:461-471, 502-512` (precedent shape, re-confirmed identical structure now matched)
