// One-time PR-gate/CI check (REQ-CCR-03.1/REQ-CCR-04.1) — NOT part of `bun test` (this
// file's name does not end in `.test.ts`, so it is outside the suite's discovery glob).
// A single commit inspection (`pr1`) or a full commit-range scan (`pr2`), run manually or
// in CI at each PR boundary — never a recurring assertion against the current worktree
// alone (that recurring job is `conformance-self-check`/fit-40).
//
// Usage:
//   bun run scripts/conformance-pr-gate.ts pr1
//   bun run scripts/conformance-pr-gate.ts pr2 <base-sha>
import { execFileSync } from "node:child_process";

interface Corpus {
  wireSpecVersion: number;
  fixtures: string[];
}

interface Manifest {
  id: string;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function showAtCommit(sha: string, path: string): string | undefined {
  try {
    return git(["show", `${sha}:${path}`]);
  } catch {
    return undefined; // path did not exist at this commit
  }
}

function listTreePaths(sha: string, prefix: string): string[] {
  try {
    return git(["ls-tree", "-r", "--name-only", sha, "--", prefix])
      .split("\n")
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/** REQ-CCR-03.1: at PR#1's HEAD, corpus.json#fixtures MUST equal exactly ["m1-vehicle"]. */
function checkPr1(): number {
  const text = showAtCommit("HEAD", "conformance/corpus.json");
  if (text === undefined) {
    console.error("REQ-CCR-03.1: conformance/corpus.json does not exist at HEAD");
    return 1;
  }
  const corpus = JSON.parse(text) as Corpus;
  if (JSON.stringify(corpus.fixtures) !== JSON.stringify(["m1-vehicle"])) {
    console.error(`REQ-CCR-03.1: HEAD's corpus.json#fixtures is ${JSON.stringify(corpus.fixtures)}, expected exactly ["m1-vehicle"]`);
    return 1;
  }
  console.log("REQ-CCR-03.1: PASS — corpus.json#fixtures === [\"m1-vehicle\"] at HEAD");
  return 0;
}

/**
 * REQ-CCR-04.1: every commit from `base` to HEAD independently satisfies REQ-CCR-02 — no
 * commit lists a fixture id whose manifest.json (and, transitively, the paths its cases
 * reference) is not yet present in that SAME commit's tree.
 */
function checkPr2(base: string): number {
  const range = git(["log", "--format=%H", `${base}..HEAD`]).split("\n").filter((l) => l.length > 0);
  let failures = 0;

  for (const sha of range.reverse()) {
    const corpusText = showAtCommit(sha, "conformance/corpus.json");
    if (corpusText === undefined) continue; // corpus.json not yet introduced at this commit
    const corpus = JSON.parse(corpusText) as Corpus;
    const treePaths = new Set(listTreePaths(sha, "conformance/"));

    for (const id of corpus.fixtures) {
      const manifestPath = `conformance/${id}/manifest.json`;
      if (!treePaths.has(manifestPath)) {
        console.error(`REQ-CCR-04.1: commit ${sha} lists "${id}" in corpus.json but ${manifestPath} is not in that commit's tree`);
        failures++;
        continue;
      }
      const manifestText = showAtCommit(sha, manifestPath);
      const manifest = JSON.parse(manifestText ?? "{}") as Manifest;
      if (manifest.id !== id) {
        console.error(`REQ-CCR-04.1/REQ-CCR-02(c): commit ${sha}'s ${manifestPath} declares id "${manifest.id}" !== "${id}"`);
        failures++;
      }
    }
  }

  if (failures > 0) {
    console.error(`REQ-CCR-04.1: FAIL — ${failures} orphan-listing violation(s) found across ${range.length} commit(s)`);
    return 1;
  }
  console.log(`REQ-CCR-04.1: PASS — ${range.length} commit(s) checked, no orphan-listing commit found`);
  return 0;
}

function main(): number {
  const [mode, arg] = process.argv.slice(2);
  if (mode === "pr1") return checkPr1();
  if (mode === "pr2") {
    if (arg === undefined) {
      console.error("usage: bun run scripts/conformance-pr-gate.ts pr2 <base-sha>");
      return 1;
    }
    return checkPr2(arg);
  }
  console.error("usage: bun run scripts/conformance-pr-gate.ts <pr1|pr2> [base-sha]");
  return 1;
}

process.exit(main());
