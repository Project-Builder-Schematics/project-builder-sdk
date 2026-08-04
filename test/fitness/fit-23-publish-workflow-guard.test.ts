/**
 * FIT-23 (S-002, ADR-0042 — renumbered from the design's "fit-21-publish-workflow-guard":
 * fit-21 is now taken by fit-21-context-no-dialect-handle-import.test.ts and fit-22 by
 * fit-22-scaffold-leaf-rule.test.ts, both landed on `main` (stage-5b-dialect-breadth /
 * schematic-local-files) after this change's plan-verify iteration 1 — next free NN is 23.
 * Per slices.md's own Executor Context preamble: "trust the repo, not this doc" when they
 * diverge.
 *
 * Publish workflow guard (REQ-PPH-01/02/03): parses `publish.yml`/`ci.yml` with Bun's
 * NATIVE `YAML.parse` (`import { YAML } from "bun"`, zero new dependency) — a commented-out
 * `# if:` line is structurally absent from the parsed document, not merely invisible to a
 * text scanner. The privileged job is resolved BY PREDICATE (the job object declaring
 * `id-token: write` in its OWN `permissions` block, moved there from workflow level per
 * ADR-0042 decision #1 — least privilege) — never by job name, never a raw substring scan.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { YAML } from "bun";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const WORKFLOWS_DIR = join(PROJECT_ROOT, ".github/workflows");
const PUBLISH_YML_PATH = join(WORKFLOWS_DIR, "publish.yml");
const CI_YML_PATH = join(WORKFLOWS_DIR, "ci.yml");

interface JobDef {
  permissions?: Record<string, string>;
  if?: string;
  needs?: string | string[];
  steps?: Array<{ uses?: string; run?: string; name?: string; "continue-on-error"?: boolean }>;
}
interface WorkflowDoc {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs?: Record<string, JobDef>;
}

function ownerRepoFromPackageJson(): string {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
    repository: { url: string };
  };
  return pkg.repository.url.replace(/^git\+https:\/\/github\.com\//, "").replace(/\.git$/, "");
}

const OWNER_REPO = ownerRepoFromPackageJson();

// Resolves EVERY privileged job BY PREDICATE (any job declaring `id-token: write` in its OWN
// `permissions` block) — never by job name, per ADR-0042. A single-job doc still resolves to
// a one-element array, so callers that only ever expected one job see no behavior change.
function findJobsWithIdTokenWrite(doc: WorkflowDoc): Array<{ name: string; job: JobDef }> {
  const found: Array<{ name: string; job: JobDef }> = [];
  for (const [name, job] of Object.entries(doc.jobs ?? {})) {
    if (job.permissions?.["id-token"] === "write") found.push({ name, job });
  }
  return found;
}

// Every job carrying id-token: write must carry the guard — a partial guard (some jobs
// covered, one missed) is exactly as dangerous as no guard at all.
function checkRepoOwnerGuard(doc: WorkflowDoc, ownerRepo: string): { ok: boolean; reason?: string } {
  const found = findJobsWithIdTokenWrite(doc);
  if (found.length === 0) {
    return { ok: false, reason: "no job declares id-token: write in its own permissions block" };
  }
  const expected = `github.repository == '${ownerRepo}'`;
  for (const { name, job } of found) {
    if (job.if !== expected) {
      return {
        ok: false,
        reason: `job "${name}" is missing the repo-owner guard (expected if: ${expected})`,
      };
    }
  }
  return { ok: true };
}

// Triggers a fork PR or a manual dispatch can reach: a workflow armed with one of these must
// never also carry id-token: write, at workflow OR job level (workflow-level permissions
// apply to every job that doesn't override them, so both levels count).
const FORK_REACHABLE_TRIGGERS = ["pull_request", "pull_request_target", "workflow_dispatch"];

function hasForkReachableTrigger(doc: WorkflowDoc): boolean {
  return Object.keys(doc.on ?? {}).some((key) => FORK_REACHABLE_TRIGGERS.includes(key));
}

function declaresIdTokenWriteAnywhere(doc: WorkflowDoc): boolean {
  return doc.permissions?.["id-token"] === "write" || findJobsWithIdTokenWrite(doc).length > 0;
}

function checkTriggerIsPushToMainOnly(doc: WorkflowDoc): { ok: boolean; reason?: string } {
  const onKeys = Object.keys(doc.on ?? {});
  if (onKeys.length !== 1 || onKeys[0] !== "push") {
    return { ok: false, reason: `trigger set is [${onKeys.join(", ")}], expected only "push"` };
  }
  const push = (doc.on as { push?: { branches?: unknown } }).push;
  const branches = push?.branches;
  if (!Array.isArray(branches) || branches.length !== 1 || branches[0] !== "main") {
    return { ok: false, reason: `push.branches is ${JSON.stringify(branches)}, expected ["main"]` };
  }
  return { ok: true };
}

const SHA_PIN_RE = /@[0-9a-f]{40}$/;

function collectUsesValues(doc: WorkflowDoc): string[] {
  const uses: string[] = [];
  for (const job of Object.values(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (step.uses) uses.push(step.uses);
    }
  }
  return uses;
}

function checkAllUsesShaPinned(doc: WorkflowDoc): { ok: boolean; unpinned: string[] } {
  const unpinned = collectUsesValues(doc).filter((usesValue) => !SHA_PIN_RE.test(usesValue));
  return { ok: unpinned.length === 0, unpinned };
}

// EVERY npm publish command line across every job and every step — the same all-jobs discipline
// checkRepoOwnerGuard follows. Returning the first one let a second, unguarded publish command
// (in another job, or a later step of the same one) ship with --dry-run stripped.
function findNpmPublishCommandLines(doc: WorkflowDoc): string[] {
  const lines: string[] = [];
  for (const job of Object.values(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (!step.run) continue;
      for (const line of step.run.split("\n")) {
        if (line.trim().startsWith("npm publish")) lines.push(line.trim());
      }
    }
  }
  return lines;
}

function dryRunPresent(commandLine: string): boolean {
  return /(^|\s)--dry-run(\s|$)/.test(commandLine);
}

// runner-integrity-manifest S-002, REQ-BPI-03.1. The manifest hashes package.json, so a
// version stamped BETWEEN the build and the pack ships a manifest whose entry #24 no longer
// matches the file being published. The property that keeps this safe is: the stamp precedes
// the build, OR something rebuilds between the stamp and the publish.
type PublishStepKind = "build" | "stamp" | "publish" | "other";

function classifyPublishStep(run: string): PublishStepKind {
  if (/(^|\s)npm version(\s|$)/m.test(run)) return "stamp";
  if (/(^|\s)(npm|bun|yarn|pnpm)\s+(publish|pm pack|pack)(\s|$)/m.test(run)) return "publish";
  if (/(^|\s)(npm|bun|yarn|pnpm)\s+run\s+build(\s|$)/m.test(run)) return "build";
  return "other";
}

// REQ-PPI-05 (R1-13 fix): job order is EXECUTION order, driven by `needs:`, never the raw
// object-key order YAML parsing preserves (which mirrors textual declaration order and can
// diverge from it — see the R1-13 red-proof below).
function needsOf(job: JobDef | undefined): string[] {
  const needs = job?.needs;
  if (needs === undefined) return [];
  return Array.isArray(needs) ? needs : [needs];
}

function topologicalJobOrder(jobs: Record<string, JobDef>): string[] {
  const order: string[] = [];
  const visited = new Set<string>();

  function visit(name: string, inProgress: Set<string>): void {
    if (visited.has(name)) return;
    if (inProgress.has(name)) {
      throw new Error(`publishRunSteps: circular "needs:" dependency involving job "${name}"`);
    }
    inProgress.add(name);
    for (const dependency of needsOf(jobs[name])) {
      if (jobs[dependency] !== undefined) visit(dependency, inProgress);
    }
    inProgress.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const name of Object.keys(jobs)) visit(name, new Set());
  return order;
}

interface PublishStep {
  readonly kind: PublishStepKind;
  readonly run: string;
  readonly job: string;
  /** Position within its OWN job's step list — the only index that expresses execution order. */
  readonly index: number;
}

