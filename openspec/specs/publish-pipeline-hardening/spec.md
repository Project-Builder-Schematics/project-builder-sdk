# Delta for Publish Pipeline Hardening

**Spec version**: V4
**Status**: SIGNED — Daniel Ramirez, 2026-07-29 (V1 signed as drafted; owner rulings 1-8 incorporated)
**Change**: `runner-tripwire-invariants`

V3 → V4 (2026-07-29, ruling 2 + ruling 5 + ruling 6): a fourth surface — the publish
path — runs zero tests today (`main` carries no branch protection, confirmed live by the
orchestrator), and `publish.yml`'s implicit dependency on `prepublishOnly` regenerating the
manifest after the version stamp is never DECLARED anywhere the workflow can be checked.
Ruling 5 withdrew the initial emergency framing (W1) after both propose lenses and the
orchestrator independently verified `prepublishOnly: "bun run build"` already regenerates
the manifest post-stamp, `npm` 11.12.1 gates `prepublishOnly` on `!ignoreScripts` (not
`dryRun`), and signed `REQ-BPI-03.1` already records exactly this — so this batch adds
proof and explicit declaration, it does not fix a live break. Five REQs are ADDED, all in
the `publish-path-integrity` (PPI) family; none of `runner-integrity-manifest`'s
`REQ-BPI-03.1` is touched (it "explicitly not requiring unfreeze" — the declaration
assertion below is new REQ surface, never a MODIFIED block on a REQ the owner ruled
unaffected).

## ADDED Requirements

### REQ-PPI-01: Behavioural Publish-Sequence Integrity

Publish-sequence integrity MUST be proven BEHAVIOURALLY — a real publish sequence run
against a scratch target, comparing packed digests against packed bytes — and MUST NOT
depend on an implicit npm lifecycle behaviour `publish.yml` never declares (ruling 5's
reshaped deliverable).

#### Scenario REQ-PPI-01.1: Packed digests match packed bytes after the real sequence

- GIVEN a scratch target and the real publish sequence (version stamp → `prepublishOnly` rebuild → pack)
- WHEN the packed tarball's `dist/runner-manifest.json` digests are recomputed against the packed tarball's own bytes
- THEN every digest matches, including the stamped `package.json#version` entry

#### Scenario REQ-PPI-01.2 [red-proof]: `--ignore-scripts` breaks the implicit dependency, caught

- GIVEN the same scratch sequence run with `--ignore-scripts` (skips `prepublishOnly`, so the manifest is NOT regenerated after the version stamp)
- WHEN digests are recomputed against packed bytes
- THEN the `package.json` digest mismatches, naming the field — the behavioural proof of what an undeclared implicit-lifecycle dependency actually risks, and why REQ-PPI-02 exists

### REQ-PPI-02: Explicit Rebuild Step Declared

`publish.yml` MUST declare an explicit rebuild step between the version-stamp step and
`npm publish`, rather than relying solely on `prepublishOnly` running implicitly (W1′, XS).

#### Scenario REQ-PPI-02.1: Rebuild step present and positioned after the stamp

- GIVEN `publish.yml` parsed structurally
- WHEN the step sequence between the version-stamp step and the publish step is inspected
- THEN an explicit rebuild step (e.g. `bun run build`) is present between them

#### Scenario REQ-PPI-02.2 [red-proof]: Absence is caught

- GIVEN a simulated `publish.yml` with the stamp step immediately followed by the publish step (no explicit rebuild)
- WHEN the sequence check runs
- THEN it fails, naming the missing step

### REQ-PPI-03: Suite Gate

The publish job in `publish.yml` MUST run the full test suite, and MUST fail the job
(never merely warn) if the suite fails, strictly BEFORE any publish step executes (W2;
ships with REQ-PPI-04 in the same slice per ruling 6 — a knowingly-flaky gate is a gate
that gets routed around).

#### Scenario REQ-PPI-03.1: Suite runs and gates publish

- GIVEN `publish.yml`'s publish job
- WHEN its step sequence is inspected
- THEN a full-suite step (`bun test`) exists strictly before the `npm publish` step, with no `continue-on-error`

#### Scenario REQ-PPI-03.2 [red-proof]: A violating closure never reaches a publish step (S9)

- GIVEN a scratch tree whose closure fails a Constraint-4 admission check (`runner-integrity-manifest` REQ-CAP-01..06)
- WHEN the publish job's sequence runs against it
- THEN the job fails at the suite step and the publish step never executes — asserted by the absence of any publish-step log output

