/**
 * FIT-40 negative-path companion: proves the fail-closed collectors in
 * `test/support/conformance-validators.ts` actually FIRE on a broken corpus, not just stay
 * silent on the real, currently-well-formed `conformance/` tree.
 *
 * Closes the Strict TDD triangulation gap from `verify-in-loop-1.md`: every `violations`
 * collector in fit-40 was previously exercised against exactly one real-world sample (the
 * live corpus), which can never trigger the failure branch it exists to catch. This file
 * builds synthetic broken fixtures — either in-memory `LoadedFixture` objects (for checks
 * that only inspect manifest fields) or real temp-dir trees via `mkdtempSync` (for checks
 * that resolve paths on disk) — and asserts the corresponding `violations` array is
 * non-empty and names the offending id/case. Proves REQ-CSC-01.1 and REQ-CSC-04.1
 * (explicit signed-spec failure scenarios) plus the sibling REQ-CCR-02/05.2/07.1 and
 * REQ-CSC-02/03 branches identified in the verify report.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCorpus, listSubdirectories, type Case, type LoadedFixture, type Manifest } from "../support/conformance-fixture-loader.ts";
import {
  ruleFail,
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

function tempCorpusRoot(): string {
  return mkdtempSync(join(tmpdir(), "fit40-negative-"));
}

function baseCase(overrides: Partial<Case> = {}): Case {
  return {
    name: "positive",
    seed: null,
    expected: "empty",
    outcome: { exitCode: 0, emitRejectionCode: null, failedIndex: null, writtenPaths: [] },
    transcript: { callbacks: [], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true },
    ...overrides,
  };
}

function baseManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    id: "synthetic-fixture",
    wireSpecVersion: 1,
    class: "handshake",
    factory: { module: "factory.ts", export: null },
    input: {},
    lowering: { mode: "none" },
    cases: [baseCase()],
    ...overrides,
  };
}

/** A fixture entirely in-memory — safe for checks that never touch disk. */
function baseFixture(fixtureOverrides: Partial<Pick<LoadedFixture, "id" | "dir">> = {}, manifestOverrides: Partial<Manifest> = {}): LoadedFixture {
  const manifest = baseManifest(manifestOverrides);
  return { id: manifest.id, dir: "/nonexistent/synthetic", manifest, ...fixtureOverrides };
}