// The enumeration is topological purely so the list reads in a plausible order for the
// declaration-order tests below; NO verdict is read off a position in it. `stepPrecedes` is the
// only thing that decides "before", because a topological sort must emit some total order even
// for jobs GitHub Actions runs concurrently.
function publishRunSteps(doc: WorkflowDoc): PublishStep[] {
  const jobs = doc.jobs ?? {};
  const steps: PublishStep[] = [];
  for (const name of topologicalJobOrder(jobs)) {
    (jobs[name]?.steps ?? []).forEach((step, index) => {
      if (step.run) steps.push({ kind: classifyPublishStep(step.run), run: step.run, job: name, index });
    });
  }
  return steps;
}

/** Every job `job` is transitively guaranteed to run after, via `needs:`. */
function needsAncestors(jobs: Record<string, JobDef>, job: string): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...needsOf(jobs[job])];
  while (queue.length > 0) {
    const next = queue.shift() as string;
    if (jobs[next] === undefined || ancestors.has(next)) continue;
    ancestors.add(next);
    queue.push(...needsOf(jobs[next]));
  }
  return ancestors;
}

/**
 * Whether `a` is guaranteed to run before `b`. `undefined` means the two steps are UNORDERED:
 * within one job step order is execution order, and across jobs only a `needs:` chain sequences
 * them — GitHub Actions runs everything else concurrently. An unordered pair is never a pass.
 */
