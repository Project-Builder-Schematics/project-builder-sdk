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

interface FactoryPointer {
  module: string;
  export: string | null;
}

interface Case {
  name: string;
  seed: string | null;
  expected: string;
  factory?: FactoryPointer;
}

interface Manifest {
  id: string;
  factory: FactoryPointer;
  lowering: { mode: "none" | "schematic"; schematicRoot?: string };
  cases: Case[];
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

/** True if `treePaths` contains a blob whose path is `dirPath` or nested under it —
 * `git ls-tree` lists blobs only, so a directory reference is proven by a descendant entry. */
function hasEntryUnder(treePaths: Set<string>, dirPath: string): boolean {
  const prefix = `${dirPath}/`;
  for (const p of treePaths) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
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
      const fixtureRoot = `conformance/${id}`;
      const manifestPath = `${fixtureRoot}/manifest.json`;
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

      // (a) fixture-level factory.module must be in-tree at this commit.
      const factoryModule = manifest.factory?.module;
      if (factoryModule === undefined) {
        console.error(`REQ-CCR-04.1: commit ${sha}'s ${manifestPath} has no factory.module`);
        failures++;
      } else {
        const factoryPath = `${fixtureRoot}/${factoryModule}`;
        if (!treePaths.has(factoryPath)) {
          console.error(`REQ-CCR-04.1: commit ${sha}'s fixture "${id}" declares factory.module "${factoryModule}" but ${factoryPath} is not in that commit's tree`);
          failures++;
        }
      }

      for (const c of manifest.cases ?? []) {
        // (b) every case-level factory.module override must resolve in-tree.
        if (c.factory !== undefined) {
          const overridePath = `${fixtureRoot}/${c.factory.module}`;
          if (!treePaths.has(overridePath)) {
            console.error(`REQ-CCR-04.1: commit ${sha}'s fixture "${id}" case "${c.name}" declares factory.module "${c.factory.module}" but ${overridePath} is not in that commit's tree`);
            failures++;
          }
        }

        // (c) seed/expected directory references — sentinels ("empty"/"zero-effect")
        // need no directory on disk, everything else must resolve to a non-empty dir.
        if (typeof c.seed === "string") {
          const seedPath = `${fixtureRoot}/${c.seed}`;
          if (!hasEntryUnder(treePaths, seedPath)) {
            console.error(`REQ-CCR-04.1: commit ${sha}'s fixture "${id}" case "${c.name}" declares seed "${c.seed}" but ${seedPath}/ has no entries in that commit's tree`);
            failures++;
          }
        }
        if (c.expected !== "empty" && c.expected !== "zero-effect") {
          const expectedPath = `${fixtureRoot}/${c.expected}`;
          if (!hasEntryUnder(treePaths, expectedPath)) {
            console.error(`REQ-CCR-04.1: commit ${sha}'s fixture "${id}" case "${c.name}" declares expected "${c.expected}" but ${expectedPath}/ has no entries in that commit's tree`);
            failures++;
          }
        }
      }

      // (c) lowering: schematic must ship schema.json + at least one schematic/files/** entry.
      if (manifest.lowering?.mode === "schematic") {
        const root = manifest.lowering.schematicRoot ?? "schematic";
        const schemaPath = `${fixtureRoot}/${root}/schema.json`;
        const filesPath = `${fixtureRoot}/${root}/files`;
        if (!treePaths.has(schemaPath)) {
          console.error(`REQ-CCR-04.1: commit ${sha}'s fixture "${id}" declares lowering.mode "schematic" but ${schemaPath} is not in that commit's tree`);
          failures++;
        }
        if (!hasEntryUnder(treePaths, filesPath)) {
          console.error(`REQ-CCR-04.1: commit ${sha}'s fixture "${id}" declares lowering.mode "schematic" but ${filesPath}/ has no entries in that commit's tree`);
          failures++;
        }
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