describe("FIT-40 negative paths — fail-closed branches proven against synthetic broken fixtures", () => {
  describe("REQ-CSC-01.1 / REQ-CCR-02(a) — listed-but-missing manifest", () => {
    it("fails, naming the offending id, when corpus.json lists an id with no manifest.json on disk", () => {
      const root = tempCorpusRoot();
      writeFileSync(join(root, "corpus.json"), JSON.stringify({ wireSpecVersion: 1, fixtures: ["ghost-fixture"] }));

      const loaded = loadCorpus(root);
      expect(loaded.missingManifestIds).toEqual(["ghost-fixture"]);

      const violations = checkMissingManifestIds(loaded.missingManifestIds);
      expect(violations).toEqual([ruleFail("ghost-fixture", null, "REQ-CCR-02(a)", "listed in corpus.json#fixtures but no manifest.json on disk")]);
    });
  });

  describe("REQ-CCR-02(b) — factory.ts without manifest.json", () => {
    it("fails when a directory has factory.ts but no manifest.json", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "orphan-factory");
      mkdirSync(dir);
      writeFileSync(join(dir, "factory.ts"), "export default {};");

      const violations = checkOrphanFactoryWithoutManifest(root, listSubdirectories(root));
      expect(violations).toEqual([ruleFail("orphan-factory", null, "REQ-CCR-02(b)", "has factory.ts but no manifest.json")]);
    });
  });

  describe("REQ-CCR-02(c) — manifest id / dirname mismatch", () => {
    it("fails when manifest.json#id differs from its directory name", () => {
      const fixture = baseFixture({ id: "actual-dir-name" }, { id: "different-id" });

      const violations = checkManifestIdMatchesDir([fixture]);
      expect(violations).toEqual([ruleFail("actual-dir-name", null, "REQ-CCR-02(c)", 'manifest id "different-id" !== dirname "actual-dir-name"')]);
    });
  });

  describe("REQ-CCR-05.2 — orphan directory", () => {
    it("fails when a directory exists but is not listed in corpus.json#fixtures", () => {
      const violations = checkOrphanDirectories(["registered", "orphan-dir"], ["registered"]);
      expect(violations).toEqual([
        ruleFail("orphan-dir", null, "REQ-CCR-05.2", "directory exists under conformance/ but is not listed in corpus.json#fixtures (orphan)"),
      ]);
    });
  });

  describe("REQ-CCR-07.1 — wireSpecVersion disagreement", () => {
    it("fails when a manifest's wireSpecVersion disagrees with corpus.json's", () => {
      const fixture = baseFixture({}, { wireSpecVersion: 2 });

      const violations = checkWireSpecVersionAgreement([fixture], 1);
      expect(violations).toEqual([
        ruleFail(fixture.id, null, "REQ-CCR-07.1", "manifest wireSpecVersion 2 !== corpus.json wireSpecVersion 1"),
      ]);
    });
  });

  describe("REQ-CSC-02.1 — dangling expected reference", () => {
    it("fails, naming the fixture and case, when a case's expected directory does not resolve on disk", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "dangling-ref");
      mkdirSync(dir);
      const c = baseCase({ name: "positive", expected: "expected" });
      const fixture: LoadedFixture = { id: "dangling-ref", dir, manifest: baseManifest({ id: "dangling-ref", cases: [c] }) };

      const violations = checkSeedExpectedResolution([fixture]);
      expect(violations).toEqual([
        ruleFail("dangling-ref", "positive", "REQ-CSC-02.1", 'expected references "expected" — no such directory under dangling-ref/'),
      ]);
    });
  });

  describe("REQ-CSC-02.2 — missing factory.ts", () => {
    it("fails, naming the fixture and unresolved path, when factory.module does not resolve on disk", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "missing-factory");
      mkdirSync(dir);
      const fixture: LoadedFixture = { id: "missing-factory", dir, manifest: baseManifest({ id: "missing-factory" }) };

      const violations = checkFactoryModuleResolution([fixture]);
      expect(violations).toEqual([
        ruleFail("missing-factory", null, "REQ-CSC-02.2", 'factory.module "factory.ts" does not resolve on disk'),
      ]);
    });
  });

  describe("REQ-CSC-02.1 — schematic lowering missing schema.json / empty files/", () => {
    it("fails on both sub-checks when lowering.mode is schematic but schema.json and files/ are absent", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "broken-schematic");
      mkdirSync(dir);
      const fixture: LoadedFixture = {
        id: "broken-schematic",
        dir,
        manifest: baseManifest({ id: "broken-schematic", lowering: { mode: "schematic" } }),
      };

      const violations = checkSchematicLoweringFiles([fixture]);
      expect(violations).toEqual([
        ruleFail("broken-schematic", null, "REQ-CSC-02.1", 'lowering.mode is "schematic" but schematic/schema.json is missing'),
        ruleFail("broken-schematic", null, "REQ-CSC-02.1", 'lowering.mode is "schematic" but schematic/files/ has no entries'),
      ]);
    });
  });

  describe("REQ-CSC-02.3 — missing collection.json marker", () => {
    it("fails, naming the missing marker, when conformance/collection.json does not exist", () => {
      const root = tempCorpusRoot();

      const violations = checkCollectionJsonMarker(root);
      expect(violations).toEqual([
        ruleFail("collection.json", null, "REQ-CSC-02.3", `missing package-anchor marker at ${root}/collection.json`),
      ]);
    });
  });

  describe("REQ-CSC-03.1 — empty cases array", () => {
    it("fails when a manifest's cases[] is empty", () => {
      const fixture = baseFixture({}, { cases: [] });

      const violations = checkNonEmptyCases([fixture]);
      expect(violations).toEqual([ruleFail(fixture.id, null, "REQ-CSC-03.1", "cases[] is empty or not an array")]);
    });
  });

  describe("REQ-CSC-03 — invalid class", () => {
    it("fails when class is not one of handshake|wire-mutation|composition", () => {
      const fixture = baseFixture({}, { class: "bogus-class" as Manifest["class"] });

      const violations = checkValidClass([fixture]);
      expect(violations).toEqual([
        ruleFail(fixture.id, null, "REQ-CSC-03", 'class "bogus-class" is not one of handshake|wire-mutation|composition'),
      ]);
    });
  });

  describe("REQ-CSC-03.2 — malformed transcript", () => {
    it("fails, naming the fixture and case, when a case has no transcript key at all", () => {
      const c = baseCase();
      delete (c as Partial<Case>).transcript;
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkTranscriptShape([fixture]);
      expect(violations).toEqual([ruleFail(fixture.id, c.name, "REQ-CSC-03.2", "missing transcript object")]);
    });

    it("fails when transcript.callbacks contains a value outside the 4 reverse-callback methods", () => {
      const c = baseCase({
        transcript: { callbacks: ["not-a-real-method"] as unknown as Case["transcript"]["callbacks"], singleCommit: true, forbidDiscard: true, emitBeforeCommit: true },
      });
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkTranscriptShape([fixture]);
      expect(violations).toEqual([
        ruleFail(fixture.id, c.name, "REQ-CSC-03.2", "transcript.callbacks is not an array of the 4 reverse-callback methods"),
      ]);
    });
  });

  describe("REQ-CSC-03 — malformed outcome", () => {
    it("fails when outcome.exitCode is not an integer", () => {
      const c = baseCase({ outcome: { exitCode: "0" as unknown as number, emitRejectionCode: null, failedIndex: null, writtenPaths: [] } });
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkOutcomeShape([fixture]);
      expect(violations).toEqual([ruleFail(fixture.id, c.name, "REQ-CSC-03", "outcome.exitCode is not an integer")]);
    });
  });

  describe("REQ-CSC-04.1 / REQ-CFX-04 — outcome triple internal consistency", () => {
    it("fails when exitCode is 2 and emitRejectionCode is null", () => {
      const c = baseCase({ outcome: { exitCode: 2, emitRejectionCode: null, failedIndex: null, writtenPaths: [] } });
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkOutcomeTripleConsistency([fixture]);
      expect(violations).toEqual([
        ruleFail(fixture.id, c.name, "REQ-CFX-04.1", "exitCode 2 and emitRejectionCode null disagree (2 iff non-null)"),
      ]);
    });

    it("fails when a directive-level emitRejectionCode carries a non-integer failedIndex", () => {
      const c = baseCase({ outcome: { exitCode: 2, emitRejectionCode: "not-found", failedIndex: null, writtenPaths: [] } });
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkOutcomeTripleConsistency([fixture]);
      expect(violations).toEqual([
        ruleFail(fixture.id, c.name, "REQ-CFX-04", 'emitRejectionCode "not-found" is directive-level but failedIndex is not an integer'),
      ]);
    });

    it("fails when a batch-level emitRejectionCode carries a non-null failedIndex", () => {
      const c = baseCase({ outcome: { exitCode: 2, emitRejectionCode: "unrepresentable", failedIndex: 3, writtenPaths: [] } });
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkOutcomeTripleConsistency([fixture]);
      expect(violations).toEqual([
        ruleFail(fixture.id, c.name, "REQ-CFX-04.2", 'emitRejectionCode "unrepresentable" is batch-level but failedIndex is not null'),
      ]);
    });
  });

  describe("REQ-CFX-10.1 — zero-effect requires a non-empty seed", () => {
    it("fails when expected is zero-effect but seed is null", () => {
      const c = baseCase({ expected: "zero-effect", seed: null });
      const fixture = baseFixture({}, { cases: [c] });

      const violations = checkZeroEffectSeed([fixture]);
      expect(violations).toEqual([
        ruleFail(fixture.id, c.name, "REQ-CFX-10", 'expected:"zero-effect" requires a non-empty pre-run seed; seed is null'),
      ]);
    });
  });

  describe("REQ-CSC-02.2 — case-level factory.export names a real export (judgment-day JD-3)", () => {
    it("fails, naming the fixture and case, when a case's factory.export is a typo'd/nonexistent named export", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "typo-export");
      mkdirSync(dir);
      writeFileSync(join(dir, "factory.ts"), "export default function main() {}\nexport function realExport() {}\n");
      const c = baseCase({ name: "twin", factory: { module: "factory.ts", export: "typoedExport" } });
      const fixture: LoadedFixture = { id: "typo-export", dir, manifest: baseManifest({ id: "typo-export", cases: [c] }) };

      const violations = checkFactoryExportResolution([fixture]);
      expect(violations).toEqual([
        ruleFail("typo-export", "twin", "REQ-CSC-02.2", 'factory.export "typoedExport" is not a named export of module "factory.ts"'),
      ]);
    });

    it("fails when a fixture-level factory.export is null but the module has no default export", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "no-default");
      mkdirSync(dir);
      writeFileSync(join(dir, "factory.ts"), "export function namedOnly() {}\n");
      const fixture: LoadedFixture = { id: "no-default", dir, manifest: baseManifest({ id: "no-default" }) };

      const violations = checkFactoryExportResolution([fixture]);
      expect(violations).toEqual([
        ruleFail("no-default", null, "REQ-CSC-02.2", 'factory.export is null but module "factory.ts" declares no default export'),
      ]);
    });

    it("passes async functions and export const forms (regex robustness)", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "async-and-const-exports");
      mkdirSync(dir);
      writeFileSync(
        join(dir, "factory.ts"),
        "export default async function main() {}\nexport const namedConst = () => {};\nexport async function namedAsync() {}\n"
      );
      const withConst = baseCase({ name: "const-twin", factory: { module: "factory.ts", export: "namedConst" } });
      const withAsync = baseCase({ name: "async-twin", factory: { module: "factory.ts", export: "namedAsync" } });
      const fixture: LoadedFixture = {
        id: "async-and-const-exports",
        dir,
        manifest: baseManifest({ id: "async-and-const-exports", cases: [withConst, withAsync] }),
      };

      expect(checkFactoryExportResolution([fixture])).toEqual([]);
    });
  });

  describe("REQ-CFX-02.1 — create() quarantine within a single file (judgment-day JD-2)", () => {
    it("fails when a second create() is authored in the sanctioned file's default export, outside the quarantined named-export block", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "smuggled-create");
      mkdirSync(dir);
      writeFileSync(
        join(dir, "factory.ts"),
        [
          'import { create } from "../../src/index.ts";',
          "export default function main() {",
          '  create("smuggled.txt", { template: "x", options: {} });',
          "}",
          "export function probeExport() {",
          '  create("probe.txt", { template: "x", options: {} });',
          "}",
        ].join("\n")
      );
      const c = baseCase({ name: "twin", factory: { module: "factory.ts", export: "probeExport" } });
      const fixture: LoadedFixture = { id: "smuggled-create", dir, manifest: baseManifest({ id: "smuggled-create", cases: [c] }) };

      const violations = checkCreateQuarantine([fixture]);
      expect(violations).toEqual([
        ruleFail(
          "smuggled-create",
          null,
          "REQ-CFX-02.1",
          "factory file \"factory.ts\" authors create() outside its quarantined named-export block(s) (2 total call(s), only 1 inside quarantine)"
        ),
      ]);
    });

    it("fails, naming the file, when create() is authored but no case references any quarantining named export", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "unquarantined-create");
      mkdirSync(dir);
      writeFileSync(
        join(dir, "factory.ts"),
        ['import { create } from "../../src/index.ts";', "export default function main() {", '  create("x.txt", { template: "x", options: {} });', "}"].join(
          "\n"
        )
      );
      const fixture: LoadedFixture = { id: "unquarantined-create", dir, manifest: baseManifest({ id: "unquarantined-create" }) };

      const violations = checkCreateQuarantine([fixture]);
      expect(violations).toEqual([
        ruleFail(
          "unquarantined-create",
          null,
          "REQ-CFX-02.1",
          "factory file \"factory.ts\" authors create() but no quarantined named-export block was found to contain it"
        ),
      ]);
    });

    it("passes when the file's only create() call lies fully inside the quarantined named-export block", () => {
      const root = tempCorpusRoot();
      const dir = join(root, "clean-quarantine");
      mkdirSync(dir);
      writeFileSync(
        join(dir, "factory.ts"),
        [
          'import { replaceContent, create } from "../../src/index.ts";',
          "export default function main() {",
          '  replaceContent("existing.txt", "composed");',
          "}",
          "export function probeExport() {",
          '  create("probe.txt", { template: "x", options: {} });',
          "}",
        ].join("\n")
      );
      const c = baseCase({ name: "twin", factory: { module: "factory.ts", export: "probeExport" } });
      const fixture: LoadedFixture = { id: "clean-quarantine", dir, manifest: baseManifest({ id: "clean-quarantine", cases: [c] }) };

      expect(checkCreateQuarantine([fixture])).toEqual([]);
    });
  });
});