function stepPrecedes(jobs: Record<string, JobDef>, a: PublishStep, b: PublishStep): boolean | undefined {
  if (a.job === b.job) return a.index < b.index;
  if (needsAncestors(jobs, b.job).has(a.job)) return true;
  if (needsAncestors(jobs, a.job).has(b.job)) return false;
  return undefined;
}

function unorderedReason(a: PublishStep, b: PublishStep): string {
  return `jobs "${a.job}" and "${b.job}" have no \`needs:\` relation — GitHub Actions runs them concurrently, so no order between their steps exists`;
}

interface PublishStepOrder {
  readonly steps: PublishStep[];
  readonly stamp: PublishStep | undefined;
  readonly publish: PublishStep | undefined;
  /** Set when the stamp/publish pair exists but nothing sequences the two. */
  readonly unordered: string | undefined;
  readonly hasRebuildBetween: boolean;
}

// Shared by `checkExplicitRebuildStep` and `checkPublishOrdering` below — both need the
// stamp/publish pair, whether anything orders them, and whether a rebuild is guaranteed to run
// between them; this is the ONE computation both read from.
function computePublishStepOrder(doc: WorkflowDoc): PublishStepOrder {
  const jobs = doc.jobs ?? {};
  const steps = publishRunSteps(doc);
  const stamp = steps.find((s) => s.kind === "stamp");
  const publish = steps.find((s) => s.kind === "publish");
  if (stamp === undefined || publish === undefined) {
    return { steps, stamp, publish, unordered: undefined, hasRebuildBetween: false };
  }
  if (stepPrecedes(jobs, stamp, publish) === undefined) {
    return { steps, stamp, publish, unordered: unorderedReason(stamp, publish), hasRebuildBetween: false };
  }
  const hasRebuildBetween = steps.some(
    (step) =>
      step.kind === "build" &&
      stepPrecedes(jobs, stamp, step) === true &&
      stepPrecedes(jobs, step, publish) === true
  );
  return { steps, stamp, publish, unordered: undefined, hasRebuildBetween };
}

// REQ-PPI-02: an EXPLICIT rebuild step must be declared between the version stamp and the
// publish step — a second, independent guarantee against manifest staleness that does not
// rely on npm's implicit `prepublishOnly` lifecycle hook (see `checkPublishOrdering` above,
// which already tolerates the implicit-only case and stays unchanged).
function checkExplicitRebuildStep(doc: WorkflowDoc): { ok: boolean; reason?: string } {
  const { stamp, publish, unordered, hasRebuildBetween } = computePublishStepOrder(doc);
  if (stamp === undefined || publish === undefined) {
    return { ok: false, reason: "stamp or publish step not found" };
  }
  if (unordered !== undefined) return { ok: false, reason: unordered };
  if (!hasRebuildBetween) {
    return {
      ok: false,
      reason: "no explicit rebuild step declared between the version stamp and the publish step",
    };
  }
  return { ok: true };
}

