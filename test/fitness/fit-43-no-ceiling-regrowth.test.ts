/**
 * FIT-NEW-A (`fitness-guards` REQ-FTG-06, ADR-0077): the containment ceiling this change
 * deletes must never regrow. Six lettered clauses, (a)-(d)/(f) run LIVE against the real
 * `src/**`/`test/**` trees; clause (e) — the `openspec/specs/` sweep — is FIXTURE-PAIR
 * ONLY here (REQ-FTG-06.4): its real-tree invocation is archive-sync work, owned by
 * `sdd-archive` and `package-root-containment`'s own post-archive-sync criterion (design
 * §8, spec V3.3 amendment). All scanners are pure functions over an injectable file list
 * (`test/support/src-invariant-scans.ts`); negatives run against fixture trees under
 * `test/fixtures/red/src-invariant-scans/**`, never a live mutation of the real tree.
 */
import { describe, it, expect } from "bun:test";
import { collectFiles } from "../support/import-scan.ts";
import {
  readScanFiles,
  findLiteralOccurrences,
  findAncestorWalkIdiom,
  findRealpathReferences,
  findMarkerFabricationWrites,
  findOrphanedRetiredCitations,
} from "../support/src-invariant-scans.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = `${PROJECT_ROOT}src`;
const TEST_DIR = `${PROJECT_ROOT}test`;
const RED_ROOT = `${PROJECT_ROOT}test/fixtures/red/src-invariant-scans`;
const SINGLE_INSTANCE_PROBE_PATH = `${SRC_DIR}/transport/single-instance-probe.ts`;
const CONTEXT_TS_PATH = `${SRC_DIR}/core/context.ts`;
const CORE_CONTEXT_DTS_PATH = `${PROJECT_ROOT}test/fitness/dts-baseline/core.context.d.ts`;

const PACKAGE_ROOT_FOR_ALLOWLIST = new Set([`${SINGLE_INSTANCE_PROBE_PATH}#packageRootFor`]);
const EMPTY_ALLOWLIST = new Set<string>();

function realSrcFiles() {
  return readScanFiles(collectFiles(SRC_DIR, ".ts"));
}

function realTestHelperFiles() {
  // Clause (d) scopes to shared fixture/helper modules (scratch-dir.ts's own kind), never
  // one-off *.test.ts assertions (e.g. run-boundary.test.ts's deliberate, single-case
  // positive-control plant, which proves the marker is inert — not a fabricating helper) —
  // and never the deliberately-red fixtures under test/fixtures/red/**, which are NEVER
  // walked live (mirrors every other fitness scan's own posture).
  return readScanFiles(
    collectFiles(TEST_DIR, ".ts").filter((p) => !p.endsWith(".test.ts") && !p.includes("/test/fixtures/red/"))
  );
}

