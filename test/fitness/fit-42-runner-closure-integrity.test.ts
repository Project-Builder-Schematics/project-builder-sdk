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
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  BASELINE_RELATIVE_PATH,
  CREATE_REQUIRE_ANCHOR_FILE,
  ENTRY_RELATIVE_PATH,
  MANIFEST_RELATIVE_PATH,
  SANCTIONED_DYNAMIC_IMPORT_FILE,
  comparePaths,
  deriveRunnerClosure,
  readSpecifiers,
  type ClosureEdge,
  type ClosurePath,
  type RunnerManifest,
} from "../../scripts/derive-runner-closure.ts";
import { tmpdir, userInfo } from "node:os";
import { ensureTscBuild } from "../support/shared-build.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { PROJECT_ROOT, hashFile } from "../support/scratch-consumer.ts";
import {
  diffClosureBaseline,
  findBomOffenders,
  findBundlerTargets,
  findCrlfOffenders,
  findDisjointnessViolations,
  findGraphEmitMismatches,
  findIntermediatePackageJsons,
  findPathHygieneViolations,
  hasDrift,
  renderBaselineDrift,
  type EmitComparisonEntry,
} from "../support/closure-integrity-checks.ts";

const BASELINE_PATH = join(PROJECT_ROOT, BASELINE_RELATIVE_PATH);

interface ClosureBaseline {
  nodes: ClosurePath[];
  edges: ClosureEdge[];
  builtins: string[];
}

const scratchRoot = scratchDirFactory("fit-42-");

const edgeKey = (edge: ClosureEdge): string => `${edge.from} ${edge.to} ${edge.specifier}`;

let distDir = "";
let manifestPath = "";
let manifestRaw = "";
let manifest: RunnerManifest;
let pristineRoot = "";

beforeAll(() => {
  distDir = ensureTscBuild();
  manifestPath = join(distDir, MANIFEST_RELATIVE_PATH);
  manifestRaw = readFileSync(manifestPath, "utf-8");
  manifest = JSON.parse(manifestRaw) as RunnerManifest;

  pristineRoot = mkdtempSync(join(tmpdir(), "fit-42-pristine-"));
  cpSync(distDir, join(pristineRoot, "dist"), { recursive: true });
  cpSync(join(PROJECT_ROOT, "package.json"), join(pristineRoot, "package.json"));
});

afterAll(() => {
  if (pristineRoot !== "") rmSync(pristineRoot, { recursive: true, force: true });
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

const EXCLUDED_FROM_MANIFEST = [
  /\.d\.ts$/,
  /^dist\/dialects\//,
  /^dist\/commons\//,
  /^dist\/conformance\//,
  /^dist\/testing\//,
  /(^|\/)node_modules\//,
  /^dist\/runner-manifest\.json$/,
];

describe("FIT-42 S-002 — the manifest agrees with the committed baseline", () => {
  it("REQ-RCD-01.1: the derived closure equals the baseline's node set", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as ClosureBaseline;
    const derived = deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).nodes;
    expect([...derived].sort(comparePaths)).toEqual([...baseline.nodes].sort(comparePaths));
  });

  // Never a literal six-element array: pinning the identity of today's builtins would turn a
  // legitimate future `node:buffer` into a red build, against the design's permissive bias.
  it("REQ-RCD-04.1: the observed builtin set equals the baseline's builtins row", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as ClosureBaseline;
    const derived = deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).builtins;
    expect([...derived]).toEqual([...baseline.builtins]);
  });
});