// REQ-PPI-03.1: the publish job's full-suite step must run strictly before the publish step,
// and must never carry `continue-on-error` (a knowingly-flaky gate is a gate that gets routed
// around, ruling 6). The behavioural proof that a FAILING suite actually blocks publish is
// fit-46's own scratch-tree scenario (REQ-PPI-03.2/.3) — this is the structural half.
// EVERY publish step must be gated, in whichever job it lives — checkRepoOwnerGuard's own
// comment ("a partial guard is exactly as dangerous as no guard at all") applies verbatim, and
// returning on the first publish-carrying job left every later one unchecked.
function checkSuiteGate(doc: WorkflowDoc): { ok: boolean; reason?: string } {
  const jobs = doc.jobs ?? {};
  const steps = publishRunSteps(doc);
  const publishSteps = steps.filter((s) => s.kind === "publish");
  if (publishSteps.length === 0) return { ok: false, reason: "no publish step found in any job" };

  const suiteSteps = steps.filter((s) => /(^|\s)bun test(\s|$)/m.test(s.run));
  for (const publish of publishSteps) {
    const gating = suiteSteps.filter((suite) => stepPrecedes(jobs, suite, publish) === true);
    if (gating.length === 0) {
      const unordered = suiteSteps.find((suite) => stepPrecedes(jobs, suite, publish) === undefined);
      if (unordered !== undefined) return { ok: false, reason: unorderedReason(unordered, publish) };
      if (suiteSteps.length > 0) {
        return { ok: false, reason: `job "${publish.job}": the suite step runs after the publish step, not before` };
      }
      return { ok: false, reason: `job "${publish.job}": no full-suite (bun test) step found before the publish step` };
    }
    const flaky = gating.find((suite) => (jobs[suite.job]?.steps ?? [])[suite.index]?.["continue-on-error"] === true);
    if (flaky !== undefined) {
      return { ok: false, reason: `job "${flaky.job}": the suite step declares continue-on-error: true` };
    }
  }
  return { ok: true };
}

// The `prepublishOnly` leg counts ONLY while the publish command is `npm publish` without
// `--ignore-scripts`: `bun publish` and `bun pm pack` never run npm's lifecycle at all.
function prepublishRebuilds(publishRun: string, scripts: Record<string, string>): boolean {
  if (!/(^|\s)npm publish(\s|$)/m.test(publishRun)) return false;
  if (/(^|\s)--ignore-scripts(\s|$)/.test(publishRun)) return false;
  return classifyPublishStep(scripts.prepublishOnly ?? "") === "build";
}

function checkPublishOrdering(
  doc: WorkflowDoc,
  scripts: Record<string, string>
): { ok: boolean; reason?: string } {
  const jobs = doc.jobs ?? {};
  const { steps, stamp, publish, unordered, hasRebuildBetween } = computePublishStepOrder(doc);
  if (publish === undefined) return { ok: false, reason: "no publish step found" };
  if (stamp === undefined) return { ok: true };
  if (unordered !== undefined) return { ok: false, reason: unordered };
  // A build guaranteed to run AFTER the stamp already carries the stamped version.
  if (steps.some((s) => s.kind === "build" && stepPrecedes(jobs, stamp, s) === true)) return { ok: true };

  if (hasRebuildBetween) return { ok: true };
  if (prepublishRebuilds(publish.run, scripts)) return { ok: true };

  return {
    ok: false,
    reason: "the version is stamped after the build with no rebuild before publish",
  };
}