**Plan-verify iteration-2 amendment (2026-07-29, findings G/B1)** — closes gap G of
`verify-plan-2.md`. REQ-PPI-03.2's GIVEN names a Constraint-4 admission failure
(`runner-integrity-manifest` REQ-CAP-01..06), but S-000 (this slice's home) ships and
merges FIRST, independently of the mechanism slices (S-001..S-004) that implement
CAP-01..06 — at S-000 build time, no Constraint-4-violating fixture exists to construct
this scenario against. This note does not change the scenario's text; it schedules its
realisation in two legs, both required for REQ-PPI-03.2 to be fully proven:
- **S-000 leg (proves the gate MECHANISM)**: the scratch fixture that fails the suite
  step is ANY existing suite check the S-000-era tree can fail (e.g. a planted failing
  unit test), never specifically a Constraint-4 admission check — this proves "a failing
  suite blocks publish" as a structural property of `publish.yml`'s step sequence,
  independent of which check fails.
- **S-001 leg (proves the ADMISSION-specific case REQ-PPI-03.2 names verbatim)**: once
  CAP-01..06 land (S-001), `fit-46`'s gate scenario is RE-RUN with a Constraint-4-
  violating fixture and re-verified against the now-real mechanism — see `slices.md`'s
  S-001 task list for the citation-bearing task this note schedules.

#### Scenario REQ-PPI-03.3: A clean closure reaches the publish step — sibling positive

- GIVEN a scratch tree whose closure passes every Constraint-4 admission check
- WHEN the publish job's sequence runs against it
- THEN the suite step passes and the publish step executes — pairing REQ-PPI-03.2's absence proof with the presence case

### REQ-PPI-04: React-Conformance Per-File Timeout

`test/conformance/react-conformance.test.ts` MUST declare an explicit per-file timeout, so
a hang in the suite gate (REQ-PPI-03) cannot itself become a reason to route around the
gate (ruling 6).

#### Scenario REQ-PPI-04.1: Per-file timeout is declared

- GIVEN `test/conformance/react-conformance.test.ts`
- WHEN its test declaration is inspected
- THEN an explicit per-file timeout value is set, distinct from the runner's global default

#### Scenario REQ-PPI-04.2 [red-proof]: A file exceeding the declared timeout fails fast, not by hanging the job

- GIVEN a mutant fixture that never resolves within the declared per-file timeout
- WHEN the conformance suite runs against it
- THEN that file fails at the declared timeout boundary, naming the file — the suite gate (REQ-PPI-03) terminates instead of hanging

### REQ-PPI-05: Execution Order, Not Declaration Order

The publish-workflow guard MUST assert step ORDER by the workflow's actual execution
semantics (job/step dependency and sequential position within a job), never by the YAML's
raw declaration order, which can diverge from execution order — R1-13's real weakness,
pulled in-scope by ruling 5.

#### Scenario REQ-PPI-05.1: Execution order is read, not textual position

- GIVEN a `publish.yml` job whose rebuild step is declared textually after an order-irrelevant step but still executes immediately before publish
- WHEN `publishRunSteps` reads step order
- THEN it reports the actual execution sequence (rebuild immediately before publish), not the raw line-number order of the YAML

#### Scenario REQ-PPI-05.2 [red-proof]: A step reordered only in execution, not text, is caught

- GIVEN a simulated workflow where a step's textual position and its `needs:`-derived execution position diverge (rebuild declared textually first, but gated by `needs:` to actually run last, after publish)
- WHEN the guard evaluates order
- THEN it fails, because the EXECUTION order violates REQ-PPI-02, even though the TEXTUAL declaration order alone would have passed the prior declaration-order check — proving the fix, not merely restating it

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| deployment (`.github/workflows/publish.yml`, OIDC, publish sequencing) | REQ-PPI-01, REQ-PPI-02, REQ-PPI-03, REQ-PPI-05 | Yes — pre-existing `deployment` sensitive-area row (`openspec/sensitive-areas.md`); this batch hardens the existing surface, fires no new registry write |
| security (code execution — suite gate as the publish-time enforcement point) | REQ-PPI-03 | Yes — same override as `runner-integrity-manifest`; the suite gate is what makes Constraint-4 (REQ-CAP-*) load-bearing at publish time, not just at PR time |

## Open Items for Owner / Design

1. **Branch protection on `main` is explicitly out of this REQ set.** REQ-PPI-03 makes the
   publish JOB itself run the suite (bypass requires editing `publish.yml`), but does not
   make `main` protected — W2 is "satisfied in the letter" without it, per the BA lens's
   own named failure mode. This is a registered followup with owner action
   (`openspec/pending-changes.md`), not something a spec REQ against SDK-side files can
   close; flagging here so `sdd-design`/archive do not treat REQ-PPI-03 as a substitute for
   the branch-protection action item.
2. **`REQ-PPI-01`/`REQ-PPI-02` vs the existing `REQ-PMF-02.2`** (`runner-integrity-manifest`,
   unchanged) both exercise a packed-digest-vs-packed-bytes proof at slightly different
   seams (PMF-02.2 is the `--ignore-scripts` red-proof for BPI-03 already signed; PPI-01/02
   are the full real-sequence behavioural proof plus the explicit-declaration requirement
   ruling 5 added). `sdd-design` should confirm the two are complementary, not duplicated —
   PMF-02.2 stays a `runner-integrity-manifest`-owned unit-level red-proof; PPI-01/02 are
   the `publish.yml`-owned workflow-level proof and declaration. No REQ text conflict
   exists; this is a test-plan sequencing note for design, not a spec ambiguity.