describe("FIT-42 S-002 — the manifest's shape, exclusions, hygiene and ordering", () => {
  it("REQ-RME-01.3: the top-level key set is exactly the five pinned fields", () => {
    expect(Object.keys(manifest)).toEqual([
      "manifestVersion",
      "algorithm",
      "entry",
      "packageVersion",
      "files",
    ]);
  });

  it("REQ-RME-01.3: every file record's key set is exactly {path, sha256}", () => {
    const offenders = manifest.files.filter(
      (record) => JSON.stringify(Object.keys(record)) !== '["path","sha256"]'
    );
    expect(offenders).toEqual([]);
  });

  it("REQ-RME-01.2: exactly one record is package.json and the other 23 start with dist/", () => {
    const paths = manifest.files.map((record) => record.path);
    expect(paths.filter((path) => path === "package.json").length).toBe(1);
    expect(paths.filter((path) => path.startsWith("dist/")).length).toBe(23);
  });

  it("REQ-RME-03.1: no record matches an excluded tree, a .d.ts, or the manifest itself", () => {
    const offenders = manifest.files
      .map((record) => record.path)
      .filter((path) => EXCLUDED_FROM_MANIFEST.some((pattern) => pattern.test(path)));
    expect(offenders).toEqual([]);
  });

  it("REQ-RME-04.1: every record path passes path hygiene", () => {
    expect(findPathHygieneViolations(manifest.files.map((record) => record.path))).toEqual([]);
  });

  it("REQ-RME-05.1: consecutive record paths are strictly ascending under Buffer.compare", () => {
    const paths = manifest.files.map((record) => record.path);
    const notAscending = paths.filter(
      (path, index) => index > 0 && comparePaths(paths[index - 1] as string, path) >= 0
    );
    expect(notAscending).toEqual([]);
  });

  it("REQ-RMD-05.1: the manifest bytes carry no cwd and no username", () => {
    expect(manifestRaw).not.toContain(process.cwd());
    expect(manifestRaw).not.toContain(userInfo().username);
  });
});

describe("FIT-42 S-002 — the closure's own bytes are line-ending and BOM clean", () => {
  function closureFileBytes(): Array<{ path: string; bytes: Uint8Array }> {
    const files: Array<{ path: string; bytes: Uint8Array }> = [];
    for (const node of deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).nodes) {
      files.push({ path: `dist/${node}`, bytes: readFileSync(join(distDir, node)) });
      const source = join(PROJECT_ROOT, "src", node.replace(/\.js$/, ".ts"));
      if (existsSync(source)) files.push({ path: `src/${node}`, bytes: readFileSync(source) });
    }
    return files;
  }

  it("REQ-RMD-03.2: no emitted closure file contains a CRLF pair", () => {
    const emitted = closureFileBytes().filter(({ path }) => path.startsWith("dist/"));
    expect(emitted.length).toBe(23);
    expect(findCrlfOffenders(emitted)).toEqual([]);
  });

  it("REQ-RMD-03.4: no closure source or emitted file begins with a UTF-8 BOM", () => {
    const files = closureFileBytes();
    expect(files.filter(({ path }) => path.startsWith("src/")).length).toBeGreaterThan(0);
    expect(findBomOffenders(files)).toEqual([]);
  });
});

// Every mutating Tier-B case operates on its own copy. The real memoized dist/ is read by
// FIT-04, FIT-14, the dist-runner e2e and this file's own digest checks — mutating it would
// corrupt a tree nothing rebuilds within one `bun test` process.
// Copies come from a snapshot taken ONCE in beforeAll, not from the live dist/: another
// test file's unmemoized `bun run build` deletes and rebuilds the real tree mid-suite, and
// a body-time read of it would race that rebuild five separate times.
function copyPackageRootTo(root: string): string {
  mkdirSync(root, { recursive: true });
  cpSync(join(pristineRoot, "dist"), join(root, "dist"), { recursive: true });
  cpSync(join(pristineRoot, "package.json"), join(root, "package.json"));
  return root;
}

function copiedPackageRoot(): string {
  return copyPackageRootTo(scratchRoot());
}

function runGenerator(root: string, extraEnv?: Record<string, string>): ReturnType<typeof spawnSync> {
  return spawnSync("bun", ["scripts/generate-runner-manifest.ts", root], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    env: extraEnv === undefined ? process.env : { ...process.env, ...extraEnv },
  });
}