describe("FIT-23 — publish workflow guard (REQ-PPH-01/02/03, ADR-0042)", () => {
  let publishDoc: WorkflowDoc;
  let ciDoc: WorkflowDoc;

  beforeAll(() => {
    publishDoc = YAML.parse(readFileSync(PUBLISH_YML_PATH, "utf-8")) as WorkflowDoc;
    ciDoc = YAML.parse(readFileSync(CI_YML_PATH, "utf-8")) as WorkflowDoc;
  });

  it("REQ-PPH-01.1: the job carrying id-token: write has a correctly-scoped repo-owner guard", () => {
    const result = checkRepoOwnerGuard(publishDoc, OWNER_REPO);
    expect(result).toEqual({ ok: true });
  });

  it("[red-proof] REQ-PPH-01.2: a job with id-token: write and a commented-out if: guard fails the check", () => {
    const simulated = YAML.parse(`
jobs:
  publish:
    permissions:
      id-token: write
    # if: github.repository == '${OWNER_REPO}'
    steps: []
`) as WorkflowDoc;
    const result = checkRepoOwnerGuard(simulated, OWNER_REPO);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      `job "publish" is missing the repo-owner guard (expected if: github.repository == '${OWNER_REPO}')`
    );
  });

  it("REQ-PPH-01.3: the trigger set is push-to-main only, no pull_request/workflow_dispatch", () => {
    const result = checkTriggerIsPushToMainOnly(publishDoc);
    expect(result).toEqual({ ok: true });
  });

  it("REQ-PPH-02.1: every uses: line in publish.yml and ci.yml is SHA-pinned", () => {
    expect(checkAllUsesShaPinned(publishDoc)).toEqual({ ok: true, unpinned: [] });
    expect(checkAllUsesShaPinned(ciDoc)).toEqual({ ok: true, unpinned: [] });
  });

  it("[red-proof] REQ-PPH-02.2: a snapshot of the pre-hardening publish.yml fails the SHA-pin check", () => {
    // Snapshot captured 2026-07-14, before REQ-PPH-02 hardening landed — a permanent fixture,
    // NOT re-read from disk (the live file is hardened by this same slice).
    const preHardening = YAML.parse(`
jobs:
  publish:
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
      - uses: actions/setup-node@v4
`) as WorkflowDoc;
    const result = checkAllUsesShaPinned(preHardening);
    expect(result.ok).toBe(false);
    expect(result.unpinned).toEqual(["actions/checkout@v4", "actions/setup-node@v4"]);
  });

  it("REQ-PPH-03.1: EVERY npm publish command line retains --dry-run", () => {
    const lines = findNpmPublishCommandLines(publishDoc);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => !dryRunPresent(line))).toEqual([]);
  });

  it("[red-proof] REQ-PPH-03.2: a simulated command line with --dry-run stripped is caught", () => {
    const stripped = "npm publish --tag dev --provenance --access public";
    expect(dryRunPresent(stripped)).toBe(false);
  });

  // RED-PROOF: collectUsesValues must find every `uses:` across every job/step, not just the first.
  it("[red-proof] collectUsesValues finds all uses: lines, not just the first job's", () => {
    const multiJob = YAML.parse(`
jobs:
  a:
    steps:
      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  b:
    steps:
      - uses: actions/setup-node@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
`) as WorkflowDoc;
    expect(collectUsesValues(multiJob)).toEqual([
      "actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "actions/setup-node@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);
  });

  // RED-PROOF: checkRepoOwnerGuard must flank EVERY job with id-token: write, not just the
  // first one it finds — a second, unguarded job must still fail the check.
  it("[red-proof] checkRepoOwnerGuard catches a second, unguarded id-token: write job", () => {
    const twoPrivilegedJobs = YAML.parse(`
jobs:
  publish:
    permissions:
      id-token: write
    if: github.repository == '${OWNER_REPO}'
    steps: []
  sneaky:
    permissions:
      id-token: write
    steps: []
`) as WorkflowDoc;
    const result = checkRepoOwnerGuard(twoPrivilegedJobs, OWNER_REPO);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      `job "sneaky" is missing the repo-owner guard (expected if: github.repository == '${OWNER_REPO}')`
    );
  });

  it("no fork-reachable/dispatchable trigger (pull_request, pull_request_target, workflow_dispatch) co-occurs with id-token: write, workflow or job level, in any .github/workflows/*.yml", () => {
    const workflowFiles = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    expect(workflowFiles.length).toBeGreaterThan(0);

    for (const file of workflowFiles) {
      const doc = YAML.parse(readFileSync(join(WORKFLOWS_DIR, file), "utf-8")) as WorkflowDoc;
      if (hasForkReachableTrigger(doc)) {
        expect(declaresIdTokenWriteAnywhere(doc)).toBe(false);
      }
    }

    // Sanity check on the fixtures this repo actually ships today: ci.yml carries
    // pull_request and must have no id-token: write anywhere; publish.yml is push-only so it
    // is exempt from this check even though it legitimately carries id-token: write.
    expect(hasForkReachableTrigger(ciDoc)).toBe(true);
    expect(declaresIdTokenWriteAnywhere(ciDoc)).toBe(false);
    expect(hasForkReachableTrigger(publishDoc)).toBe(false);
  });

  // RED-PROOF: a simulated workflow with a fork-reachable trigger AND id-token: write
  // (workflow-level) must be caught.
  it("[red-proof] a workflow_dispatch-triggered workflow with workflow-level id-token: write is caught", () => {
    const simulated = YAML.parse(`
on:
  workflow_dispatch: {}
permissions:
  id-token: write
jobs:
  deploy:
    steps: []
`) as WorkflowDoc;
    expect(hasForkReachableTrigger(simulated)).toBe(true);
    expect(declaresIdTokenWriteAnywhere(simulated)).toBe(true);
  });
});