describe("FIT-NEW-A (fit-43) — no ceiling regrowth", () => {
  describe("clause (a) — zero `collection.json` literal in src/**", () => {
    it("the real src/** tree has zero occurrences", () => {
      expect(findLiteralOccurrences(realSrcFiles(), "collection.json")).toEqual([]);
    });

    it("[red-proof] REQ-FTG-06.1 — a fixture reintroducing the literal is caught", () => {
      const fixture = readScanFiles([`${RED_ROOT}/collection-json-literal.ts`]);
      expect(findLiteralOccurrences(fixture, "collection.json")).toEqual([
        `${RED_ROOT}/collection-json-literal.ts`,
      ]);
    });
  });

  describe("clause (b) — no ancestor-walk idiom in src/**, symbol-scoped allowlist", () => {
    it("the real src/** tree has zero non-allowlisted offenders", () => {
      expect(findAncestorWalkIdiom(realSrcFiles(), PACKAGE_ROOT_FOR_ALLOWLIST)).toEqual([]);
    });

    it("[red-proof] REQ-FTG-06.1 — a fixture reintroducing the idiom is caught", () => {
      const fixture = readScanFiles([`${RED_ROOT}/ancestor-walk.ts`]);
      expect(findAncestorWalkIdiom(fixture, EMPTY_ALLOWLIST)).toEqual([
        { file: `${RED_ROOT}/ancestor-walk.ts`, symbol: "regrownAncestorWalk" },
      ]);
    });

    it("[red-proof] REQ-FTG-06.2 — the symbol-scoped allowlist does not shadow a second offender in the SAME file", () => {
      const path = `${RED_ROOT}/ancestor-walk-allowlist-shadow.ts`;
      const fixture = readScanFiles([path]);
      const allowlist = new Set([`${path}#packageRootFor`]);
      expect(findAncestorWalkIdiom(fixture, allowlist)).toEqual([{ file: path, symbol: "secondOffendingWalk" }]);
    });
  });

  describe("clause (c) — RunContext.packageAnchors's type literal EQUALS { packageDir: string } (Q8, positive shape)", () => {
    it("the kit-internal core.context.d.ts baseline pins exactly one field", async () => {
      const content = await Bun.file(CORE_CONTEXT_DTS_PATH).text();
      const match = /packageAnchors\?:\s*\{([^}]*)\};/.exec(content);
      expect(match).not.toBeNull();
      const fields = match![1]!
        .split(";")
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s.length > 0);
      // Equality, never containment (Q8) — a superset (a regrown `packageRoot`-shaped
      // additive field) must fail this, not merely "contains packageDir".
      expect(fields).toEqual(["packageDir: string"]);
    });
  });

  describe("clause (d) — test/** marker-fabrication allowlist is EMPTY", () => {
    it("no shared fixture/helper module fabricates the retired marker", () => {
      expect(findMarkerFabricationWrites(realTestHelperFiles(), EMPTY_ALLOWLIST)).toEqual([]);
    });

    it("[red-proof] a reintroduced marker-fabricating helper is caught", () => {
      const path = `${RED_ROOT}/marker-fabrication.ts`;
      const fixture = readScanFiles([path]);
      expect(findMarkerFabricationWrites(fixture, EMPTY_ALLOWLIST)).toEqual([{ file: path, function: "seedMarker" }]);
    });

    it("[red-proof] the allowlist, once granted, silences the SAME offender", () => {
      const path = `${RED_ROOT}/marker-fabrication.ts`;
      const fixture = readScanFiles([path]);
      expect(findMarkerFabricationWrites(fixture, new Set([`${path}#seedMarker`]))).toEqual([]);
    });
  });

  describe("clause (e) — REQ-FTG-06.4: the openspec/specs/ sweep LOGIC, fixture-pair only (real-tree run is archive-sync, never invoked here)", () => {
    it("fixture A (a live, non-version-history retired citation) fails, naming the offending file and line", () => {
      const path = `${RED_ROOT}/openspec-sweep/live-hit.md`;
      const fixture = readScanFiles([path]);
      const hits = findOrphanedRetiredCitations(fixture);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => h.file === path)).toBe(true);
    });

    it("fixture B (only allowlisted version-history mentions) does NOT fail — the logic credits the allowlist, not merely string-matching", () => {
      const path = `${RED_ROOT}/openspec-sweep/allowlist-only.md`;
      const fixture = readScanFiles([path]);
      expect(findOrphanedRetiredCitations(fixture)).toEqual([]);
    });
  });

  describe("clause (f) — zero realpathSync/realpath references in src/scaffold/** or src/core/context.ts, symbol-scoped allowlist", () => {
    it("the real trees have zero non-allowlisted occurrences", () => {
      const scaffoldFiles = readScanFiles(collectFiles(`${SRC_DIR}/scaffold`, ".ts"));
      const contextFile = readScanFiles([CONTEXT_TS_PATH]);
      expect(findRealpathReferences([...scaffoldFiles, ...contextFile], PACKAGE_ROOT_FOR_ALLOWLIST)).toEqual([]);
    });

    it("[red-proof] REQ-FTG-06.3 — a reintroduced realpathSync/realpath reference (code and comment) is caught, the allowlisted symbol does NOT trigger a failure in the SAME fixture set", () => {
      const offenderPath = `${RED_ROOT}/realpath-reference.ts`;
      // A FOCUSED synthetic mirror of the allowlisted symbol's own body ONLY (the real
      // single-instance-probe.ts also carries an unrelated top-level import and comment
      // mentioning realpath OUTSIDE packageRootFor's body — including it here would
      // conflate "is the allowlist symbol-scoped" with "does this unrelated file have
      // other, out-of-scope realpath mentions", which is a different, already-covered
      // question (clause (f)'s real scan never includes this file at all).
      const allowlistedMirrorPath = `${RED_ROOT}/package-root-for-mirror.ts`;
      const allowlistedMirror = {
        path: allowlistedMirrorPath,
        content: [
          "function packageRootFor(filePath: string): string {",
          "  let dir = dirname(filePath);",
          "  for (;;) {",
          '    if (existsSync(join(dir, "package.json"))) return realpathSync(dir);',
          "    const parent = dirname(dir);",
          "    if (parent === dir) return realpathSync(dirname(filePath));",
          "    dir = parent;",
          "  }",
          "}",
        ].join("\n"),
      };
      const allowlist = new Set([`${allowlistedMirrorPath}#packageRootFor`]);
      const files = [...readScanFiles([offenderPath]), allowlistedMirror];
      const offenses = findRealpathReferences(files, allowlist);
      expect(offenses.some((o) => o.file === offenderPath)).toBe(true);
      expect(offenses.every((o) => o.file !== allowlistedMirrorPath)).toBe(true);
    });
  });
});