const manifestIn = (root: string): string => join(root, "dist", MANIFEST_RELATIVE_PATH);

describe("FIT-42 S-002 — the manifest is deterministic", () => {
  it("REQ-RMD-01.1: two consecutive generator runs on an unchanged tree agree byte for byte", () => {
    const root = copiedPackageRoot();
    expect(runGenerator(root).status).toBe(0);
    const first = readFileSync(manifestIn(root), "utf-8");
    expect(runGenerator(root).status).toBe(0);
    expect(readFileSync(manifestIn(root), "utf-8")).toBe(first);
  });

  // Two CHILD processes, never a mutation of this process's env.
  //
  // SCOPE, stated so nobody reads this as more than it is: under Bun no locale env var
  // (LC_ALL, LANG, LC_COLLATE) moves the default collator — `Intl.Collator()` resolves to
  // en-US regardless, verified — so this proves cross-process byte-stability under a
  // differing environment, NOT that a `localeCompare` implementation would be caught.
  // The assertion that actually kills `localeCompare` is REQ-RME-05.2's pinned pairs.
  it("REQ-RMD-01.2: runs under LC_ALL=C and LC_ALL=tr_TR.UTF-8 agree byte for byte", () => {
    const root = copiedPackageRoot();
    expect(runGenerator(root, { LC_ALL: "C" }).status).toBe(0);
    const underC = readFileSync(manifestIn(root), "utf-8");
    expect(runGenerator(root, { LC_ALL: "tr_TR.UTF-8" }).status).toBe(0);
    expect(readFileSync(manifestIn(root), "utf-8")).toBe(underC);
  });

  it("REQ-RMD-02.1: a root whose path holds a space and a non-ASCII segment yields the canonical bytes", () => {
    const root = copyPackageRootTo(join(scratchRoot(), "prüf ung"));
    expect(root).toMatch(/ /);
    expect(root).toMatch(/[^\x20-\x7e]/);

    expect(runGenerator(root).status).toBe(0);
    expect(readFileSync(manifestIn(root), "utf-8")).toBe(manifestRaw);
  });
});

describe("FIT-42 S-002 — tampering is localised to the file that changed", () => {
  // RP-1.
  it("REQ-RMD-04.1: appending one byte to a copied session.js changes exactly that record", () => {
    const root = copiedPackageRoot();
    expect(runGenerator(root).status).toBe(0);
    const before = JSON.parse(readFileSync(manifestIn(root), "utf-8")) as RunnerManifest;

    appendFileSync(join(root, "dist/core/session.js"), "\n");
    expect(runGenerator(root).status).toBe(0);
    const after = JSON.parse(readFileSync(manifestIn(root), "utf-8")) as RunnerManifest;

    expect(after.files.length).toBe(before.files.length);
    expect(after.files.map((r) => r.path)).toEqual(before.files.map((r) => r.path));
    const changed = after.files.filter(
      (record, index) => record.sha256 !== (before.files[index] as { sha256: string }).sha256
    );
    expect(changed.map((record) => record.path)).toEqual(["dist/core/session.js"]);
  });
});

describe("FIT-42 S-002 — the generator fails closed and leaves nothing behind", () => {
  // Invoked DIRECTLY, never through the build wrapper: the `prebuild` clean would delete the
  // prepared manifest before the generator ran, making the assertion vacuous.
  it("REQ-BPI-02.1: a violating tree that already holds a manifest ends with no manifest", () => {
    const root = copiedPackageRoot();
    expect(runGenerator(root).status).toBe(0);
    expect(existsSync(manifestIn(root))).toBe(true);

    appendFileSync(join(root, "dist/core/wire.js"), 'import "ts-morph";\n');
    const result = runGenerator(root);

    expect(result.status).not.toBe(0);
    expect(existsSync(manifestIn(root))).toBe(false);
  });

  it.skipIf(process.getuid?.() === 0)(
    "REQ-BPI-02.2: an unreadable closure file leaves no file at all at the manifest path",
    () => {
      const root = copiedPackageRoot();
      rmSync(manifestIn(root), { force: true });
      chmodSync(join(root, "dist/core/session.js"), 0o000);

      const result = runGenerator(root);

      expect(result.status).not.toBe(0);
      expect(existsSync(manifestIn(root))).toBe(false);
    }
  );
});