// runner-integrity-manifest S-002 — the manifest's publish-ordering precondition.
describe("FIT-23 S-002 — publish ordering keeps the manifest true of what ships (REQ-BPI-03.1)", () => {
  const scripts = (
    JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  it("REQ-BPI-03.1: the committed publish.yml satisfies the ordering property today", () => {
    const doc = YAML.parse(readFileSync(PUBLISH_YML_PATH, "utf-8")) as WorkflowDoc;
    expect(checkPublishOrdering(doc, scripts)).toEqual({ ok: true });
  });

  it("REQ-BPI-03.1: today it holds via prepublishOnly, not via step order", () => {
    const doc = YAML.parse(readFileSync(PUBLISH_YML_PATH, "utf-8")) as WorkflowDoc;
    const steps = publishRunSteps(doc);
    expect(steps.findIndex((s) => s.kind === "stamp")).toBeGreaterThan(
      steps.findIndex((s) => s.kind === "build")
    );
    expect(scripts.prepublishOnly).toBe("bun run build");
  });

  const stampAfterBuild = `
jobs:
  publish:
    steps:
      - run: bun run build
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: PUBLISH_COMMAND
`;

  it("[red-proof] REQ-BPI-03.1: --ignore-scripts entering the workflow breaks the property", () => {
    const doc = YAML.parse(
      stampAfterBuild.replace("PUBLISH_COMMAND", "npm publish --tag dev --ignore-scripts")
    ) as WorkflowDoc;
    const result = checkPublishOrdering(doc, scripts);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("the version is stamped after the build with no rebuild before publish");
  });

  it("[red-proof] REQ-BPI-03.1: switching to `bun publish` breaks the property", () => {
    const doc = YAML.parse(
      stampAfterBuild.replace("PUBLISH_COMMAND", "bun publish --tag dev")
    ) as WorkflowDoc;
    expect(checkPublishOrdering(doc, scripts).ok).toBe(false);
  });

  it("[red-proof] REQ-BPI-03.1: switching to `bun pm pack` breaks the property", () => {
    const doc = YAML.parse(
      stampAfterBuild.replace("PUBLISH_COMMAND", "bun pm pack --destination .")
    ) as WorkflowDoc;
    expect(checkPublishOrdering(doc, scripts).ok).toBe(false);
  });

  it("[red-proof] REQ-BPI-03.1: dropping prepublishOnly's build breaks the property", () => {
    const doc = YAML.parse(
      stampAfterBuild.replace("PUBLISH_COMMAND", "npm publish --tag dev")
    ) as WorkflowDoc;
    expect(checkPublishOrdering(doc, { prepublishOnly: "echo nothing" }).ok).toBe(false);
  });

  it("REQ-BPI-03.1: an explicit rebuild between stamp and publish also satisfies it", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: bun run build
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: bun run build
      - run: npm publish --tag dev --ignore-scripts
`) as WorkflowDoc;
    expect(checkPublishOrdering(doc, scripts)).toEqual({ ok: true });
  });
});

// runner-tripwire-invariants S-000 — REQ-PPI-02/03/04/05: publish-sequence hardening.
describe("FIT-23 S-000 — publishRunSteps reads EXECUTION order, not declaration order (REQ-PPI-05)", () => {
  it("REQ-PPI-05.1: an order-irrelevant step (no `run:`) interleaved among run steps does not disturb their relative order", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      - run: bun run build
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: npm publish --tag dev
`) as WorkflowDoc;
    expect(publishRunSteps(doc).map((s) => s.kind)).toEqual(["build", "stamp", "publish"]);
  });

  it("REQ-PPI-05.2 [red-proof]: a step reordered only in execution (via `needs:`), not text, is caught", () => {
    // `rebuild-job` is declared TEXTUALLY FIRST, but `needs: publish-job` means it actually
    // EXECUTES LAST — after publish. A declaration-order reading (the old bug, R1-13) would
    // report [build, stamp, publish]; the execution-order reading must report [stamp,
    // publish, build].
    const doc = YAML.parse(`
jobs:
  rebuild-job:
    needs: publish-job
    steps:
      - run: bun run build
  publish-job:
    steps:
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: npm publish --tag dev --ignore-scripts
`) as WorkflowDoc;
    expect(publishRunSteps(doc).map((s) => s.kind)).toEqual(["stamp", "publish", "build"]);
  });
});

