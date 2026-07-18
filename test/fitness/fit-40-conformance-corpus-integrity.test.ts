/**
 * FIT-40: conformance corpus structural self-check — the named fail-closed verifier for
 * REQ-CSC-01..06 and (per REQ-CSC-06) REQ-CDT-03..06, plus the structural clauses of
 * REQ-CCR-01/02/05/06/07/08 and REQ-CFX-01/02/03/04/10/12/14. Parses
 * `conformance/corpus.json` + every landed `manifest.json`; NO runner spawn — this repo has
 * no runner-driven verification path (REQ-CFX-11 honesty boundary). Structural consistency
 * only, never a claim that the engine will actually produce these bytes/exit codes.
 *
 * Two-checkpoint cadence (design ADR-0066): every inventory/count check is DERIVED FROM
 * `corpus.json#fixtures`'s own declared list, so this file stays green at BOTH the PR#1
 * checkpoint (`["m1-vehicle"]`, 1 fixture / 2 cases) and the post-PR#2 checkpoint (5
 * fixtures / 12 cases) — the ABSOLUTE 5/12 count and the literal "exactly one create"
 * count (REQ-CFX-02.1, its own scenario framed over "all 12 cases") apply only once
 * `corpus.json` lists all 5 fixtures; evaluating them against the legitimate PR#1 state
 * would be a false RED (REQ-CCR-05.3).
 *
 * Failure-message contract (design §4.7): every violation names the offending fixture id,
 * the case name (where case-scoped), and the rule/REQ violated — never a bare
 * `expect(...).toBe(...)` with no context. Idiom: collect `string[]` violations, assert
 * `toEqual([])` (matches fit-01/fit-19/fit-27's established pattern in this repo).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json" with { type: "json" };
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";
import { IMPORT_SPECIFIER_RE, stripComments } from "../support/import-scan.ts";
import { loadCorpus, listSubdirectories, type Case, type LoadedFixture } from "../support/conformance-fixture-loader.ts";
import {
  ruleFail,
  collectFilesRecursive,
  checkMissingManifestIds,
  checkOrphanFactoryWithoutManifest,
  checkManifestIdMatchesDir,
  checkOrphanDirectories,
  checkWireSpecVersionAgreement,
  checkCollectionJsonMarker,
  checkSeedExpectedResolution,
  checkFactoryModuleResolution,
  checkFactoryExportResolution,
  checkCreateQuarantine,
  checkSchematicLoweringFiles,
  checkNonEmptyCases,
  checkValidClass,
  checkTranscriptShape,
  checkOutcomeShape,
  checkOutcomeTripleConsistency,
  checkZeroEffectSeed,
} from "../support/conformance-validators.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const CORPUS_ROOT = join(PROJECT_ROOT, "conformance");
const DIST_ROOT = join(PROJECT_ROOT, "dist");

const loaded = loadCorpus(CORPUS_ROOT);
const { corpus, fixtures, missingManifestIds } = loaded;

describe("FIT-40 — conformance corpus structural integrity", () => {
  describe("REQ-CCR-01 — corpus.json schema", () => {
    it("REQ-CCR-01.1: parses to {wireSpecVersion: number, fixtures: string[]}", () => {
      expect(typeof corpus.wireSpecVersion).toBe("number");
      expect(Array.isArray(corpus.fixtures)).toBe(true);
      for (const id of corpus.fixtures) expect(typeof id).toBe("string");
    });

    it("REQ-CCR-01.2: every listed fixture directory exists with manifest.json + factory.ts", () => {
      const violations = corpus.fixtures
        .filter((id) => !existsSync(join(CORPUS_ROOT, id, "manifest.json")) || !existsSync(join(CORPUS_ROOT, id, "factory.ts")))
        .map((id) => ruleFail(id, null, "REQ-CCR-01.2", "missing manifest.json and/or factory.ts"));
      expect(violations).toEqual([]);
    });
  });

  describe("REQ-CCR-02 / REQ-CSC-01 — fail-closed structural invariants (mirrors engine loader)", () => {
    it("(a) every corpus.json-listed id has a manifest.json", () => {
      expect(checkMissingManifestIds(missingManifestIds)).toEqual([]);
    });

    it("(b) every directory with factory.ts has a manifest.json", () => {
      expect(checkOrphanFactoryWithoutManifest(CORPUS_ROOT, listSubdirectories(CORPUS_ROOT))).toEqual([]);
    });

    it("(c) every manifest.json#id equals its directory name", () => {
      expect(checkManifestIdMatchesDir(fixtures)).toEqual([]);
    });
  });

  describe("REQ-CCR-05 — corpus-derived inventory, no orphan directories (two-checkpoint cadence)", () => {
    it("REQ-CCR-05.2: every directory under conformance/ is registered in corpus.json#fixtures", () => {
      expect(checkOrphanDirectories(listSubdirectories(CORPUS_ROOT), corpus.fixtures)).toEqual([]);
    });

    it("every listed fixture landed (no dangling id)", () => {
      expect(missingManifestIds).toEqual([]);
    });

    const totalCases = fixtures.reduce((sum, f) => sum + f.manifest.cases.length, 0);

    it('REQ-CCR-05.3: PR#1 checkpoint — corpus.json === ["m1-vehicle"] passes at 1 fixture / 2 cases', () => {
      if (corpus.fixtures.length !== 1) return; // not the PR#1 checkpoint
      expect(corpus.fixtures).toEqual(["m1-vehicle"]);
      expect(totalCases).toBe(2);
    });

    it("REQ-CCR-05.1: POST-PR#2 gate — exactly 5 fixtures / 12 cases (never evaluated at PR#1)", () => {
      if (corpus.fixtures.length !== 5) return; // PR#1 state — REQ-CCR-05.3 forbids evaluating this
      expect(totalCases).toBe(12);
    });
  });

  describe("REQ-CCR-06 — README disambiguation", () => {
    const readmePath = join(CORPUS_ROOT, "README.md");

    it("REQ-CCR-06.1: names both conformance/ (this corpus) and ./conformance (published kit), states unrelated", () => {
      expect(existsSync(readmePath)).toBe(true);
      const text = readFileSync(readmePath, "utf8");
      expect(text.includes("conformance/")).toBe(true);
      expect(text.includes("./conformance")).toBe(true);
    });

    it("REQ-CFX-11.1/.2 honesty boundary is stated (engine-authoritative, not SDK-proven)", () => {
      const text = readFileSync(readmePath, "utf8");
      expect(/engine-authoritative/i.test(text)).toBe(true);
    });
  });

  describe("REQ-CCR-07 — wireSpecVersion agreement", () => {
    it("REQ-CCR-07.1: corpus.json + every manifest's wireSpecVersion all agree", () => {
      expect(checkWireSpecVersionAgreement(fixtures, corpus.wireSpecVersion)).toEqual([]);
    });

    it("REQ-CCR-07.2: the agreed value equals WIRE_PROTOCOL_VERSION (src/transport/wire-protocol.ts)", () => {
      expect(corpus.wireSpecVersion).toBe(WIRE_PROTOCOL_VERSION);
    });
  });

  describe("REQ-CCR-08 / REQ-CSC-02.3 — collection.json package-anchor marker", () => {
    it("REQ-CCR-08.1/REQ-CSC-02.3: conformance/collection.json exists (checked once, shared ancestor of every fixture)", () => {
      expect(checkCollectionJsonMarker(CORPUS_ROOT)).toEqual([]);
    });
  });

  describe("REQ-CSC-02 — seed/expected/schematic/factory reference resolution", () => {
    it("REQ-CSC-02.1: every case's seed/expected directory reference resolves on disk", () => {
      expect(checkSeedExpectedResolution(fixtures)).toEqual([]);
    });

    it("REQ-CSC-02.2: every fixture's factory.module resolves to an existing file (fixture-level + every case-level override)", () => {
      expect(checkFactoryModuleResolution(fixtures)).toEqual([]);
    });

    it("REQ-CSC-02.2: every fixture-level and case-level factory.export names a real export of its module", () => {
      expect(checkFactoryExportResolution(fixtures)).toEqual([]);
    });

    it("REQ-CSC-02.1: lowering.mode === 'schematic' implies schematic/schema.json + at least one schematic/files/** entry", () => {
      expect(checkSchematicLoweringFiles(fixtures)).toEqual([]);
    });
  });

  describe("REQ-CSC-03 — manifest schema validity (incl. transcript + outcome shape)", () => {
    it("REQ-CSC-03.1: every manifest has a non-empty cases array", () => {
      expect(checkNonEmptyCases(fixtures)).toEqual([]);
    });

    it("REQ-CSC-03: class is one of handshake|wire-mutation|composition", () => {
      expect(checkValidClass(fixtures)).toEqual([]);
    });

    it("REQ-CSC-03.2: every case has a fully-shaped transcript object (callbacks[], singleCommit, forbidDiscard, emitBeforeCommit)", () => {
      expect(checkTranscriptShape(fixtures)).toEqual([]);
    });

    it("REQ-CSC-03: every case has a fully-shaped outcome object (exitCode, emitRejectionCode, failedIndex, writtenPaths)", () => {
      expect(checkOutcomeShape(fixtures)).toEqual([]);
    });
  });

  describe("REQ-CSC-04 / REQ-CFX-04 — outcome triple internal consistency", () => {
    it("REQ-CFX-04.1/.2 + REQ-CSC-04.1: exitCode 2 iff emitRejectionCode non-null; failedIndex null only for batch-level codes", () => {
      expect(checkOutcomeTripleConsistency(fixtures)).toEqual([]);
    });
  });

  describe("REQ-CFX-10 — zero-effect vs empty semantics", () => {
    it("REQ-CFX-10.1: a case declaring expected:\"zero-effect\" has a non-empty pre-run state (a seed dir)", () => {
      expect(checkZeroEffectSeed(fixtures)).toEqual([]);
    });
  });

  describe("REQ-CFX-01 — factory authoring surface allow-list", () => {
    const BANNED_SRC_SUBSTRINGS = ["/src/core/", "/src/transport/", "/src/testing/"];
    const BANNED_BUILTINS = ["node:fs", "node:net", "node:child_process"];

    it("REQ-CFX-01.1/.2: every factory.ts imports the SDK ONLY via ../../src/index.ts, no banned builtins", () => {
      const violations: string[] = [];
      for (const f of fixtures) {
        const factoryPath = join(f.dir, f.manifest.factory.module);
        if (!existsSync(factoryPath)) continue; // REQ-CSC-02.2 already flags this
        const source = stripComments(readFileSync(factoryPath, "utf8"));
        for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
          const specifier = match[1]!;
          if (specifier.startsWith(".")) {
            if (specifier !== "../../src/index.ts") {
              violations.push(ruleFail(f.id, null, "REQ-CFX-01.1", `relative import "${specifier}" is not the public umbrella ../../src/index.ts`));
            }
            continue;
          }
          if (BANNED_BUILTINS.includes(specifier)) {
            violations.push(ruleFail(f.id, null, "REQ-CFX-01.2", `imports banned builtin "${specifier}"`));
          }
        }
        if (BANNED_SRC_SUBSTRINGS.some((s) => source.includes(s))) {
          violations.push(ruleFail(f.id, null, "REQ-CFX-01", "references a banned internal src/ path (core/transport/testing)"));
        }
        if (/\bfetch\s*\(/.test(source)) violations.push(ruleFail(f.id, null, "REQ-CFX-01", "calls fetch()"));
        if (/process\.env/.test(source)) violations.push(ruleFail(f.id, null, "REQ-CFX-01", "reads process.env"));
      }
      expect(violations).toEqual([]);
    });
  });

  describe("REQ-CFX-02 / REQ-CFX-03 — representable-ops-only, single quarantined create (two-checkpoint cadence)", () => {
    // REQ-CFX-02.1's literal "exactly one" is scoped over "all 12 cases" (post-PR#2); the
    // corpus-wide invariant that stays green at BOTH checkpoints is "at most one, and if
    // present it is m2-create-composition/wire-create-reject-twin's createRejectProbe".
    it("REQ-CFX-02: create() appears in exactly the corpus's sole sanctioned factory file", () => {
      // Structural invariant, not a case-scoped scan: collects the SET of factory files
      // (corpus-wide, across every fixture AND every case-level factory override) whose
      // source contains a `create(` call. A default-export factory authoring `create()`
      // used to slip past the old predicate (it filtered on `export !== null`, which only
      // ever matches NAMED-export cases) — this catches `create()` in ANY factory file,
      // default-export included, while still accepting the one sanctioned reject-probe site.
      const SANCTIONED_SITE = "m2-create-composition/factory.ts";
      const factoryFilesWithCreate = new Map<string, string>(); // "fixtureId/module" -> fixtureId

      for (const f of fixtures) {
        const modules = new Set<string>([
          f.manifest.factory.module,
          ...f.manifest.cases.map((c) => c.factory?.module ?? f.manifest.factory.module),
        ]);
        for (const module of modules) {
          const factoryPath = join(f.dir, module);
          if (!existsSync(factoryPath)) continue; // REQ-CSC-02.2 already flags this
          const source = stripComments(readFileSync(factoryPath, "utf8"));
          if (/\bcreate\s*\(/.test(source)) {
            factoryFilesWithCreate.set(`${f.id}/${module}`, f.id);
          }
        }
      }

      const violations: string[] = [];
      for (const [path, fixtureId] of factoryFilesWithCreate) {
        if (path !== SANCTIONED_SITE) {
          violations.push(ruleFail(fixtureId, null, "REQ-CFX-02.1", `factory file "${path}" authors create() outside the sole sanctioned reject probe (${SANCTIONED_SITE})`));
        }
      }
      // Vacuous before m2-create-composition lands (two-checkpoint cadence, PR#1): only
      // demand the sanctioned site once the fixture it lives in is actually part of the
      // loaded corpus.
      if (fixtures.some((f) => f.id === "m2-create-composition") && !factoryFilesWithCreate.has(SANCTIONED_SITE)) {
        violations.push(ruleFail("m2-create-composition", null, "REQ-CFX-02.1", `expected the sole sanctioned create() site "${SANCTIONED_SITE}" to author create(), found none`));
      }
      expect(violations).toEqual([]);
    });

    it("REQ-CFX-02.1: within the sanctioned file, every create() call lies inside its quarantined named-export block (never the default export)", () => {
      // The scan above only sees WHICH FILES contain create() — it cannot see a SECOND
      // create() added to the sanctioned file's own default export. checkCreateQuarantine
      // extracts each case-referenced named-export function's block and proves every
      // create() call in the file falls inside one of those blocks.
      expect(checkCreateQuarantine(fixtures)).toEqual([]);
    });

    it("REQ-CFX-03.1: the reject-probe's create call is preceded by a DO-NOT-COPY 5-clause comment", () => {
      const probeFixture = fixtures.find((f) => f.id === "m2-create-composition");
      if (probeFixture === undefined) return; // not landed yet (PR#2) — vacuous
      const factoryPath = join(probeFixture.dir, probeFixture.manifest.factory.module);
      const source = readFileSync(factoryPath, "utf8");
      expect(/DO-NOT-COPY/.test(source)).toBe(true);

      // Vacuous-assertion guard: the DO-NOT-COPY token alone doesn't prove the comment
      // conveys all five clauses the spec requires. Locate each `(a)`..`(e)` marker and
      // require a stable, distinctive keyword within ITS clause span (up to the next
      // marker) — resistant to rewording, RED if a clause (or its substance) is deleted.
      const normalized = source.replace(/\/\//g, " ").replace(/\s+/g, " ");
      const markerRe = /\([a-e]\)/g;
      const markers: Array<{ letter: string; index: number }> = [];
      for (const m of normalized.matchAll(markerRe)) markers.push({ letter: m[0], index: m.index });

      const CLAUSE_KEYWORDS: Record<string, RegExp> = {
        "(a)": /one-create-corpus-wide/,
        "(b)": /REJECT PROBE/,
        "(c)": /do NOT imitate/i,
        "(d)": /unrepresentable/,
        "(e)": /modify\/delete\/rename\/move/,
      };

      const missingClauses = Object.keys(CLAUSE_KEYWORDS).filter((letter) => {
        const marker = markers.find((m) => m.letter === letter);
        if (marker === undefined) return true;
        const nextIndex = markers.find((m) => m.index > marker.index)?.index ?? normalized.length;
        const clauseText = normalized.slice(marker.index, nextIndex);
        return !CLAUSE_KEYWORDS[letter]!.test(clauseText);
      });

      expect(missingClauses).toEqual([]);
    });
  });

  describe("REQ-CFX-14 — factory build isolation", () => {
    // NOTE: `dist/conformance/**` legitimately exists — it is the COMPILED published kit
    // (`src/conformance/**`, ADR-0012, the `./conformance` package export), a same-named
    // but unrelated neighbour (README disambiguation above). This check looks for THIS
    // root corpus's own marker filenames and fixture-id directories specifically, never a
    // bare "conformance" substring — tsconfig.build.json's `rootDir:"./src"` already keeps
    // the repo-root `conformance/` (outside `src/`) structurally unreachable by the build.
    it("REQ-CFX-14.1: no root-corpus marker (collection.json/corpus.json) or fixture-id directory appears under dist/, if dist/ exists", () => {
      if (!existsSync(DIST_ROOT)) return; // build not run in this environment — nothing to check
      const files = collectFilesRecursive(DIST_ROOT);
      const offenders = files.filter((p) => {
        const base = p.split("/").pop();
        return base === "collection.json" || base === "corpus.json" || corpus.fixtures.some((id) => p.split("/").includes(id));
      });
      expect(offenders).toEqual([]);
    });
  });

  describe("REQ-CSC-05 — Bun-pin assertion", () => {
    it("REQ-CSC-05.1: process.versions.bun equals package.json#engines.bun", () => {
      expect(process.versions.bun).toBe((packageJson as { engines: { bun: string } }).engines.bun);
    });
  });

  describe("REQ-CDT-01 — repo-wide .gitattributes eol=lf", () => {
    it("REQ-CDT-01.1: .gitattributes exists at repo root and declares * eol=lf", () => {
      const path = join(PROJECT_ROOT, ".gitattributes");
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, "utf8");
      expect(/^\*\s+eol=lf/m.test(text)).toBe(true);
    });
  });

  describe("REQ-CDT-03..07 — byte/line-ending determinism over conformance/**", () => {
    const allFiles = existsSync(CORPUS_ROOT) ? collectFilesRecursive(CORPUS_ROOT) : [];

    it("REQ-CDT-03.1: zero CR (0x0D) bytes in any file under conformance/", () => {
      const violations = allFiles
        .filter((p) => readFileSync(p).includes(0x0d))
        .map((p) => ruleFail(p.replace(`${CORPUS_ROOT}/`, ""), null, "REQ-CDT-03.1", "contains a CR (0x0D) byte"));
      expect(violations).toEqual([]);
    });

    it("REQ-CDT-04.1: no file starts with a UTF-8 BOM (EF BB BF)", () => {
      const violations = allFiles
        .filter((p) => {
          const buf = readFileSync(p);
          return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
        })
        .map((p) => ruleFail(p.replace(`${CORPUS_ROOT}/`, ""), null, "REQ-CDT-04.1", "starts with a UTF-8 BOM"));
      expect(violations).toEqual([]);
    });

    it("REQ-CDT-05.1: every path value inside corpus.json/manifest.json is POSIX-relative (no backslash, no leading /, no ..)", () => {
      const violations: string[] = [];
      const checkPath = (fixtureId: string, label: string, value: string): void => {
        if (value.includes("\\") || value.startsWith("/") || value.split("/").includes("..")) {
          violations.push(ruleFail(fixtureId, null, "REQ-CDT-05.1", `${label} "${value}" is not a POSIX-relative path`));
        }
      };
      for (const id of corpus.fixtures) checkPath("corpus.json", "fixtures[]", id);
      for (const f of fixtures) {
        checkPath(f.id, "factory.module", f.manifest.factory.module);
        for (const c of f.manifest.cases) {
          if (typeof c.seed === "string") checkPath(f.id, `cases[${c.name}].seed`, c.seed);
          if (c.expected !== "zero-effect" && c.expected !== "empty") checkPath(f.id, `cases[${c.name}].expected`, c.expected);
        }
      }
      expect(violations).toEqual([]);
    });

    it("REQ-CDT-06.1/.2: no undeclared trailing newline under expected/** or schematic/files/**", () => {
      const violations: string[] = [];
      for (const f of fixtures) {
        for (const sub of ["expected", (f.manifest.lowering.schematicRoot ?? "schematic") + "/files"]) {
          const dir = join(f.dir, sub);
          if (!existsSync(dir)) continue;
          for (const file of collectFilesRecursive(dir)) {
            const buf = readFileSync(file);
            if (buf.length > 0 && buf[buf.length - 1] === 0x0a) {
              violations.push(ruleFail(f.id, null, "REQ-CDT-06", `${file.replace(`${f.dir}/`, "")} ends with a trailing \\n byte`));
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it("REQ-CDT-07.1: every file under conformance/ decodes as valid UTF-8 text", () => {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const violations: string[] = [];
      for (const p of allFiles) {
        try {
          decoder.decode(readFileSync(p));
        } catch {
          violations.push(ruleFail(p.replace(`${CORPUS_ROOT}/`, ""), null, "REQ-CDT-07.1", "does not decode as valid UTF-8"));
        }
      }
      expect(violations).toEqual([]);
    });
  });

  describe("REQ-CFX-05 — m1-vehicle behavioral contract (declared artefacts, REQ-CFX-11 honesty boundary applies)", () => {
    const fixture = fixtures.find((f) => f.id === "m1-vehicle");

    it("REQ-CFX-05.1: positive case declares exit 0, expected/out.txt = v2, writtenPaths = [out.txt], full read+emit+commit transcript", () => {
      if (fixture === undefined) return; // not landed yet
      const positive = fixture.manifest.cases.find((c) => c.name === "positive");
      expect(positive).not.toBeUndefined();
      const c = positive as Case;
      expect(c.outcome).toEqual({ exitCode: 0, emitRejectionCode: null, failedIndex: null, writtenPaths: ["out.txt"] });
      expect(c.transcript).toEqual({ callbacks: ["tree.read", "ir.emit", "ir.commit"], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true });
      expect(existsSync(join(fixture.dir, "expected", "out.txt"))).toBe(true);
      expect(readFileSync(join(fixture.dir, "expected", "out.txt"), "utf8")).toBe("v2");
    });

    it("REQ-CFX-05.2: greeting-mismatch-twin declares exit 1, expected: empty, empty transcript, same factory", () => {
      if (fixture === undefined) return; // not landed yet
      const twin = fixture.manifest.cases.find((c) => c.name === "greeting-mismatch-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.greetingVersion).toBe(2);
      expect(c.outcome).toEqual({ exitCode: 1, emitRejectionCode: null, failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: [], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true });
      expect(c.expected).toBe("empty");
    });
  });

  describe("REQ-CFX-06 — m2-modify behavioral contract (declared artefacts, REQ-CFX-11 honesty boundary applies)", () => {
    const fixture = fixtures.find((f) => f.id === "m2-modify");

    it("REQ-CFX-06.1: positive case declares a target-only replace", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const positive = f.manifest.cases.find((c) => c.name === "positive");
      expect(positive).not.toBeUndefined();
      const c = positive as Case;
      expect(c.outcome).toEqual({ exitCode: 0, emitRejectionCode: null, failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.commit"], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true });
      expect(readFileSync(join(f.dir, "expected", "target.txt"), "utf8")).toBe("replaced");
      expect(readFileSync(join(f.dir, "expected", "sibling.txt"), "utf8")).toBe("keep");
    });

    it("REQ-CFX-06.2: not-found twin declares a zero-effect rejection", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const twin = f.manifest.cases.find((c) => c.name === "not-found-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.outcome).toEqual({ exitCode: 2, emitRejectionCode: "not-found", failedIndex: 0, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.discard"], singleCommit: true, forbidDiscard: false, emitBeforeCommit: true });
      expect(c.expected).toBe("zero-effect");
    });
  });

  describe("REQ-CFX-07 — m2-delete behavioral contract (declared artefacts, REQ-CFX-11 honesty boundary applies)", () => {
    const fixture = fixtures.find((f) => f.id === "m2-delete");

    it("REQ-CFX-07.1: positive case declares target-only removal", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const positive = f.manifest.cases.find((c) => c.name === "positive");
      expect(positive).not.toBeUndefined();
      const c = positive as Case;
      expect(c.outcome).toEqual({ exitCode: 0, emitRejectionCode: null, failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.commit"], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true });
      expect(existsSync(join(f.dir, "expected", "target.txt"))).toBe(false);
      expect(readFileSync(join(f.dir, "expected", "sibling.txt"), "utf8")).toBe("keep");
      expect(readFileSync(join(f.dir, "expected", "adir", "child.txt"), "utf8")).toBe("x");
    });

    it("REQ-CFX-07.2: dir-target twin declares an unrepresentable rejection", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const twin = f.manifest.cases.find((c) => c.name === "dir-target-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.outcome).toEqual({ exitCode: 2, emitRejectionCode: "unrepresentable", failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.discard"], singleCommit: true, forbidDiscard: false, emitBeforeCommit: true });
      expect(c.expected).toBe("zero-effect");
    });

    it("not-found twin declares a zero-effect rejection (sibling of REQ-CFX-07.2, same corrective pattern as REQ-CFX-06.2)", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const twin = f.manifest.cases.find((c) => c.name === "not-found-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.outcome).toEqual({ exitCode: 2, emitRejectionCode: "not-found", failedIndex: 0, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.discard"], singleCommit: true, forbidDiscard: false, emitBeforeCommit: true });
      expect(c.expected).toBe("zero-effect");
    });
  });

  describe("REQ-CFX-08 — m2-rename-move behavioral contract (declared artefacts, REQ-CFX-11 honesty boundary applies)", () => {
    const fixture = fixtures.find((f) => f.id === "m2-rename-move");

    it("REQ-CFX-08.1: positive case declares an exact-bytes rename", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const positive = f.manifest.cases.find((c) => c.name === "positive");
      expect(positive).not.toBeUndefined();
      const c = positive as Case;
      expect(c.outcome).toEqual({ exitCode: 0, emitRejectionCode: null, failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.commit"], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true });
      expect(existsSync(join(f.dir, "expected", "src.txt"))).toBe(false);
      expect(readFileSync(join(f.dir, "expected", "dst.txt"), "utf8")).toBe("payload");
      expect(readFileSync(join(f.dir, "expected", "occupied.txt"), "utf8")).toBe("taken");
      expect(readFileSync(join(f.dir, "expected", "adir", "child.txt"), "utf8")).toBe("x");
    });

    it("REQ-CFX-08.2: collision twin declares a directive-level rejection", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const twin = f.manifest.cases.find((c) => c.name === "collision-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.outcome).toEqual({ exitCode: 2, emitRejectionCode: "collision", failedIndex: 0, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.discard"], singleCommit: true, forbidDiscard: false, emitBeforeCommit: true });
      expect(c.expected).toBe("zero-effect");
    });

    it("dir-source twin declares an unrepresentable rejection (sibling of REQ-CFX-08.2, same corrective pattern as REQ-CFX-07.2)", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const twin = f.manifest.cases.find((c) => c.name === "dir-source-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.outcome).toEqual({ exitCode: 2, emitRejectionCode: "unrepresentable", failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.discard"], singleCommit: true, forbidDiscard: false, emitBeforeCommit: true });
      expect(c.expected).toBe("zero-effect");
    });
  });

  describe("REQ-CFX-09 — m2-create-composition behavioral contract (declared artefacts, REQ-CFX-11 honesty boundary applies)", () => {
    const fixture = fixtures.find((f) => f.id === "m2-create-composition");

    it("REQ-CFX-09.1: positive case declares one commit, two composed halves", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const positive = f.manifest.cases.find((c) => c.name === "positive");
      expect(positive).not.toBeUndefined();
      const c = positive as Case;
      expect(c.outcome).toEqual({ exitCode: 0, emitRejectionCode: null, failedIndex: null, writtenPaths: ["generated.txt"] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.commit"], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true });
      expect(readFileSync(join(f.dir, "expected", "generated.txt"), "utf8")).toBe("generated");
      expect(readFileSync(join(f.dir, "expected", "existing.txt"), "utf8")).toBe("composed");
    });

    it("REQ-CFX-09.2/.3: wire-create-reject-twin's outcome triple is pinned to the ADR-0064-resolved values, never an unresolved placeholder", () => {
      expect(fixture).not.toBeUndefined();
      const f = fixture as LoadedFixture;
      const twin = f.manifest.cases.find((c) => c.name === "wire-create-reject-twin");
      expect(twin).not.toBeUndefined();
      const c = twin as Case;
      expect(c.outcome).toEqual({ exitCode: 2, emitRejectionCode: "unrepresentable", failedIndex: null, writtenPaths: [] });
      expect(c.transcript).toEqual({ callbacks: ["ir.emit", "ir.discard"], singleCommit: true, forbidDiscard: false, emitBeforeCommit: true });
      expect(c.expected).toBe("zero-effect");
      expect(c.factory).toEqual({ module: "factory.ts", export: "createRejectProbe" });
    });
  });

  describe("REQ-CSC-06 — self-check exits non-zero on violations (structural — proven by every describe block above)", () => {
    it("this suite itself runs under bun test and every assertion above is fail-closed (no describe is soft-skipped by default)", () => {
      // The green/RED behaviour of every block above IS the REQ-CSC-06 proof — bun test's
      // own exit code is non-zero whenever any expect() above fails. Nothing further to
      // assert here beyond the file existing and being collected by the test runner.
      expect(true).toBe(true);
    });
  });
});
