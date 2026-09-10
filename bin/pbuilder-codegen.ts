// CLI: parse a factory's adjacent schema.json -> emit schema.generated.ts (design §4.1/
// §4.4, ADR-0027). generateSchema() is the S-000 core (discover/read/parse/emit/write),
// unchanged and still called directly by unit tests against arbitrary (non-contained)
// directories. The CLI surface below — usage/exit/stream discipline (TFO-03/04, FPS-01/05)
// and write-containment (TFO-05/SEC-4) — is S-001 scope, layered ONLY at the
// `import.meta.main` entry point so generateSchema() itself stays containment-agnostic.
//
// Lives OUTSIDE src/ (FIT-15: bin->core only, never core->bin) and imports the shared
// schema cluster.

import {
  readFileSync, writeFileSync, existsSync, realpathSync, lstatSync, statSync,
  openSync, fstatSync, ftruncateSync, closeSync, constants,
} from "node:fs";
import { join, dirname, basename, resolve, sep } from "node:path";
import { parseSchema, SchemaParseFailure, formatLocator } from "../src/core/schema/schema-parse.ts";
import { computeSchemaDigest } from "../src/core/schema/schema-digest.ts";
import { schemaPathFor } from "../src/core/schema/schema-discovery.ts";
import { checkSufficiency, type SufficiencyFinding } from "../src/core/schema/schema-sufficiency.ts";
import { isErrnoException } from "../src/core/fs-errors.ts";
import { emitInputType, UnrecognizedPropertyTypeError } from "./emit-type.ts";
import { discoverProject } from "./project-codegen.ts";

export const GENERATED_FILENAME = "schema.generated.ts";
export const SUCCESS_LINE = "pbuilder-codegen: wrote schema.generated.ts";
export const USAGE = [
  "pbuilder-codegen: derive a TypeScript Input type from a factory's schema.json",
  "",
  "Usage: pbuilder-codegen <package-dir>",
].join("\n");

export interface GenerateResult {
  outputPath: string;
  digest: string;
}

// SEC-1/TFO-01 belt-and-suspenders: checkSufficiency's `nonsensical-type` rule already flags
// an unrecognized `type` (and the other hard-fail shapes) — refusing to emit here is the
// PRIMARY defence against a hostile schema.json reaching the emitter; `emitPropertyType`'s
// own allow-list (bin/emit-type.ts) is the backstop if this call site is ever bypassed.
export class SchemaSufficiencyFailure extends Error {
  readonly findings: SufficiencyFinding[];

  constructor(findings: SufficiencyFinding[]) {
    super(`schema sufficiency failure: ${findings.length} finding(s)`);
    this.name = "SchemaSufficiencyFailure";
    this.findings = findings;
  }
}

class OutputWriteFailure extends Error {
  constructor(outputPath: string, cause: unknown, reason?: string) {
    const code = isErrnoException(cause) ? cause.code : undefined;
    super(`pbuilder-codegen: ${outputPath}: ${reason ?? (
      code === "ELOOP" ? "refusing symbolic-link output" : `cannot write output (${code ?? "unknown"})`
    )}`, { cause });
    this.name = "OutputWriteFailure";
  }
}

function assertOutputLeaf(outputPath: string): void {
  try {
    const leaf = lstatSync(outputPath);
    if (leaf.isSymbolicLink()) {
      throw new OutputWriteFailure(outputPath, undefined, "refusing symbolic-link output");
    }
    if (!leaf.isFile()) {
      throw new OutputWriteFailure(outputPath, undefined, "output is not a regular file");
    }
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return;
    throw err instanceof OutputWriteFailure ? err : new OutputWriteFailure(outputPath, err);
  }
}

/**
 * Reads `<packageDir>/schema.json`, parses it, and writes `<packageDir>/schema.generated.ts`
 * — the bin's fixed, non-configurable output location (REQ-TFO-05.1/FPS-01).
 */
