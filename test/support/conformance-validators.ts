// Pure violation-collectors for the conformance/ corpus self-check (REQ-CSC-01..04, REQ-CCR
// series, REQ-CFX-04/10). Extracted from fit-40 so the same validation logic can run against
// BOTH the real conformance/ tree (fit-40) and synthetic broken fixtures (fit-40's negative
// suite) — a single source of truth for what counts as a violation, never duplicated.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./import-scan.ts";
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

/** Every distinct factory module a fixture references — its own default plus every
 * case-level `factory.module` override (ADR-0065). */
function distinctFactoryModules(f: LoadedFixture): string[] {
  return [...new Set<string>([f.manifest.factory.module, ...f.manifest.cases.map((c) => c.factory?.module ?? f.manifest.factory.module)])];
}

/** REQ-CSC-02.2: every fixture's factory.module resolves to an existing file — the
 * fixture-level default AND every case-level `factory.module` override. */
export function checkFactoryModuleResolution(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    for (const module of distinctFactoryModules(f)) {
      if (!existsSync(join(f.dir, module))) {
        violations.push(ruleFail(f.id, null, "REQ-CSC-02.2", `factory.module "${module}" does not resolve on disk`));
      }
    }
  }
  return violations;
}

const EXPORT_NAME_RE = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+const\s+([A-Za-z_$][\w$]*)/g;
const DEFAULT_EXPORT_RE = /export\s+default\b/;

/** Text-level export inventory of a factory module — a structural self-check, not a
 * compiler: default export presence + every named `export function`/`export const`. */
function collectExportedNames(source: string): { names: Set<string>; hasDefault: boolean } {
  const stripped = stripComments(source);
  const names = new Set<string>();
  for (const m of stripped.matchAll(EXPORT_NAME_RE)) {
    const name = m[1] ?? m[2];
    if (name !== undefined) names.add(name);
  }
  return { names, hasDefault: DEFAULT_EXPORT_RE.test(stripped) };
}

/**
 * REQ-CSC-02.2 (export resolution): every case-level (and fixture-level) `factory.export`
 * pointer names a REAL export of its module — a `factory.export: null` pointer requires a
 * default export, a named pointer requires that exact named export to exist. Catches a
 * typo'd export name that `checkFactoryModuleResolution` (file existence only) cannot see.
 */
export function checkFactoryExportResolution(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    const pointers: Array<{ module: string; exportName: string | null; caseName: string | null }> = [
      { module: f.manifest.factory.module, exportName: f.manifest.factory.export, caseName: null },
      ...f.manifest.cases
        .filter((c) => c.factory !== undefined)
        .map((c) => ({ module: c.factory!.module, exportName: c.factory!.export, caseName: c.name })),
    ];

    const exportsCache = new Map<string, ReturnType<typeof collectExportedNames> | null>();
    for (const { module, exportName, caseName } of pointers) {
      if (!exportsCache.has(module)) {
        const path = join(f.dir, module);
        exportsCache.set(module, existsSync(path) ? collectExportedNames(readFileSync(path, "utf8")) : null);
      }
      const parsed = exportsCache.get(module) ?? null;
      if (parsed === null) continue; // checkFactoryModuleResolution already flags the missing module

      if (exportName === null) {
        if (!parsed.hasDefault) {
          violations.push(ruleFail(f.id, caseName, "REQ-CSC-02.2", `factory.export is null but module "${module}" declares no default export`));
        }
        continue;
      }
      if (!parsed.names.has(exportName)) {
        violations.push(ruleFail(f.id, caseName, "REQ-CSC-02.2", `factory.export "${exportName}" is not a named export of module "${module}"`));
      }
    }
  }
  return violations;
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/** Locates a named `export function`/`export async function` block by brace-matching from
 * its declaration; returns the `[start, end)` span (declaration through closing `}`), or
 * `null` if not found. Text-level, not a compiler — sufficient for a structural self-check. */
function extractNamedExportFunctionBlock(source: string, exportName: string): { start: number; end: number } | null {
  const declRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${exportName}\\s*\\(`);
  const declMatch = declRe.exec(source);
  if (declMatch === null) return null;
  const braceStart = source.indexOf("{", declMatch.index);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return { start: declMatch.index, end: i + 1 };
    }
  }
  return null; // unbalanced braces — treat as not found
}

/**
 * REQ-CFX-02.1 create() quarantine: within any factory file that authors a `create(` call,
 * every occurrence must lie INSIDE the named-export function block(s) that this fixture's
 * cases actually reference via a case-level `factory.export` override — never in the
 * file's default export or any other unreferenced span. Closes the blind spot in the
 * corpus-wide "which FILES contain create()" scan: that scan cannot see a SECOND `create()`
 * smuggled into the same sanctioned file's default export, because it only asks whether the
 * file is the one sanctioned path, never where inside the file the call sits.
 */
export function checkCreateQuarantine(fixtures: LoadedFixture[]): string[] {
  const violations: string[] = [];
  for (const f of fixtures) {
    const moduleToNamedExports = new Map<string, Set<string>>();
    for (const c of f.manifest.cases) {
      if (c.factory?.export === null || c.factory?.export === undefined) continue;
      const set = moduleToNamedExports.get(c.factory.module) ?? new Set<string>();
      set.add(c.factory.export);
      moduleToNamedExports.set(c.factory.module, set);
    }

    for (const module of distinctFactoryModules(f)) {
      const path = join(f.dir, module);
      if (!existsSync(path)) continue; // checkFactoryModuleResolution already flags this
      const source = stripComments(readFileSync(path, "utf8"));
      const totalCreateCount = countMatches(source, /\bcreate\s*\(/g);
      if (totalCreateCount === 0) continue;

      let insideQuarantineCount = 0;
      for (const exportName of moduleToNamedExports.get(module) ?? []) {
        const block = extractNamedExportFunctionBlock(source, exportName);
        if (block === null) continue;
        insideQuarantineCount += countMatches(source.slice(block.start, block.end), /\bcreate\s*\(/g);
      }

      if (insideQuarantineCount === 0) {
        violations.push(
          ruleFail(f.id, null, "REQ-CFX-02.1", `factory file "${module}" authors create() but no quarantined named-export block was found to contain it`)
        );
      } else if (insideQuarantineCount !== totalCreateCount) {
        violations.push(
          ruleFail(
            f.id,
            null,
            "REQ-CFX-02.1",
            `factory file "${module}" authors create() outside its quarantined named-export block(s) (${totalCreateCount} total call(s), only ${insideQuarantineCount} inside quarantine)`
          )
        );
      }
    }
  }
  return violations;
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