// Reads go through the beforeAll snapshot, never the live dist/: another file's unmemoized
// build deletes and rebuilds the real tree mid-suite.
const snapshotDist = (): string => join(pristineRoot, "dist");

describe("FIT-42 S-003 — the real tree honours Constraints 2, 4 and 5", () => {
  it("REQ-CST-03.3: exactly one dynamic import() in the closure, and it is in transport/runner.js", () => {
    const counts = deriveRunnerClosure(snapshotDist(), ENTRY_RELATIVE_PATH)
      .nodes.map((node) => ({
        node,
        count: readSpecifiers(join(snapshotDist(), node)).dynamicImportCount,
      }))
      .filter(({ count }) => count > 0);
    expect(counts).toEqual([{ node: SANCTIONED_DYNAMIC_IMPORT_FILE, count: 1 }]);
  });

  it("REQ-CST-03.3: the sanctioned site carries the SANCTIONED-FACTORY-IMPORT marker in source", () => {
    const source = readFileSync(join(PROJECT_ROOT, "src/transport/runner.ts"), "utf-8");
    expect(source).toContain("SANCTIONED-FACTORY-IMPORT");
  });

  it("REQ-CST-04.3: the deny-scan reports zero violations against the real closure", () => {
    expect([...deriveRunnerClosure(snapshotDist(), ENTRY_RELATIVE_PATH).violations]).toEqual([]);
  });

  // Non-vacuity: the anchored file really does hold createRequire references, so "no
  // violations" above is an exemption working, not a file that happens to be clean.
  it("REQ-CST-04.3: the anchored probe genuinely references createRequire and is not flagged", () => {
    const probe = readFileSync(join(snapshotDist(), CREATE_REQUIRE_ANCHOR_FILE), "utf-8");
    expect(probe.split("createRequire").length - 1).toBeGreaterThanOrEqual(2);
    const flagged = deriveRunnerClosure(snapshotDist(), ENTRY_RELATIVE_PATH).violations.filter(
      (violation) => violation.file === CREATE_REQUIRE_ANCHOR_FILE
    );
    expect(flagged).toEqual([]);
  });

  it("REQ-CST-05.1: no package.json sits between the runner entry and the package root", () => {
    expect(findIntermediatePackageJsons(pristineRoot, `dist/${ENTRY_RELATIVE_PATH}`)).toEqual([]);
    expect(existsSync(join(snapshotDist(), "package.json"))).toBe(false);
    expect(existsSync(join(snapshotDist(), "bin/package.json"))).toBe(false);
  });
});