// judgment-day round 1 (W1/W2): the two properties the checkers above did NOT have.
describe("FIT-23 S-000 — an order between CONCURRENT jobs is never invented (REQ-PPI-02, REQ-BPI-03.1)", () => {
  // GitHub Actions runs jobs with no `needs:` relation CONCURRENTLY. A topological sort still
  // emits SOME total order for them (whatever key order the tie-break happens to produce), and
  // reading a verdict off that order let a workflow whose rebuild is not sequenced against the
  // publish at all pass both REQ-PPI-02 and REQ-BPI-03.1.
  const CONCURRENT_STAMP_AND_PUBLISH = `
jobs:
  stamp-job:
    steps:
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: bun run build
  publish-job:
    steps:
      - run: bun test
      - run: npm publish --tag dev --ignore-scripts
`;

  it("[red-proof] REQ-PPI-02: a rebuild in a job with no `needs:` link to the publish job is a FAILURE, not an ordering", () => {
    const doc = YAML.parse(CONCURRENT_STAMP_AND_PUBLISH) as WorkflowDoc;
    const result = checkExplicitRebuildStep(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      'jobs "stamp-job" and "publish-job" have no `needs:` relation — GitHub Actions runs them concurrently, so no order between their steps exists'
    );
  });

  it("[red-proof] REQ-BPI-03.1: the same unordered pair fails the publish-ordering property too", () => {
    const doc = YAML.parse(CONCURRENT_STAMP_AND_PUBLISH) as WorkflowDoc;
    const result = checkPublishOrdering(doc, { prepublishOnly: "echo nothing" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      'jobs "stamp-job" and "publish-job" have no `needs:` relation — GitHub Actions runs them concurrently, so no order between their steps exists'
    );
  });

  it("REQ-PPI-02: the SAME two jobs linked by `needs:` do satisfy it — the sibling positive", () => {
    const doc = YAML.parse(`
jobs:
  stamp-job:
    steps:
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: bun run build
  publish-job:
    needs: stamp-job
    steps:
      - run: bun test
      - run: npm publish --tag dev --ignore-scripts
`) as WorkflowDoc;
    expect(checkExplicitRebuildStep(doc)).toEqual({ ok: true });
  });

  it("[red-proof] REQ-PPI-03.1: a suite step in a concurrent job does not gate the publish", () => {
    const doc = YAML.parse(`
jobs:
  test-job:
    steps:
      - run: bun test
  publish-job:
    steps:
      - run: npm publish --tag dev
`) as WorkflowDoc;
    const result = checkSuiteGate(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      'jobs "test-job" and "publish-job" have no `needs:` relation — GitHub Actions runs them concurrently, so no order between their steps exists'
    );
  });

  it("[red-proof] REQ-PPI-03.1: a SECOND, ungated publish job is caught — the first job's gate is not the whole check", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: bun test
      - run: npm publish --tag dev
  sneaky:
    steps:
      - run: npm publish --tag latest
`) as WorkflowDoc;
    // The finding names the true defect: a suite step DOES exist, in the `publish` job — but
    // nothing sequences it against `sneaky`'s publish step, so it gates nothing there.
    const result = checkSuiteGate(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      'jobs "publish" and "sneaky" have no `needs:` relation — GitHub Actions runs them concurrently, so no order between their steps exists'
    );
  });

  it("[red-proof] REQ-PPH-03.1: a SECOND publish command line without --dry-run is caught", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: npm publish --tag dev --dry-run
  sneaky:
    steps:
      - run: npm publish --tag latest
`) as WorkflowDoc;
    const lines = findNpmPublishCommandLines(doc);
    expect(lines).toEqual(["npm publish --tag dev --dry-run", "npm publish --tag latest"]);
    expect(lines.filter((line) => !dryRunPresent(line))).toEqual(["npm publish --tag latest"]);
  });
});

