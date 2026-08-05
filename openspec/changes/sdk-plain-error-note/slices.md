# Slices: SDK Plain-Error Note

**Triage**: M
**Spec version**: V2 (signed 2026-08-01)
**Total slices**: 4 (1 walking skeleton + 3 SPIDR)

> **APPLY-BLOCKED**: `/build` MUST NOT start until `runner-tripwire-invariants` lands on
> `main`, or its owner re-baselines `dist/runner-manifest.json`. Checked at slice time
> (2026-08-01): `.sdd/state/runner-tripwire-invariants.json` shows
> `phase: "plan-complete... artefacts uncommitted, commit on a BRANCH (main protected);
> /build awaits owner"` — still not on `main`. No `dist/runner-manifest.json` exists yet
> in this repo. Re-check this file (or `git log --oneline -- dist/runner-manifest.json`)
> before starting `/build`. This artefact touches neither `src/` nor `dist/`.

---

## S-000: Walking Skeleton — Uncurated Error message reaches stderr end-to-end

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-RUN-09.1 (e2e proof), REQ-RUN-09 (branch exists)
**Requires**: nothing
**Test layers**: e2e (spawned runner bin)

**Acceptance**:
- GIVEN the existing `crash` fixture's factory throws a plain `TypeError` mid-run
- WHEN the real spawned runner bin's terminal catch handles it
- THEN `exit-matrix.e2e.test.ts` case (d) asserts stderr CONTAINS the fixture's message
  (not `"run failed"`), exit code stays 4

### Tasks
- [ ] S-000.1 RED: flip case (d)'s `not.toContain("frame-runner crash fixture")` to `toContain(...)`
- [ ] S-000.2 GREEN: add `scrubAbsolutePaths(message, projectRoot?)` identity stub to `error-text.ts` (signature only — matching logic is S-002)
- [ ] S-000.3 GREEN: widen `runner.ts` ternary to 4 branches — curated (unchanged) / `err instanceof Error` → `scrubAbsolutePaths(err.message)` / fixed `"run failed"` fallback
- [ ] S-000.4 Verify: `bun test test/fake/exit-matrix.e2e.test.ts` green, `tsc --noEmit` clean

---

## S-001: Every thrown-value shape routes to its correct note branch

**Scope**: happy-path
**Dimension**: P (Path)
**Covers**: REQ-RUN-09.1, REQ-RUN-09.2, REQ-RUN-09.3, REQ-RUN-09.4
**Requires**: S-000
**Test layers**: unit

**Acceptance**:
- GIVEN a plain `Error`, a non-`Error` throw, each curated class, and an over-cap `Error`
- WHEN the terminal catch handles each
- THEN the note matches its REQ-RUN-09.1-.4 scenario exactly (literal message / fixed
  fallback / byte-identical curated / truncated-at-ceiling)

### Tasks
- [ ] S-001.1 RED: add `plain-error`, `throw-non-error`, `curated-authoring`,
  `curated-transport`, `curated-intent`, `long-plain-error` fixtures under
  `test/fixtures/frame-runner/`
- [ ] S-001.2 RED: new `REQ-RUN-09` describe block in `runner.unit.test.ts` — one case per
  fixture, asserting exact stderr text/length per scenario
- [ ] S-001.3 GREEN: confirm all pass against S-000's ternary (no runner.ts change expected —
  regression-pin any surprise)
- [ ] S-001.4 Verify: `bun test test/transport/runner.unit.test.ts` green

---

## S-002: Scrub recognizes real absolute-path shapes across platforms

**Scope**: edge-case
**Dimension**: D (Data)
**Covers**: REQ-WPS-07.4, REQ-WPS-07.6
**Requires**: S-000
**Test layers**: unit

**Acceptance**:
- GIVEN a message embedding a POSIX, Windows-drive, UNC, or WSL-interop absolute path
  (bare or `file://`-embedded)
- WHEN `scrubAbsolutePaths` runs
- THEN POSIX resolves via `toProjectRelativePath`; Windows/UNC/WSL resolve unconditionally
  to `<outside-project>`, matched BEFORE the POSIX pass (ADR-02 ordering)

### Tasks
- [ ] S-002.1 RED: add cases to `error-text.unit.test.ts` — POSIX match, Windows
  (backslash + forward-slash), UNC, WSL (`wsl.localhost`, `wsl$`), `file://`-embedded, ordering proof
- [ ] S-002.2 GREEN: implement `WINDOWS_UNC_ABS_PATH` + `POSIX_ABS_PATH` regex passes in
  `scrubAbsolutePaths` per design §4.4, replacing S-000's identity stub
- [ ] S-002.3 Verify: `bun test test/transport/error-text.unit.test.ts` green

---

## S-003: Disclosure rule holds — secrets pass, paths never leak, proven live

**Scope**: edge-case
**Dimension**: R (Rule)
**Covers**: REQ-WPS-07.5, REQ-WPS-07.4 (e2e), REQ-WPS-07.6 (e2e)
**Requires**: S-002
**Test layers**: unit + e2e (canary-seeded, real spawned bin)

**Acceptance**:
- GIVEN a message with secret-shaped non-path content → unit: passes through unmodified
- GIVEN a real spawned run with a POSIX/Windows/UNC/WSL canary path seeded into the throw
- WHEN the terminal catch composes stderr
- THEN the raw canary is NEVER present in stderr for any path style; secret content IS
  present verbatim (documented residual)

### Tasks
- [ ] S-003.1 RED: secret-passthrough case in `error-text.unit.test.ts` + `secret-error`
  fixture wired through `runner.unit.test.ts` (asserts `hunter2` present)
- [ ] S-003.2 RED: add `canary-path-leak`, `unc-path-leak` fixtures; new canary-seeded
  describe block in `exit-matrix.e2e.test.ts` using `test/support/canary.ts` (posix/windows/unc/wsl styles)
- [ ] S-003.3 GREEN: confirm all pass against S-002's scrub (no further src change expected)
- [ ] S-003.4 Verify: `bun test test/fake/exit-matrix.e2e.test.ts test/transport/error-text.unit.test.ts test/transport/runner.unit.test.ts` green; `tsc --noEmit` clean

---

## Build Order

| Order | Slice | Requires | Parallelizable with |
|---|---|---|---|
| 1 | S-000 (skeleton) | — | — |
| 2 | S-001 | S-000 | S-002 |
| 2 | S-002 | S-000 | S-001 |
| 3 | S-003 | S-002 | — |

## Anti-Pattern Check

Pass — no horizontal/layer-named slices; every slice covers ≥1 REQ-ID; no slice
cross-cuts two SPIDR dimensions; max explicit dependency depth is 1 (S-003→S-002);
4 total slices sits inside the M target (2-4).