describe("FIT-42 S-003 — the closure graph is the one the sources describe", () => {
  const relativeOnly = (specifiers: readonly string[]): string[] =>
    specifiers.filter((specifier) => specifier.startsWith("./") || specifier.startsWith("../"));

  function emitComparison(): EmitComparisonEntry[] {
    return deriveRunnerClosure(snapshotDist(), ENTRY_RELATIVE_PATH).nodes.map((node) => {
      const source = readSpecifiers(join(PROJECT_ROOT, "src", node.replace(/\.js$/, ".ts")));
      return {
        path: node,
        emitted: relativeOnly(readSpecifiers(join(snapshotDist(), node)).staticSpecifiers),
        source: relativeOnly(source.staticSpecifiers),
        sourceTypeOnly: relativeOnly(source.typeOnlyStatic),
      };
    });
  }

  it("REQ-BDI-02.1: every closure file's specifier multiset survives emission unchanged", () => {
    const entries = emitComparison();
    expect(entries.length).toBe(23);
    expect(findGraphEmitMismatches(entries)).toEqual([]);
  });

  // BDI-02.2 by name: both carry type-only imports, which is exactly the erasure that would
  // false-alarm a naive dist-vs-src comparison.
  it("REQ-BDI-02.2: session.ts and stdio-engine-client.ts carry type-only imports and are not flagged", () => {
    const named = emitComparison().filter((entry) =>
      ["core/session.js", "transport/stdio-engine-client.js"].includes(entry.path)
    );
    expect(named.map((entry) => entry.path).sort()).toEqual([
      "core/session.js",
      "transport/stdio-engine-client.js",
    ]);
    expect(named.every((entry) => entry.sourceTypeOnly.length > 0)).toBe(true);
    expect(findGraphEmitMismatches(named)).toEqual([]);
  });

  it("REQ-BDI-01.1: every bundler target in package.json#scripts lands outside the closure", () => {
    const scripts = (
      JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    const targets = findBundlerTargets(scripts);
    const closurePaths = deriveRunnerClosure(snapshotDist(), ENTRY_RELATIVE_PATH).nodes.map(
      (node) => `dist/${node}`
    );

    // Non-vacuous: the codegen bundle IS a real target and IS correctly judged outside.
    expect(targets.map((target) => target.target)).toContain("dist/bin/pbuilder-codegen.js");
    expect(closurePaths).not.toContain("dist/bin/pbuilder-codegen.js");
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([]);
  });

  it("REQ-BDI-03.1: the derived graph shows no drift against the committed baseline", () => {
    const observed = deriveRunnerClosure(snapshotDist(), ENTRY_RELATIVE_PATH);
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as ClosureBaseline;
    const drift = diffClosureBaseline(observed, baseline);
    expect(baseline.edges.length).toBeGreaterThan(0);
    // On failure, the instructional drift message (added node/edge, how to reconcile) IS the
    // assertion's own failure output — not just a bare boolean a maintainer has to decode.
    const drifted = hasDrift(drift);
    expect(
      drifted,
      drifted
        ? renderBaselineDrift(drift, {
            observed: observed.nodes.length,
            baseline: baseline.nodes.length,
          })
        : undefined
    ).toBe(false);
  });
});

describe("FIT-42 S-003 — the one real-tree negative, and the epilogue each tool prints", () => {
  // RP-4's Tier-B half. QA's tier rule allows exactly one real-tree negative; the other
  // eleven red-proofs are synthetic, in the negative file.
  it("REQ-CST-01.1: a bare specifier planted in a copied real tree fails, naming the src file", () => {
    const root = copiedPackageRoot();
    appendFileSync(join(root, "dist/core/wire.js"), 'import { Project } from "ts-morph";\n');

    const result = runGenerator(root);
    const stderr = result.stderr as unknown as string;

    expect(result.status).not.toBe(0);
    expect(existsSync(manifestIn(root))).toBe(false);
    expect(stderr).toContain("runner-manifest: src/core/wire.ts");
    expect(stderr).toContain('"ts-morph"');
    expect(stderr).toContain("Constraint 3 — no bare third-party specifier inside the closure.");
    expect(stderr).toContain("No manifest was written; dist/runner-manifest.json does not exist.");
  });

  it("REQ-CST-06.1: the baseline writer's failure names the baseline, never the manifest", () => {
    const root = copiedPackageRoot();
    mkdirSync(join(root, "test/fitness"), { recursive: true });
    appendFileSync(join(root, "dist/core/wire.js"), 'import { Project } from "ts-morph";\n');

    const result = spawnSync("bun", ["scripts/regen-closure-baseline.ts", root], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
    const stderr = result.stderr as unknown as string;

    expect(result.status).not.toBe(0);
    expect(stderr).toContain("Constraint 3 — no bare third-party specifier inside the closure.");
    expect(stderr).toContain(
      "No baseline was written; test/fitness/runner-closure-graph-baseline.json is unchanged."
    );
    expect(stderr).not.toContain("No manifest was written");
  });
});