export function generateSchema(packageDir: string): GenerateResult {
  const schemaPath = schemaPathFor(packageDir);
  const raw = readFileSync(schemaPath, "utf-8");
  const schema = parseSchema(raw);
  const sufficiencyFindings = checkSufficiency(raw);
  if (sufficiencyFindings.length > 0) {
    throw new SchemaSufficiencyFailure(sufficiencyFindings);
  }
  const digest = computeSchemaDigest(raw);
  const output = emitInputType(schema, digest);
  const outputPath = join(packageDir, GENERATED_FILENAME);
  try {
    if (process.platform === "linux" || process.platform === "darwin") {
      assertOutputLeaf(outputPath);
      if (!constants.O_NOFOLLOW || !constants.O_NONBLOCK) {
        throw new OutputWriteFailure(outputPath, undefined, "safe output opening is unavailable");
      }
      // Bind mutation to the checked descriptor; pathname validation alone races with leaf substitution.
      const fd = openSync(outputPath, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o666);
      let failed = false;
      try {
        if (!fstatSync(fd).isFile()) {
          throw new OutputWriteFailure(outputPath, undefined, "output is not a regular file");
        }
        ftruncateSync(fd, 0);
        writeFileSync(fd, output, "utf-8");
      } catch (err) {
        failed = true;
        throw err;
      } finally {
        try {
          closeSync(fd);
        } catch (err) {
          if (!failed) throw err;
        }
      }
    } else {
      writeFileSync(outputPath, output, "utf-8");
    }
  } catch (err) {
    throw err instanceof OutputWriteFailure ? err : new OutputWriteFailure(outputPath, err);
  }
  return { outputPath, digest };
}

// --- CLI-only surface (S-001): argv discipline + write containment ------------------

export class WriteContainmentRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteContainmentRefusal";
  }
}

// Walks up from `startDir` to the nearest ancestor containing a `package.json` — the
// invoking PROCESS's project root (ADR-0027 Gap 3: anchored to process.cwd(), never to
// `<package-dir>` itself, which would be circular). Falls back to `startDir` in the
// degenerate case where no ancestor carries a package.json.
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

// Canonicalizes a path that may not exist yet (the output file usually doesn't): resolves
// the nearest EXISTING ancestor via realpathSync (defeats symlink escapes — a string-level
// `../` check alone is bypassable) and re-appends the not-yet-existing suffix segments.
function realpathNearestExisting(p: string): string {
  let current = p;
  const suffix: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    suffix.unshift(basename(current));
    current = parent;
  }
  const real = realpathSync(current);
  return suffix.length > 0 ? join(real, ...suffix) : real;
}

function isWithin(anchor: string, target: string): boolean {
  return target === anchor || target.startsWith(anchor.endsWith(sep) ? anchor : anchor + sep);
}

// SEC-4/REQ-TFO-05: refuses BEFORE any read/write when either the resolved package dir or
// the resolved output path escapes the invoking process's project root. Schema content is
// never consulted here — the output path is structurally fixed (TFO-05.3), never templated.
function assertWriteContained(packageDirArg: string, outputPath: string, selectedRoot?: string): void {
  const anchor = selectedRoot ?? realpathSync(findProjectRoot(process.cwd()));
  const resolvedPackageDir = realpathNearestExisting(resolve(packageDirArg));
  if (selectedRoot !== undefined || process.platform === "linux" || process.platform === "darwin") assertOutputLeaf(outputPath);
  const resolvedOutputPath = realpathNearestExisting(resolve(outputPath));
  if (!isWithin(anchor, resolvedPackageDir) || !isWithin(anchor, resolvedOutputPath)) {
    throw new WriteContainmentRefusal(
      `pbuilder-codegen: refusing to write outside the project root: "${packageDirArg}"`
    );
  }
}

// TW-m6 pinned template: `pbuilder-codegen: <file>: <problem> (line L, column C)`, with the
// ADR-0027 Gap-8 `(position unknown)` fallback when the engine's SyntaxError carried no
// extractable offset. Never echoes raw file content or the underlying parser's own text.
function formatParseError(schemaPath: string, err: SchemaParseFailure): string {
  return `pbuilder-codegen: ${schemaPath}: ${err.problem} ${formatLocator(err.line, err.column)}`;
}

// Bounded, author-vocabulary descriptions per REQ-SCP-02 reason — never echoes a finding's
// `detail` (the raw offending value, e.g. an injection payload lives in `nonsensical-type`'s
// `detail`); only property KEYS surface, matching the same canary-asymmetry no-echo contract
// as the run-boundary rejection templates (key names may appear, values never).
function describeSufficiencyFinding(finding: SufficiencyFinding): string {
  switch (finding.reason) {
    case "forbidden-key":
      return `property "${finding.key}" uses a forbidden key`;
    case "missing-type":
      return `property "${finding.key}" is missing a type`;
    case "nonsensical-type":
      return `unrecognized property type for "${finding.key}"`;
    case "enum-missing-choices":
      return `enum property "${finding.key}" is missing choices`;
    case "missing-label":
      return `property "${finding.key}" is missing a label`;
  }
}

