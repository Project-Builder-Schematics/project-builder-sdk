# Apply progress — `sdk-plain-error-note`

**Branch**: `feat/sdk-plain-error-note` (off `origin/main` @ `b5d4339`)
**Store**: openspec. Engram has no `project-builder-sdk` project — no `mem_*` writes for this change.

---

## S-000 — Walking Skeleton: an uncurated `Error` message reaches stderr end-to-end

**Covers**: REQ-RUN-09.1 (e2e proof), REQ-RUN-09 (branch exists)
**Status**: complete

### Tasks

- [x] **S-000.1 RED** — flipped case (d) of `test/fake/exit-matrix.e2e.test.ts` from asserting the
      message is absent to asserting it is present.
- [x] **S-000.2 GREEN** — `scrubAbsolutePaths(message, projectRoot?)` added to
      `src/transport/error-text.ts` as an identity stub. **Signature only** — the POSIX and
      Windows/UNC/WSL matching passes are S-002's scope and are deliberately absent.
- [x] **S-000.3 GREEN** — widened the terminal-catch ternary in `src/transport/runner.ts` from three
      branches to four.
- [x] **S-000.4 Verify** — see Proofs.

### Red proof

`RUNNER_BIN` resolves to `src/bin/pbuilder-runner.ts` (`exit-matrix.e2e.test.ts:25`), not `dist/`, so
the spawned runner executes the source directly and no build step stands between the edit and the
assertion. The red was re-derived by stashing **only** the two `src/` changes and leaving the new
assertion in place:

```
$ git stash push -- src/transport/runner.ts src/transport/error-text.ts
$ bun test test/fake/exit-matrix.e2e.test.ts

error: expect(received).toContain(expected)

Expected to contain: "frame-runner crash fixture: author code throws mid-run"
Received: "[pbuilder] factory at test/fixtures/frame-runner/crash: no schema.json found — running
WITHOUT schema-derived input validation\npbuilder-runner: run failed\n"

      at test/fake/exit-matrix.e2e.test.ts:124:24
(fail) REQ-EXC-01.2 > (d) a plain author TypeError thrown mid-run: exit 4 (crash) [51.22ms]

 10 pass
 1 fail
```

**Why this is the right reason**: the received stderr is literally `pbuilder-runner: run failed` —
the placeholder this change exists to remove. The failure is the absence of the production
behaviour, not a typo, a missing fixture, or a compile error. `exitCode` still asserted 4 and passed,
so the failure isolates the message channel and nothing else.

### Green proof

```
$ git stash pop
$ bun test test/fake/exit-matrix.e2e.test.ts
 11 pass
 0 fail
 28 expect() calls
Ran 11 tests across 1 file. [712.00ms]

$ bunx tsc --noEmit
(no diagnostics, exit 0)
```

Full-suite result: recorded below under **Full suite**.

### Files touched

| File | Change |
|---|---|
| `src/transport/runner.ts:29` | import `scrubAbsolutePaths` |
| `src/transport/runner.ts:340-346` | terminal-catch ternary 3 → 4 branches: curated classes unchanged → `err instanceof Error` → `scrubAbsolutePaths(err.message)` → fixed `"run failed"` fallback for non-`Error` throws |
| `src/transport/error-text.ts:53-60` | `scrubAbsolutePaths` identity stub + doc comment |
| `test/fake/exit-matrix.e2e.test.ts:124` | the new assertion |

Net: **14 insertions, 2 deletions** across 3 files.

### Decisions the plan did not specify

- **The `"run failed"` fallback is retained, not removed.** `slices.md` specifies four branches but
  does not say what the fourth is for. It is reachable only when a non-`Error` value is thrown
  (`throw "string"`, `throw {}`, `throw null`) — such a value has no `.message`, so there is nothing
  to forward. S-001 is the slice that proves each thrown-value shape routes to its correct branch.
- **The stub's doc comment carries the REQ-IDs and the pass-through warning, not the slice numbers.**
  A comment naming S-000/S-002 would describe the workflow that produced the code rather than the
  code, and would go stale the moment the real matching lands.

### Deviations from `slices.md`

None.

---

## Full suite

```
$ bun test
 2652 pass
 0 fail
 7385 expect() calls
Ran 2652 tests across 202 files. [101.90s]
```

### Note on an earlier dirty run

An intermediate run reported `2650 pass / 1 fail`. It did not reproduce and was **not** a real
regression: a `bun test` process from an abandoned agent session still held
`.tmp-shared-build.lock` and was writing into the same real `dist/`. `test/support/shared-build.ts`
builds into the shipped tree and `bun run build` begins with `rm -rf dist`, so two concurrent suites
corrupt each other's fixture — the pid-keyed owner lock named the holding pid rather than failing
non-deterministically, which is what it exists to do (`pending-changes.md`, JD-4). The holder was
confirmed alive before anything was touched, terminated, confirmed dead, and only then was the stale
lock removed. The clean re-run above is the authoritative result.

**Operational consequence**: never run `bun test` concurrently with anything else in this repo, and
never delete `.tmp-shared-build.lock` without first checking the named pid is actually gone.
