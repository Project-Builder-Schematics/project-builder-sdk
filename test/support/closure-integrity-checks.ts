import { existsSync } from "node:fs";
import { join, posix } from "node:path";

// Pure checkers shared by fit-42 (applies them to the real built tree) and
// fit-42.negative (plants inputs that prove they fire). Same split as the FIT-40 pair:
// the assertion and its red-proof must run the SAME code, or the red-proof proves nothing.
// No repo imports by design (node builtins only), so this module adds nothing to the
// module graph FIT-27 walks from test/support/**.
//
// ADR-0081: the bundler-output disjointness predicate lives in `scripts/bundler-
// disjointness.ts` (every other tripwire predicate's home) — this module is a CONSUMER,
// re-exporting it. Placement, not timing: Constraint 1 still ships as a structural CI
// check (`fit-42`), never a loader-observed build tripwire (ADR-0075 untouched).
export {
  findBundlerTargets,
  findDisjointnessViolations,
  findUnclassifiableBundlerConstructs,
  type BundlerFlag,
  type BundlerTarget,
  type DisjointnessViolation,
  type UnclassifiableBundlerConstruct,
} from "../../scripts/bundler-disjointness.ts";

/**
 * REQ-RMD-05.1: `username` bounded by PATH-SEGMENT delimiters, never a bare substring scan —
 * the CI user is literally named `runner`, which legitimately appears inside real closure
 * paths (`dist/bin/pbuilder-runner.js`) without ever being a path SEGMENT there (`runner.js`
 * is one segment, not `runner` followed by a `/`). Returns every path where `username` is
 * one of the `/`-split segments exactly.
 */
export function findUsernamePathSegmentViolations(
  paths: readonly string[],
  username: string
): string[] {
  return paths.filter((path) => path.split("/").includes(username));
}

export interface LocaleSensitiveApiFinding {
  readonly path: string;
  readonly line: number;
  readonly api: string;
}

const LOCALE_SENSITIVE_APIS = [".localeCompare(", "Intl.Collator", ".toLocaleUpperCase(", ".toLocaleLowerCase("];

/**
 * REQ-RMD-01.2: a structural, non-flaky proof that generation cannot vary by locale — no
 * `LC_ALL` child-process comparison (retired: Bun's default collator resolves `en-US`
 * regardless of the locale env, so that scenario could never fail its own mutation). Scans
 * raw source TEXT (not an AST) for the four locale-sensitive API spellings the requirement
 * names, line by line, naming the file/line/api of every hit.
 */
export function findLocaleSensitiveApiUsage(
  files: ReadonlyArray<{ readonly path: string; readonly source: string }>
): LocaleSensitiveApiFinding[] {
  const findings: LocaleSensitiveApiFinding[] = [];
  for (const { path, source } of files) {
    const lines = source.split("\n");
    lines.forEach((lineText, index) => {
      for (const api of LOCALE_SENSITIVE_APIS) {
        if (lineText.includes(api)) findings.push({ path, line: index + 1, api });
      }
    });
  }
  return findings;
}

export interface PathHygieneFinding {
  readonly rule: "non-posix" | "leading-dot-slash" | "absolute" | "parent-segment" | "duplicate";
  readonly path: string;
}

export function findPathHygieneViolations(paths: readonly string[]): PathHygieneFinding[] {
  const findings: PathHygieneFinding[] = [];
  for (const path of paths) {
    if (path.includes("\\")) findings.push({ rule: "non-posix", path });
    if (path.startsWith("./")) findings.push({ rule: "leading-dot-slash", path });
    if (path.startsWith("/")) findings.push({ rule: "absolute", path });
    if (path.split("/").includes("..")) findings.push({ rule: "parent-segment", path });
  }

  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) findings.push({ rule: "duplicate", path });
    seen.add(path);
  }
  return findings;
}

export interface ByteFinding {
  readonly path: string;
  readonly offset: number;
}

const CR = 0x0d;
const LF = 0x0a;
const BOM = [0xef, 0xbb, 0xbf];

export function findCrlfOffenders(
  files: ReadonlyArray<{ readonly path: string; readonly bytes: Uint8Array }>
): ByteFinding[] {
  const findings: ByteFinding[] = [];
  for (const { path, bytes } of files) {
    for (let offset = 0; offset < bytes.length - 1; offset += 1) {
      if (bytes[offset] === CR && bytes[offset + 1] === LF) {
        findings.push({ path, offset });
        break;
      }
    }
  }
  return findings;
}

export function findBomOffenders(
  files: ReadonlyArray<{ readonly path: string; readonly bytes: Uint8Array }>
): string[] {
  return files
    .filter(({ bytes }) => BOM.every((byte, index) => bytes[index] === byte))
    .map(({ path }) => path);
}

export interface IntermediatePackageFinding {
  readonly path: string;
  readonly reason: string;
}

/**
 * package.json files sitting strictly between the runner entry and the package root. One
 * planted there terminates the upward walk early and reinterprets parse mode for every
 * hashed file — with no digest change at all, because a manifest is an inclusion list and
 * cannot express absence.
 */
export function findIntermediatePackageJsons(
  packageRoot: string,
  entryRelPath: string
): IntermediatePackageFinding[] {
  const findings: IntermediatePackageFinding[] = [];
  let dir = posix.dirname(entryRelPath);
  while (dir !== "." && dir !== "" && dir !== "/") {
    const candidate = posix.join(dir, "package.json");
    if (existsSync(join(packageRoot, candidate))) {
      findings.push({
        path: candidate,
        reason:
          "terminates the package-root walk early and reinterprets parse mode with NO digest change",
      });
    }
    dir = posix.dirname(dir);
  }
  return findings;
}


