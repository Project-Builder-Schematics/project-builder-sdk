# ADR-0042: publish rehearsal interlock — three-part in-repo guard + go-live-precondition debt

- Status: Proposed (draft)
- Date: 2026-07-12
- Change: `stage-6-release-shape`
- Relates to: REQ-PPH-01, REQ-PPH-02, REQ-PPH-03, REQ-AOD-09.6

## Context

`publish.yml` carries `id-token: write` with no repo-owner guard and pins only `setup-bun` — a fork
with its own `main` can reach the OIDC-token-minting step today (verified live). Stage 6 hardens this
surface WITHOUT firing it. "Hardened and rehearsed" must be provable IN-REPO, and the proof must be
mutation-resistant: a commented-out `# if:` guard or a stray substring match must FAIL the check.

## Decision

A three-part in-repo interlock, all asserted by `fit-21-publish-workflow-guard.test.ts` using Bun's
NATIVE `YAML.parse` (`import { YAML } from "bun"`, available in the pinned Bun line) — zero new
dependency, structurally correct parse (a commented-out `# if:` line is simply absent from the
parsed document; there is no text-scan to fool). The job-resolution-by-predicate rule is unchanged:
locate the job that declares `id-token: write` in its `permissions` block, then assert every guard
condition against THAT job object — never a whole-file substring match:

1. **W3 repo-owner guard** — the job carrying `id-token: write` has `if: github.repository ==
   '<owner>/<repo>'` (REQ-PPH-01.1/.2). `id-token: write` is moved from workflow-level to the
   `publish` job's own `permissions` block (least privilege).
2. **Trigger-surface pin** — `on:` is `push: branches: [main]` ONLY; no `pull_request`,
   `pull_request_target`, or `workflow_dispatch` (REQ-PPH-01.3) — each would re-open a fork/manual
   path around the guard.
3. **`--dry-run` pin** — the `npm publish` command retains `--dry-run` (REQ-PPH-03); plus every
   `uses:` in `publish.yml` AND `ci.yml` is 40-hex SHA-pinned (REQ-PPH-02; `ci.yml` included by
   design ruling — completes the existing `setup-bun`-pinned convention, closes the hygiene gap).

**What it does NOT protect**: an insider or a malicious edit to `main` that strips the guard/`--dry-run`
BEFORE pushing — the fitness tests run in CI on PRs, but a direct push to `main` bypasses PR review.
That residual is the go-live precondition: a GitHub **Environment required-reviewers gate** is a
MANDATORY precondition of ever removing `--dry-run`, recorded as a new `pending-changes.md` entry
(REQ-AOD-09.6), deferred to the public-package plan. This makes security's conditional acceptance of
the `--dry-run` pin durable rather than implicit.

## Consequences

- (+) The fork-reaches-OIDC hole closes; the hardened shape is regression-guarded by a mutation-
  resistant test that a commented guard cannot fool.
- (+) SHA-pinning both workflows removes floating-tag supply-chain drift across all CI.
- (−) In-repo tests cannot gate a direct push to `main` by a write-access holder — named, not hidden;
  the Environment-reviewers gate is booked as go-live debt.
- (→) When live publish is proposed, the interlock's `--dry-run` removal is blocked until the recorded
  Environment gate exists.

## Alternatives Considered

- **String/regex-only guard check** — rejected: a commented `# if:` or a stray matching substring
  survives a naive text scan; job-anchored, structural YAML parsing is required (spec flag).
- **Hand-rolled comment-stripping text parser** — rejected (rev-2): reinvents YAML comment/quoting
  edge cases (e.g. a `#` inside a quoted string) for no benefit; Bun ships `YAML.parse` natively in
  the pinned toolchain, so a structurally correct parse costs zero new dependencies.
- **Leave `ci.yml` unpinned** (scope only `publish.yml`) — rejected: `ci.yml` shares the same
  floating-tag `actions/checkout`; pinning it completes the convention at trivial cost. Recording the
  exclusion instead would leave a silent, documented-nowhere hygiene gap.
- **Rely on npm trusted-publishing alone** (no repo guard) — rejected: trusted publishing stops a
  fork from PUBLISHING, but the guard also stops OIDC token MINTING inside forks — defense in depth.
