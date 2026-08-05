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

---

## S-001 — Every thrown-value shape routes to its correct note branch

**Covers**: REQ-RUN-09.1, REQ-RUN-09.2, REQ-RUN-09.3, REQ-RUN-09.4
**Status**: complete

### Tasks

- [x] **S-001.1 RED** — added 6 fixtures under `test/fixtures/frame-runner/`: `plain-error`,
      `throw-non-error`, `curated-authoring`, `curated-transport`, `curated-intent`,
      `long-plain-error`.
- [x] **S-001.2 RED** — new `REQ-RUN-09` describe block in `runner.unit.test.ts`, one case per
      fixture (curated classes get 3 separate cases), asserting exact stderr text and exit code
      per scenario.
- [x] **S-001.3 GREEN** — confirmed all 6 new cases pass against S-000's ternary unmodified — no
      `src/` change. See Decisions below for the one surprise the RED derivation surfaced (not a
      code surprise, a test-design one).
- [x] **S-001.4 Verify** — `bun test test/transport/runner.unit.test.ts` green (21/21, includes
      15 pre-existing cases in the file).

### Red proof

Every routing branch this slice claims to prove is either (a) genuinely new behavior S-000 added,
or (b) a regression pin of behavior that predates S-000 unchanged. Both classes needed to be
proven honestly rather than uniformly claiming "red", so the derivation used S-000's own technique
(`apply-progress.md`'s S-000 section): temporarily restore `src/transport/runner.ts` and
`src/transport/error-text.ts` to their pre-S-000 content (`abd9736^`) and re-run the new suite.

```
$ git show abd9736^:src/transport/runner.ts > /tmp/pre-s000-runner.ts
$ git show abd9736^:src/transport/error-text.ts > /tmp/pre-s000-error-text.ts
$ diff /tmp/pre-s000-runner.ts src/transport/runner.ts        # confirms the diff IS exactly S-000's
$ diff /tmp/pre-s000-error-text.ts src/transport/error-text.ts
$ cp src/transport/runner.ts /tmp/post-s000-runner.ts          # save current (S-000) content first
$ cp src/transport/error-text.ts /tmp/post-s000-error-text.ts
$ cp /tmp/pre-s000-runner.ts src/transport/runner.ts
$ cp /tmp/pre-s000-error-text.ts src/transport/error-text.ts
$ bun test test/transport/runner.unit.test.ts
```

```
297 |     host.sendReady();
299 |     const exitCode = await runRunner(["--factory", PLAIN_ERROR_POINTER, "--input", "{}"], host.io);
301 |     expect(exitCode).toEqual(4);
302 |     expect(host.stderrText()).toEqual(
error: expect(received).toEqual(expected)
- "pbuilder-runner: Could not locate the imports array closing in src/app.module.ts
+ "pbuilder-runner: run failed
(fail) REQ-RUN-09 ... Scenario REQ-RUN-09.1: a plain Error's message reaches the note verbatim, exit 4

351 |     const exitCode = await runRunner(["--factory", LONG_PLAIN_ERROR_POINTER, "--input", "{}"], host.io);
353 |     expect(exitCode).toEqual(4);
355 |     expect(host.stderrText().length).toEqual(MESSAGE_CEILING_CHARS + 1);
error: expect(received).toEqual(expected)
Expected: 2001
Received: 28
(fail) REQ-RUN-09 ... Scenario REQ-RUN-09.4: cap discipline applies to the whole composed note for an uncurated Error

 19 pass
 2 fail
 57 expect() calls
```

**Why this is the right reason**: REQ-RUN-09.1 and REQ-RUN-09.4 exercise the branch S-000 actually
added (`err instanceof Error ? scrubAbsolutePaths(err.message) : "run failed"`); against the
pre-S-000 3-branch ternary, any uncurated `Error` — plain or over-cap — collapses into the same
literal `"run failed"` as a non-`Error` throw, so both received values are literally
`"pbuilder-runner: run failed\n"` / length 28. That is the absence of the production behavior this
slice proves, not a typo or missing fixture. The other 19 cases (REQ-RUN-09.2, REQ-RUN-09.3 ×3,
plus the 15 pre-existing cases in the file) already passed at this reverted state — REQ-RUN-09.2's
non-`Error` fallback and REQ-RUN-09.3's curated-class branch are both **unchanged by S-000** (the
pre-S-000 ternary's curated/else split already produced exactly this behavior), so they are
regression pins, not new-behavior proofs — exactly as the spec's own REQ-RUN-09.3 scenario title
says ("regression pin") and as S-001.3's task text anticipates ("no runner.ts change expected").

### Green proof

```
$ cp /tmp/post-s000-runner.ts src/transport/runner.ts
$ cp /tmp/post-s000-error-text.ts src/transport/error-text.ts
$ git diff --stat src/transport/          # (no output — byte-identical restoration)
$ bun test test/transport/runner.unit.test.ts
 21 pass
 0 fail
 57 expect() calls
Ran 21 tests across 1 file. [171.00ms]

$ bunx tsc --noEmit
(no diagnostics, exit 0)

$ git status --short src/
(no output — src/ untouched by this slice, as S-001.3 anticipated)
```

Full-suite result: recorded below under **Full suite (S-001)**.

### Files touched

| File | Change |
|---|---|
| `test/fixtures/frame-runner/plain-error/factory.ts` | new — REQ-RUN-09.1 fixture, throws the spec's literal plain-`Error` message |
| `test/fixtures/frame-runner/throw-non-error/factory.ts` | new — REQ-RUN-09.2 fixture, `throw "x"` |
| `test/fixtures/frame-runner/curated-authoring/factory.ts` | new — REQ-RUN-09.3 fixture, `throw invalidInput(...)` |
| `test/fixtures/frame-runner/curated-transport/factory.ts` | new — REQ-RUN-09.3 fixture, `throw new TransportFault(...)` |
| `test/fixtures/frame-runner/curated-intent/factory.ts` | new — REQ-RUN-09.3 fixture, `throw new IntentRejectedError(...)` |
| `test/fixtures/frame-runner/long-plain-error/factory.ts` | new — REQ-RUN-09.4 fixture, message length `MESSAGE_CEILING_CHARS + 500` |
| `test/transport/runner.unit.test.ts:15,25-31,287-350` | new `REQ-RUN-09` describe block (6 cases) + 7 new pointer consts + `MESSAGE_CEILING_CHARS` import |

No `src/` file touched.

### Decisions the plan did not specify

- **Curated fixtures throw the curated class DIRECTLY from the factory body**, not via the
  production paths that normally raise them (engine rejection for `AuthoringError`, a wire fault
  for `TransportFault`, a host commit/discard refusal for `IntentRejectedError` — the last of
  which is already covered by a different scenario, `runner.integration.test.ts`'s REQ-EXC-01
  block, via a rejected `ir.commit` envelope). `slices.md`'s own task text calls for fixtures that
  "directly construct+throw" these classes, and `defineFactory`'s catch-all (`context.ts:358-380`)
  treats a factory-thrown curated instance identically to one raised internally — it calls
  `session.discard()` then re-throws the SAME error unchanged. This isolates the terminal catch's
  ROUTING decision from how each curated class is normally produced, which is exactly S-001's
  contract ("every thrown-value shape routes to its correct note branch") and keeps this slice's
  tests independent of REQ-EXC-01/SEC-03/SEC-05's own already-existing coverage of production.
- **`session.discard()` is unconditional** (`session.ts:51-53` — no pending-buffer guard, unlike
  `flush()`), so every fixture — even ones that throw before any tree operation — still round-trips
  one `ir.discard` request. This is why `makeInProcessHost` (full `ContractFake` dispatch) is
  required for all 6 fixtures, not the lighter `greetedIo()`/`unreachedIo()` stubs used by the
  import-time and pre-greeting gates elsewhere in this file: a bare stub whose stdin ends after the
  greeting would leave the awaited `ir.discard` response permanently pending.
- **The `curated-authoring` fixture directory name collided with GateGuard's `auth` sensitive-path
  substring match** (`curated-authoring` contains "auth"). This is a false positive — the SDK's own
  `AuthoringError` class (`src/core/authoring-error.ts`, pre-existing, unrelated to
  authentication/authorization) is the source of the naming, not a security-relevant surface. Cleared
  by stating importers (none), public surface (none — reuses the already-exported `invalidInput`
  helper), and the motivating instruction, then retrying the write, which the hook allowed.
- **`long-plain-error`'s message length is `MESSAGE_CEILING_CHARS + 500`** (2500 chars), not a bare
  magic number — imported from `error-text.ts` so the fixture stays correct if the ceiling constant
  ever changes, matching the file's own "SDK-chosen placeholder pending engine-side confirmation"
  provenance note.

### Deviations from `slices.md`

None.

---

## Full suite (S-001)

Stale-lock check before running: `.tmp-shared-build.lock` held pid `542656`; `ps -p 542656` exited
1 (no matching process) — confirmed dead before removal, per the operational consequence recorded
in S-000's section above.

```
$ bun test
 2658 pass
 0 fail
 7397 expect() calls
Ran 2658 tests across 202 files. [99.70s]
```

2658 = the 2652 baseline + this slice's 6 new `REQ-RUN-09` cases. No regression.
