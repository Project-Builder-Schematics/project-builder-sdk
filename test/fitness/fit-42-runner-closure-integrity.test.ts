/**
 * FIT-42 — runner closure integrity (Tier B: the real built tree).
 *
 * This file imports `scripts/derive-runner-closure.ts` deliberately: the build and the
 * fitness test must share ONE walk. FIT-27's non-reachability rule names
 * `scripts/regen-corpus.ts` specifically and is corpus-scoped; it does not extend here.
 *
 * S-000 lands the walking-skeleton subset (design §5 Tier B). The remaining RCD/RME/RMD/BPI
 * scenarios arrive in S-002 and the CST/BDI ones in S-003 — each in its own `describe`
 * block, so the extensions do not collide with this one.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  comparePaths,
  deriveRunnerClosure,
  type ClosureEdge,
  type ClosurePath,
} from "../../scripts/derive-runner-closure.ts";
import { ensureTscBuild } from "../support/shared-build.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { PROJECT_ROOT, hashFile } from "../support/scratch-consumer.ts";

const MANIFEST_RELATIVE_PATH = "runner-manifest.json";
const ENTRY_RELATIVE_PATH = "bin/pbuilder-runner.js";
const BASELINE_RELATIVE_PATH = "test/fitness/runner-closure-graph-baseline.json";
const BASELINE_PATH = join(PROJECT_ROOT, BASELINE_RELATIVE_PATH);

interface ClosureBaseline {
  nodes: ClosurePath[];
  edges: ClosureEdge[];
  builtins: string[];
}

const scratchRoot = scratchDirFactory("fit-42-");

const edgeKey = (edge: ClosureEdge): string => `${edge.from} ${edge.to} ${edge.specifier}`;

interface RunnerManifest {
  manifestVersion: number;
  algorithm: string;
  entry: string;
  packageVersion: string;
  files: Array<{ path: string; sha256: string }>;
}

let distDir = "";
let manifestPath = "";
let manifestRaw = "";
let manifest: RunnerManifest;

beforeAll(() => {
  distDir = ensureTscBuild();
  manifestPath = join(distDir, MANIFEST_RELATIVE_PATH);
  manifestRaw = readFileSync(manifestPath, "utf-8");
  manifest = JSON.parse(manifestRaw) as RunnerManifest;
});

describe("FIT-42 S-000 — the build emits a runner manifest", () => {
  it("REQ-BPI-01.1: `bun run build` leaves dist/runner-manifest.json on disk", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("REQ-RME-01.1: the manifest declares manifestVersion 1 and the sha256 algorithm", () => {
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.algorithm).toBe("sha256");
  });

  it("REQ-RME-01.1: the manifest carries 24 file records — the 23 closure files plus package.json", () => {
    expect(manifest.files.length).toBe(24);
  });

  it("REQ-RME-01.1: `entry` names the runner and appears exactly once among the file records", () => {
    expect(manifest.entry).toBe("dist/bin/pbuilder-runner.js");
    expect(manifest.files.filter((record) => record.path === manifest.entry).length).toBe(1);
  });

  it("REQ-RME-07.1: `packageVersion` equals the root package.json's version", () => {
    const rootPackage = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
      version: string;
    };
    expect(manifest.packageVersion).toBe(rootPackage.version);
  });

  it("REQ-RME-06.1: the manifest's raw bytes round-trip through JSON.stringify(_, null, 2)", () => {
    expect(manifestRaw).toBe(`${JSON.stringify(JSON.parse(manifestRaw), null, 2)}\n`);
  });

  it("REQ-RME-02.1: every digest recomputes from the bytes at its own path", () => {
    const mismatched = manifest.files.filter(
      (record) => hashFile(join(PROJECT_ROOT, record.path)) !== record.sha256
    );
    expect(mismatched).toEqual([]);
  });

  it("REQ-BPI-04.1: the generator prints exactly the two pinned identity lines", () => {
    const result = spawnSync("bun", ["scripts/generate-runner-manifest.ts"], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    const [first, second, ...rest] = result.stdout.trimEnd().split("\n");
    expect(first).toBe("runner-manifest: 24 files -> dist/runner-manifest.json");
    expect(second).toMatch(/^runner-manifest-sha256: [\da-f]{64}$/);
    expect(rest).toEqual([]);
  });
});

describe("FIT-42 S-000 — the derivation is right about the real tree", () => {
  it("REQ-RCD-02.2: the closure derived from the real dist/ is exactly 23 files", () => {
    expect(deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).nodes.length).toBe(23);
  });

  // RP-12 — the inverse red-proof. `removeComments` is unset, so both files' JSDoc
  // `@example` blocks (one quoting a bare specifier, one a relative one) survive into
  // dist/. Named files, so deleting the examples can never "fix" a regression here.
  it("REQ-RCD-03.3: the two JSDoc-quoting closure files report no violation", () => {
    expect([...deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).violations]).toEqual([]);
  });

  it("REQ-RCD-03.3: dist/core/authoring-error.js and dist/core/context.js are ordinary file records", () => {
    const paths = manifest.files.map((record) => record.path);
    expect(paths).toContain("dist/core/authoring-error.js");
    expect(paths).toContain("dist/core/context.js");
  });

  it("REQ-RCD-03.3: the JSDoc-quoted relative specifier adds no phantom node", () => {
    const derivation = deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH);
    expect(derivation.nodes).not.toContain("core/schema.generated.js");
  });

  // engine-client.ts is reachable only via `import type`, so tsc erases the edge: a SOURCE
  // walk yields 24 nodes, the emitted walk 23. This is the 23-vs-24 proof, by name.
  it("REQ-RCD-02.1: dist/core/engine-client.js exists on disk but is absent from the closure", () => {
    expect(existsSync(join(distDir, "core/engine-client.js"))).toBe(true);
    expect(deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).nodes).not.toContain(
      "core/engine-client.js"
    );
  });

  it("REQ-RCD-02.1: dist/core/engine-client.js is absent from the manifest's file records", () => {
    expect(manifest.files.map((record) => record.path)).not.toContain("dist/core/engine-client.js");
  });
});

describe("FIT-42 S-001 — the committed closure-graph baseline", () => {
  // Read-only on purpose. `bun run regen:closure-baseline` is deliberately outside the
  // build so a drifted closure cannot re-baseline itself (design §1.1); a TEST that ran the
  // regenerator against the real tree would reopen that hole one level up.
  it("REQ-BDI-03.1: the committed baseline is byte-identical to a fresh derivation of the real tree", () => {
    const { nodes, edges, builtins } = deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH);
    expect(readFileSync(BASELINE_PATH, "utf-8")).toBe(
      `${JSON.stringify({ nodes, edges, builtins }, null, 2)}\n`
    );
  });

  // Every run of the writer happens at an isolated root, never the repo's own.
  function regenerateAt(root: string): ReturnType<typeof spawnSync> {
    mkdirSync(join(root, "test/fitness"), { recursive: true });
    return spawnSync("bun", ["scripts/regen-closure-baseline.ts", root], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
  }

  it("REQ-BDI-03.1: the writer emits exactly {nodes, edges, builtins}, each sorted", () => {
    const root = scratchRoot();
    cpSync(distDir, join(root, "dist"), { recursive: true });

    expect(regenerateAt(root).status).toBe(0);

    const written = JSON.parse(
      readFileSync(join(root, BASELINE_RELATIVE_PATH), "utf-8")
    ) as ClosureBaseline;
    expect(Object.keys(written)).toEqual(["nodes", "edges", "builtins"]);
    expect(written.nodes).toEqual([...written.nodes].sort(comparePaths));
    expect(written.builtins).toEqual([...written.builtins].sort(comparePaths));
    expect(written.edges.map(edgeKey)).toEqual(written.edges.map(edgeKey).sort(comparePaths));
  });

  it("REQ-BDI-03.1: the writer refuses a tree whose derivation reports violations", () => {
    const root = scratchRoot();
    mkdirSync(join(root, "dist/bin"), { recursive: true });
    writeFileSync(join(root, "dist/bin/pbuilder-runner.js"), 'import "ts-morph";\n', "utf-8");

    expect(regenerateAt(root).status).not.toBe(0);
    expect(existsSync(join(root, BASELINE_RELATIVE_PATH))).toBe(false);
  });
});
