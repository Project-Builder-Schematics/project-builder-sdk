// Pure violation-collectors for the conformance/ corpus self-check (REQ-CSC-01..04, REQ-CCR
// series, REQ-CFX-04/10). Extracted from fit-40 so the same validation logic can run against
// BOTH the real conformance/ tree (fit-40) and synthetic broken fixtures (fit-40's negative
// suite) — a single source of truth for what counts as a violation, never duplicated.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { LoadedFixture, Transcript } from "./conformance-fixture-loader.ts";

const REVERSE_METHODS = ["tree.read", "ir.emit", "ir.commit", "ir.discard"];
const DIRECTIVE_LEVEL_CODES = ["not-found", "collision"];
const BATCH_LEVEL_CODES = ["unrepresentable"];

export function ruleFail(fixtureId: string, caseName: string | null, rule: string, detail: string): string {
  const scope = caseName === null ? `[${fixtureId}]` : `[${fixtureId}/${caseName}]`;
  return `${scope} ${rule}: ${detail}`;
}

/** Every regular file under `dir`, recursively. */
export function collectFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

/** REQ-CCR-02(a) / REQ-CSC-01.1: every corpus.json-listed id has a manifest.json. */
export function checkMissingManifestIds(missingManifestIds: string[]): string[] {
  return missingManifestIds.map((id) =>
    ruleFail(id, null, "REQ-CCR-02(a)", "listed in corpus.json#fixtures but no manifest.json on disk")
  );
}

/** REQ-CCR-02(b): every directory with factory.ts has a manifest.json. */
export function checkOrphanFactoryWithoutManifest(root: string, subdirs: string[]): string[] {
  const violations: string[] = [];
  for (const dirName of subdirs) {
    const dir = join(root, dirName);
    if (existsSync(join(dir, "factory.ts")) && !existsSync(join(dir, "manifest.json"))) {
      violations.push(ruleFail(dirName, null, "REQ-CCR-02(b)", "has factory.ts but no manifest.json"));
    }
  }
  return violations;
}

/** REQ-CCR-02(c): every manifest.json#id equals its directory name. */
export function checkManifestIdMatchesDir(fixtures: LoadedFixture[]): string[] {
  return fixtures
    .filter((f) => f.manifest.id !== f.id)
    .map((f) => ruleFail(f.id, null, "REQ-CCR-02(c)", `manifest id "${f.manifest.id}" !== dirname "${f.id}"`));
}

/** REQ-CCR-05.2: every directory under root is registered in corpus.json#fixtures (no orphans). */
export function checkOrphanDirectories(subdirs: string[], fixtureIds: string[]): string[] {
  return subdirs
    .filter((dirName) => !fixtureIds.includes(dirName))
    .map((dirName) =>
      ruleFail(dirName, null, "REQ-CCR-05.2", "directory exists under conformance/ but is not listed in corpus.json#fixtures (orphan)")
    );
}

/** REQ-CCR-07.1: corpus.json + every manifest's wireSpecVersion all agree. */
export function checkWireSpecVersionAgreement(fixtures: LoadedFixture[], corpusVersion: number): string[] {
  return fixtures
    .filter((f) => f.manifest.wireSpecVersion !== corpusVersion)
    .map((f) =>
      ruleFail(
        f.id,
        null,
        "REQ-CCR-07.1",
        `manifest wireSpecVersion ${f.manifest.wireSpecVersion} !== corpus.json wireSpecVersion ${corpusVersion}`
      )
    );
}

/** REQ-CSC-02.1: every case's seed/expected directory reference resolves on disk. */
export function checkSeedExpectedResolution(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    for (const c of f.manifest.cases) {
      for (const [field, value] of [
        ["seed", c.seed],
        ["expected", c.expected],
      ] as const) {
        if (value === null || value === "zero-effect" || value === "empty") continue;
        if (!existsSync(join(f.dir, value))) {
          violations.push(ruleFail(f.id, c.name, "REQ-CSC-02.1", `${field} references "${value}" — no such directory under ${f.id}/`));
        }
      }
    }
  }
  return violations;
}

/** REQ-CSC-02.2: every fixture's factory.module resolves to an existing file. */
export function checkFactoryModuleResolution(fixtures: LoadedFixture[]): string[] {
  return fixtures
    .filter((f) => !existsSync(join(f.dir, f.manifest.factory.module)))
    .map((f) => ruleFail(f.id, null, "REQ-CSC-02.2", `factory.module "${f.manifest.factory.module}" does not resolve on disk`));
}

/** REQ-CSC-02.1 (schematic branch): lowering.mode === "schematic" implies schema.json + files/**. */
export function checkSchematicLoweringFiles(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    if (f.manifest.lowering.mode !== "schematic") continue;
    const root = f.manifest.lowering.schematicRoot ?? "schematic";
    const schemaPath = join(f.dir, root, "schema.json");
    const filesDir = join(f.dir, root, "files");
    if (!existsSync(schemaPath)) {
      violations.push(ruleFail(f.id, null, "REQ-CSC-02.1", `lowering.mode is "schematic" but ${root}/schema.json is missing`));
    }
    if (!existsSync(filesDir) || collectFilesRecursive(filesDir).length === 0) {
      violations.push(ruleFail(f.id, null, "REQ-CSC-02.1", `lowering.mode is "schematic" but ${root}/files/ has no entries`));
    }
  }
  return violations;
}