export interface ClosureEdgeLike {
  readonly from: string;
  readonly to: string;
  readonly specifier: string;
}

export interface ClosureGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly ClosureEdgeLike[];
}

export interface BaselineDrift {
  readonly addedNodes: string[];
  readonly removedNodes: string[];
  readonly addedEdges: ClosureEdgeLike[];
  readonly removedEdges: ClosureEdgeLike[];
}

/**
 * Nodes AND edges. A node-set-only comparison passes an attack that repoints A -> C instead
 * of A -> B with the node set unchanged — which is the closure-sealing case itself.
 */
export function diffClosureBaseline(observed: ClosureGraph, baseline: ClosureGraph): BaselineDrift {
  const baselineNodes = new Set(baseline.nodes);
  const observedNodes = new Set(observed.nodes);
  const baselineEdges = new Set(baseline.edges.map(edgeKey));
  const observedEdges = new Set(observed.edges.map(edgeKey));

  return {
    addedNodes: observed.nodes.filter((node) => !baselineNodes.has(node)),
    removedNodes: baseline.nodes.filter((node) => !observedNodes.has(node)),
    addedEdges: observed.edges.filter((edge) => !baselineEdges.has(edgeKey(edge))),
    removedEdges: baseline.edges.filter((edge) => !observedEdges.has(edgeKey(edge))),
  };
}

const edgeKey = (edge: ClosureEdgeLike): string =>
  `${edge.from} -> ${edge.to} (${edge.specifier})`;

export function hasDrift(drift: BaselineDrift): boolean {
  return (
    drift.addedNodes.length + drift.removedNodes.length + drift.addedEdges.length +
      drift.removedEdges.length >
    0
  );
}

/** design.md §9 `BASELINE_DRIFT_MESSAGE` — permissive register: growth is allowed, silence is not. */
export function renderBaselineDrift(
  drift: BaselineDrift,
  counts: { readonly observed: number; readonly baseline: number }
): string {
  const srcOf = (path: string): string => `src/${path.replace(/\.(js|mjs|cjs)$/, ".ts")}`;
  const lines = (label: string, entries: readonly string[]): string[] =>
    entries.length === 0 ? [`  ${label}(none)`] : entries.map((entry) => `  ${label}${entry}`);

  const removed = [
    ...drift.removedNodes,
    ...drift.removedEdges.map((edge) => `${edge.from} -> ${edge.specifier}`),
  ];

  return [
    "fit-42: the runner closure changed.",
    `  ${counts.observed} files are reachable from dist/bin/pbuilder-runner.js; the committed baseline has ${counts.baseline}.`,
    ...lines("added node:  ", drift.addedNodes),
    ...lines(
      "added edge:  ",
      drift.addedEdges.map((edge) => `${edge.from} -> ${edge.specifier}   (${srcOf(edge.from)})`)
    ),
    ...lines("removed:     ", removed),
    "",
    "This is not automatically wrong — the closure is allowed to grow. It is wrong if you did not",
    "mean to change it. If you did mean it:",
    "  1. check the new file against the constraints in docs/runner-integrity-invariants.md,",
    "  2. regenerate: bun run build && bun run regen:closure-baseline,",
    "  3. commit test/fitness/runner-closure-graph-baseline.json in the SAME commit, and say in",
    "     the commit message why the closure grew — the engine verifies whatever we publish.",
    "",
  ].join("\n");
}

export interface EmitComparisonEntry {
  readonly path: string;
  readonly emitted: readonly string[];
  readonly source: readonly string[];
  readonly sourceTypeOnly: readonly string[];
}

export interface EmitMismatch {
  readonly path: string;
  readonly missingInSource: string[];
  readonly unexplainedInSource: string[];
}

/**
 * The load-bearing half is dist ⊆ src: an emitted specifier with no source counterpart means
 * the graph was rewritten. The anti-vacuity half is that every src-only specifier must be
 * explained by type-only erasure — the same erasure that makes the closure 23 files, not 24.
 */
export function findGraphEmitMismatches(
  entries: readonly EmitComparisonEntry[]
): EmitMismatch[] {
  const mismatches: EmitMismatch[] = [];
  for (const entry of entries) {
    const erased = [...entry.sourceTypeOnly];
    const expected: string[] = [];
    for (const specifier of entry.source) {
      const erasedAt = erased.indexOf(specifier);
      if (erasedAt !== -1) {
        erased.splice(erasedAt, 1);
        continue;
      }
      expected.push(specifier.replace(/\.tsx?$/, ".js"));
    }

    const missingInSource = subtractMultiset(entry.emitted, expected);
    const unexplainedInSource = subtractMultiset(expected, entry.emitted).map((rewritten) =>
      rewritten.replace(/\.js$/, ".ts")
    );
    if (missingInSource.length > 0 || unexplainedInSource.length > 0) {
      mismatches.push({ path: entry.path, missingInSource, unexplainedInSource });
    }
  }
  return mismatches;
}

function subtractMultiset(from: readonly string[], remove: readonly string[]): string[] {
  const remaining = [...remove];
  const left: string[] = [];
  for (const item of from) {
    const at = remaining.indexOf(item);
    if (at === -1) left.push(item);
    else remaining.splice(at, 1);
  }
  return left;
}