function formatSufficiencyError(schemaPath: string, err: SchemaSufficiencyFailure): string {
  const reasons = err.findings.map(describeSufficiencyFinding).join("; ");
  return `pbuilder-codegen: ${schemaPath}: ${reasons}`;
}

/**
 * Runs the CLI logic for `argv` (`process.argv.slice(2)`) and returns the process exit
 * code, printing usage/success/error text to STDOUT/STDERR per the CLI contract
 * (ADR-0027). Exported (not just the `import.meta.main` block) so the exit-code/output
 * contract can be exercised without a subprocess where that is sufficient.
 */
export function runCli(argv: string[]): number {
  const [first] = argv;

  if (first === undefined || first === "--project") {
    if (first === "--project" && (!argv[1] || argv[1].startsWith("-") || argv.length !== 2)) {
      console.error(USAGE);
      return 1;
    }
    return runProject(argv[1]);
  }
  if (first === "--help" || first === "-h") {
    console.log(USAGE);
    return 0;
  }
  if (first.startsWith("-")) {
    console.error(USAGE);
    return 1;
  }

  const packageDir = first;
  const outputPath = join(packageDir, GENERATED_FILENAME);
  const schemaPath = schemaPathFor(packageDir);

  try {
    assertWriteContained(packageDir, outputPath);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  try {
    generateSchema(packageDir);
  } catch (err) {
    if (err instanceof OutputWriteFailure) {
      console.error(err.message);
      return 1;
    }
    if (err instanceof SchemaParseFailure) {
      console.error(formatParseError(schemaPath, err));
      return 1;
    }
    if (err instanceof SchemaSufficiencyFailure) {
      console.error(formatSufficiencyError(schemaPath, err));
      return 1;
    }
    // Backstop: emitPropertyType's own allow-list (bin/emit-type.ts) should be unreachable
    // given the sufficiency gate above, but a bypass must still fail closed with the standard
    // template rather than an uncaught internal stack trace.
    if (err instanceof UnrecognizedPropertyTypeError) {
      console.error(`pbuilder-codegen: ${schemaPath}: ${err.message}`);
      return 1;
    }
    if (isErrnoException(err) && err.code === "ENOENT") {
      console.error(`pbuilder-codegen: ${schemaPath}: schema.json not found`);
      return 1;
    }
    throw err;
  }

  console.log(SUCCESS_LINE);
  return 0;
}

function runProject(directory?: string): number {
  const project = discoverProject(directory);
  if (!project.ok) {
    console.error(`pbuilder-codegen: ${project.diagnostic}`);
    return 1;
  }
  const seen = new Set<string>();
  let generated = 0;
  let failed = 0;
  let duplicates = 0;
  for (const entry of project.entries) {
    if (entry.kind === "failure") {
      failed++;
      console.error(`pbuilder-codegen: ${JSON.stringify(entry.label)}: ${entry.diagnostic}`);
      continue;
    }
    const output = join(entry.directory, GENERATED_FILENAME);
    const schemaPath = schemaPathFor(entry.directory);
    try {
      assertWriteContained(entry.directory, output, project.root);
      if (seen.has(output)) { duplicates++; continue; }
      seen.add(output);
      if (!statSync(schemaPath).isFile()) throw new Error("nonregular schema");
      generateSchema(entry.directory);
      generated++;
    } catch (error) {
      failed++;
      const diagnostic = error instanceof SchemaParseFailure ? formatParseError(schemaPath, error)
        : error instanceof SchemaSufficiencyFailure ? formatSufficiencyError(schemaPath, error)
        : error instanceof WriteContainmentRefusal ? "refusing to write outside the selected project root"
        : error instanceof OutputWriteFailure ? "cannot write a regular, non-symbolic-link output"
        : "cannot read or generate schema.json";
      console.error(`pbuilder-codegen: ${JSON.stringify(entry.label)} (${JSON.stringify(entry.directory)}): ${JSON.stringify(diagnostic)}`);
    }
  }
  console.log(`pbuilder-codegen: generated ${generated}, failed ${failed}, duplicates ${duplicates}`);
  return failed > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exitCode = runCli(process.argv.slice(2));
}