describe("FIT-23 S-000 — REQ-PPI-02: an explicit rebuild step is declared between stamp and publish", () => {
  it("REQ-PPI-02.1: publish.yml declares an explicit rebuild step between the version stamp and the publish step", () => {
    const doc = YAML.parse(readFileSync(PUBLISH_YML_PATH, "utf-8")) as WorkflowDoc;
    const result = checkExplicitRebuildStep(doc);
    expect(result).toEqual({ ok: true });
  });

  it("REQ-PPI-02.2 [red-proof]: a simulated workflow with the stamp immediately followed by publish (no explicit rebuild) is caught", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: npm version "0.0.0-dev.abc" --no-git-tag-version
      - run: npm publish --tag dev --ignore-scripts
`) as WorkflowDoc;
    const result = checkExplicitRebuildStep(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      "no explicit rebuild step declared between the version stamp and the publish step"
    );
  });
});

describe("FIT-23 S-000 — REQ-PPI-03.1: the publish job runs a full-suite step, strictly before publish, no continue-on-error", () => {
  it("REQ-PPI-03.1: publish.yml declares a `bun test` step strictly before the publish step, with no continue-on-error", () => {
    const doc = YAML.parse(readFileSync(PUBLISH_YML_PATH, "utf-8")) as WorkflowDoc;
    const result = checkSuiteGate(doc);
    expect(result).toEqual({ ok: true });
  });

  // Strict TDD triangulation (verify-in-loop-1 finding): checkSuiteGate has 4 conditional
  // branches (1 success + 3 distinct failure-reason returns) but only the success path was
  // exercised. These 3 mirror the pairing pattern every sibling checker in this file follows
  // (checkRepoOwnerGuard, checkAllUsesShaPinned, checkPublishOrdering,
  // checkExplicitRebuildStep) — each named failure-reason branch gets its own fixture.
  it("checkSuiteGate fails when no `bun test` step exists before the publish step", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: npm publish --tag dev
`) as WorkflowDoc;
    const result = checkSuiteGate(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('job "publish": no full-suite (bun test) step found before the publish step');
  });

  it("checkSuiteGate fails when the suite step runs after the publish step", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: npm publish --tag dev
      - run: bun test
`) as WorkflowDoc;
    const result = checkSuiteGate(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('job "publish": the suite step runs after the publish step, not before');
  });

  it("checkSuiteGate fails when the suite step declares continue-on-error: true", () => {
    const doc = YAML.parse(`
jobs:
  publish:
    steps:
      - run: bun test
        continue-on-error: true
      - run: npm publish --tag dev
`) as WorkflowDoc;
    const result = checkSuiteGate(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('job "publish": the suite step declares continue-on-error: true');
  });
});

describe("FIT-23 S-000 — REQ-PPI-04.1 (structural leg): react-conformance.test.ts declares an explicit per-file timeout", () => {
  it("REQ-PPI-04.1: react-conformance.test.ts calls setDefaultTimeout with a value distinct from Bun's 5000ms default", () => {
    const REACT_CONFORMANCE_PATH = join(PROJECT_ROOT, "test/conformance/react-conformance.test.ts");
    const source = readFileSync(REACT_CONFORMANCE_PATH, "utf-8");
    const match = source.match(/setDefaultTimeout\((\d+)\)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).not.toBe(5000);
  });
});
