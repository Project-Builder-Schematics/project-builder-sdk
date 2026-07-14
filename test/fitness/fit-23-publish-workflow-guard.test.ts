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
  steps?: Array<{ uses?: string; run?: string; name?: string }>;
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

function findNpmPublishCommandLine(doc: WorkflowDoc): string | undefined {
  for (const job of Object.values(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (!step.run) continue;
      const line = step.run.split("\n").find((l) => l.trim().startsWith("npm publish"));
      if (line) return line.trim();
    }
  }
  return undefined;
}

function dryRunPresent(commandLine: string): boolean {
  return /(^|\s)--dry-run(\s|$)/.test(commandLine);
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
    expect(result.reason).toContain("missing the repo-owner guard");
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

  it("REQ-PPH-03.1: the npm publish command line retains --dry-run", () => {
    const line = findNpmPublishCommandLine(publishDoc);
    expect(line).toContain("npm publish");
    expect(dryRunPresent(line as string)).toBe(true);
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
    expect(result.reason).toContain('job "sneaky" is missing the repo-owner guard');
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
