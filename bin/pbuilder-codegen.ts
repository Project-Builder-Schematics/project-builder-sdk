// CLI: parse a factory's adjacent schema.json -> emit schema.generated.ts (design §4.1/
// §4.4, ADR-0027). generateSchema() is the S-000 core (discover/read/parse/emit/write),
// unchanged and still called directly by unit tests against arbitrary (non-contained)
// directories. The CLI surface below — usage/exit/stream discipline (TFO-03/04, FPS-01/05)
// and write-containment (TFO-05/SEC-4) — is S-001 scope, layered ONLY at the
// `import.meta.main` entry point so generateSchema() itself stays containment-agnostic.
//
// Lives OUTSIDE src/ (FIT-15: bin->core only, never core->bin) and imports the shared
// schema cluster.

import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname, basename, resolve, sep } from "node:path";
import { parseSchema, SchemaParseFailure } from "../src/core/schema/schema-parse.ts";
import { computeSchemaDigest } from "../src/core/schema/schema-digest.ts";
import { schemaPathFor } from "../src/core/schema/schema-discovery.ts";
import { emitInputType } from "./emit-type.ts";

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

/**
 * Reads `<packageDir>/schema.json`, parses it, and writes `<packageDir>/schema.generated.ts`
 * — the bin's fixed, non-configurable output location (REQ-TFO-05.1/FPS-01).
 */
export function generateSchema(packageDir: string): GenerateResult {
  const schemaPath = schemaPathFor(packageDir);
  const raw = readFileSync(schemaPath, "utf-8");
  const schema = parseSchema(raw);
  const digest = computeSchemaDigest(raw);
  const output = emitInputType(schema, digest);
  const outputPath = join(packageDir, GENERATED_FILENAME);
  writeFileSync(outputPath, output, "utf-8");
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
  return target === anchor || target.startsWith(anchor + sep);
}

// SEC-4/REQ-TFO-05: refuses BEFORE any read/write when either the resolved package dir or
// the resolved output path escapes the invoking process's project root. Schema content is
// never consulted here — the output path is structurally fixed (TFO-05.3), never templated.
function assertWriteContained(packageDirArg: string, outputPath: string): void {
  const anchor = realpathSync(findProjectRoot(process.cwd()));
  const resolvedPackageDir = realpathNearestExisting(resolve(packageDirArg));
  const resolvedOutputPath = realpathNearestExisting(resolve(outputPath));
  if (!isWithin(anchor, resolvedPackageDir) || !isWithin(anchor, resolvedOutputPath)) {
    throw new WriteContainmentRefusal(
      `pbuilder-codegen: refusing to write outside the project root: "${packageDirArg}"`
    );
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

// TW-m6 pinned template: `pbuilder-codegen: <file>: <problem> (line L, column C)`, with the
// ADR-0027 Gap-8 `(position unknown)` fallback when the engine's SyntaxError carried no
// extractable offset. Never echoes raw file content or the underlying parser's own text.
function formatParseError(schemaPath: string, err: SchemaParseFailure): string {
  const locator = err.line !== undefined && err.column !== undefined
    ? `(line ${err.line}, column ${err.column})`
    : "(position unknown)";
  return `pbuilder-codegen: ${schemaPath}: ${err.problem} ${locator}`;
}

/**
 * Runs the CLI logic for `argv` (`process.argv.slice(2)`) and returns the process exit
 * code, printing usage/success/error text to STDOUT/STDERR per the CLI contract
 * (ADR-0027). Exported (not just the `import.meta.main` block) so the exit-code/output
 * contract can be exercised without a subprocess where that is sufficient.
 */
export function runCli(argv: string[]): number {
  const [first] = argv;

  if (first === undefined) {
    console.error(USAGE);
    return 1;
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
    if (err instanceof SchemaParseFailure) {
      console.error(formatParseError(schemaPath, err));
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

if (import.meta.main) {
  process.exitCode = runCli(process.argv.slice(2));
}
