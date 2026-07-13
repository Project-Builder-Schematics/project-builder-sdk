## Verify In-Loop Result

**Change**: schematic-local-files
**Title**: Judgment-day iter-2 BOM+walk fix, iteration 1
**Iteration**: 1/3
**Scope**: fix delta — commits `09b9179` (BOM fix), `059c4d3` (walk-root error contract), `c2f2623` (tests), `2dd09c1` (apply-progress)
**Mode**: in-loop (Strict TDD)
**Branch**: `feat/schematic-local-files`

---

### Verdict: PASS

Independent, adversarially-constructed evidence (own fixtures, not copy-pasted from
the fix's own test files) confirms both judgment-day iteration 2 defects are closed,
with no regression and no over-correction.

### Per-item confirmation

**1. BOM fix (REQ-FEH-01.1 exact content) — CONFIRMED**

`src/scaffold/classify-transport.ts:47` — `decodeSniffableText` now uses
`new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })`.

Independent script (`/private/tmp/.../scratchpad/adversarial-verify.ts`), fresh
`defineFactory({packageDir})` + `ContractFake`, own fixture content
(`"﻿export const zzz = 42;\n// trailing comment..."`):

- `create({templateFile})` by-value render: committed `template` === source content
  exactly, `charCodeAt(0) === 0xfeff`. PASS.
- `scaffold({from,to})` by-value walk: committed file content === source content
  exactly, `charCodeAt(0) === 0xfeff`. PASS.
- Fatal UTF-8 validation not weakened: `decodeSniffableText(Buffer.from([0x41,0x42,0x80,0x43]))`
  (an invalid-UTF-8 buffer, NOT a BOM) still returns `null`; driven through a real
  `scaffold` by-value path, the invalid file is never committed as by-value text.
  PASS — `ignoreBOM: true` only affects BOM handling, not fatal decode validation.
- Non-BOM file byte-identical: a plain non-BOM `create({templateFile})` source
  round-trips exactly, first char is NOT `0xfeff` (no BOM injected). PASS — no
  over-correction.

**2. Walk-root error contract — CONFIRMED**

`src/scaffold/walk.ts:100-145` — root-level `readdirSync` (the `relDir === ""`
iteration only) is now try/caught and routed through `rootReadFailure` →
`invalidInput(...)`.

Independent fixtures, own scratch dirs:

- `scaffold({from: "iamafile.json"})` (regular file): rejects
  `instanceof AuthoringError`, `reason === "invalid-input"`, message contains
  `"iamafile.json"`, message does NOT contain the absolute scratch-dir path. PASS.
- `scaffold({from: "nope-not-here"})` (missing folder): rejects
  `instanceof AuthoringError`, `reason === "invalid-input"`, message contains
  `"nope-not-here"`, message does NOT contain the absolute scratch-dir path. PASS.
- Regression control: a valid nested `from` folder (`validsrc/` with a nested
  subdirectory) still walks and scaffolds both files correctly, content exact. PASS.
- `AuthoringReason` union confirmed at exactly 12 members (`src/core/authoring-error.ts:64-76`)
  — `invalid-input` reused, no 13th member added. PASS.

**3. Rewritten test non-vacuousness — CONFIRMED via mutation**

`test/scaffold/expander.test.ts:251` and `:269` (the two `REQ-PRC-10.3` tests,
including the in-place rewrite of the test formerly titled "...existing not-found
behavior is preserved" which asserted `not.toBeInstanceOf(AuthoringError)` — the
OLD, buggy contract).

Mutation performed live against the working tree: edited `walk.ts`'s root-read
catch block to `throw err` (raw, unwrapped) instead of
`throw rootReadFailure(err, rootRelPath)`, then ran:

```
bun test test/scaffold/expander.test.ts -t "REQ-PRC-10.3"
```

Both tests failed against the mutant — the missing-folder test received a raw
`ENOENT` (`toBeInstanceOf(AuthoringError)` false), the regular-file test received a
raw `ENOTDIR` (same failure). Mutation reverted immediately after
(`git diff --stat src/scaffold/walk.ts` confirmed empty — clean revert, no residual
diff). The rewrite is a legitimate outcome flip (the old assertion pinned the
now-fixed bug, documented as such in `apply-progress.md`'s "Pre-existing test that
pinned the OLD (buggy) behavior" section) and the new assertions are non-vacuous.

**4. Spec amendment — CONFIRMED, no unrelated drift**

`openspec/changes/schematic-local-files/specs/package-root-containment/spec.md`:
REQ-PRC-10.3 amended V4→V5, header marked
`"V4→V5 is a judgment-day iteration 2 owner-ratified fix-now amendment (2026-07-13),
pending owner-signed micro-amend at archive"` — owner-sign-off-pending, matching the
project's existing convention for the V3→V4 remediation. Scenario REQ-PRC-10.3
reworded (missing-root → `AuthoringError`/`invalid-input`, package-relative path,
no raw error); new scenario REQ-PRC-10.3b added (regular-file-as-root case). Text
matches shipped behavior exactly (verified against `walk.ts`'s `rootNotFoundMessage`/
`rootNotDirectoryMessage`/`rootUnreadableMessage`). `git show 2dd09c1 --stat` confirms
only `apply-progress.md` + this one spec file changed — no other spec file touched,
no unrelated drift.

**5. Execution evidence — CONFIRMED**

- `bun test`: **1055 pass / 0 fail**, 2040 expect() calls, 123 files. Matches
  expected 1055/0 exactly.
- `bunx tsc --noEmit`: clean, zero output.
- `bun test test/fitness/`: **276 pass / 0 fail**, 341 expect() calls, 23 files
  (includes FIT-04 `.d.ts` semver gate and FIT-14 package-surface fitness guards
  the session bundle flags as load-bearing for this public npm package).

### Assessment

All checks green. No new findings. The fix delta closes both judgment-day
iteration 2 defects exactly as claimed, does not weaken UTF-8 fatal validation,
does not over-correct non-BOM content, does not regress the valid-folder walk
path, does not touch the `AuthoringReason` union, and the spec amendment text is
an accurate, narrowly-scoped, sign-off-pending record of the shipped behavior.

Loop can exit.

Orchestrator action: proceed to `/evaluate` (mode=final) before archive.