/** REQ-CSC-02.3: conformance/collection.json exists (checked once, shared ancestor of every fixture). */
export function checkCollectionJsonMarker(root: string): string[] {
  if (existsSync(join(root, "collection.json"))) return [];
  return [ruleFail("collection.json", null, "REQ-CSC-02.3", `missing package-anchor marker at ${root}/collection.json`)];
}

/** REQ-CSC-03.1: every manifest has a non-empty cases array. */
export function checkNonEmptyCases(fixtures: LoadedFixture[]): string[] {
  return fixtures
    .filter((f) => !Array.isArray(f.manifest.cases) || f.manifest.cases.length === 0)
    .map((f) => ruleFail(f.id, null, "REQ-CSC-03.1", "cases[] is empty or not an array"));
}

/** REQ-CSC-03: class is one of handshake|wire-mutation|composition. */
export function checkValidClass(fixtures: LoadedFixture[]): string[] {
  return fixtures
    .filter((f) => !["handshake", "wire-mutation", "composition"].includes(f.manifest.class))
    .map((f) => ruleFail(f.id, null, "REQ-CSC-03", `class "${f.manifest.class}" is not one of handshake|wire-mutation|composition`));
}

/** REQ-CSC-03.2: every case has a fully-shaped transcript object. */
export function checkTranscriptShape(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    for (const c of f.manifest.cases) {
      const t = c.transcript as Transcript | undefined;
      if (t === undefined) {
        violations.push(ruleFail(f.id, c.name, "REQ-CSC-03.2", "missing transcript object"));
        continue;
      }
      if (!Array.isArray(t.callbacks) || t.callbacks.some((m) => !REVERSE_METHODS.includes(m))) {
        violations.push(ruleFail(f.id, c.name, "REQ-CSC-03.2", "transcript.callbacks is not an array of the 4 reverse-callback methods"));
      }
      for (const field of ["singleCommit", "forbidDiscard", "emitBeforeCommit"] as const) {
        if (typeof t[field] !== "boolean") {
          violations.push(ruleFail(f.id, c.name, "REQ-CSC-03.2", `transcript.${field} is not a boolean`));
        }
      }
    }
  }
  return violations;
}

/** REQ-CSC-03: every case has a fully-shaped outcome object. */
export function checkOutcomeShape(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    for (const c of f.manifest.cases) {
      const o = c.outcome;
      if (!Number.isInteger(o.exitCode)) violations.push(ruleFail(f.id, c.name, "REQ-CSC-03", "outcome.exitCode is not an integer"));
      if (o.emitRejectionCode !== null && typeof o.emitRejectionCode !== "string") {
        violations.push(ruleFail(f.id, c.name, "REQ-CSC-03", "outcome.emitRejectionCode is neither null nor a string"));
      }
      if (o.failedIndex !== null && !Number.isInteger(o.failedIndex)) {
        violations.push(ruleFail(f.id, c.name, "REQ-CSC-03", "outcome.failedIndex is neither null nor an integer"));
      }
      if (!Array.isArray(o.writtenPaths) || o.writtenPaths.some((p) => typeof p !== "string")) {
        violations.push(ruleFail(f.id, c.name, "REQ-CSC-03", "outcome.writtenPaths is not an array of strings"));
      }
    }
  }
  return violations;
}

/** REQ-CFX-04.1/.2 + REQ-CSC-04.1: outcome triple internal consistency. */
export function checkOutcomeTripleConsistency(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    for (const c of f.manifest.cases) {
      const { exitCode, emitRejectionCode, failedIndex } = c.outcome;
      const isExit2 = exitCode === 2;
      const hasCode = emitRejectionCode !== null;
      if (isExit2 !== hasCode) {
        violations.push(ruleFail(f.id, c.name, "REQ-CFX-04.1", `exitCode ${exitCode} and emitRejectionCode ${JSON.stringify(emitRejectionCode)} disagree (2 iff non-null)`));
        continue;
      }
      if (!hasCode) continue;
      if (DIRECTIVE_LEVEL_CODES.includes(emitRejectionCode!) && !Number.isInteger(failedIndex)) {
        violations.push(ruleFail(f.id, c.name, "REQ-CFX-04", `emitRejectionCode "${emitRejectionCode}" is directive-level but failedIndex is not an integer`));
      }
      if (BATCH_LEVEL_CODES.includes(emitRejectionCode!) && failedIndex !== null) {
        violations.push(ruleFail(f.id, c.name, "REQ-CFX-04.2", `emitRejectionCode "${emitRejectionCode}" is batch-level but failedIndex is not null`));
      }
    }
  }
  return violations;
}

/** REQ-CFX-10.1: a case declaring expected:"zero-effect" has a non-empty pre-run state (a seed dir). */
export function checkZeroEffectSeed(fixtures: LoadedFixture[]): string[] {
  return fixtures
    .flatMap((f) => f.manifest.cases.map((c) => ({ f, c })))
    .filter(({ c }) => c.expected === "zero-effect" && c.seed === null)
    .map(({ f, c }) => ruleFail(f.id, c.name, "REQ-CFX-10", 'expected:"zero-effect" requires a non-empty pre-run seed; seed is null'));
}
