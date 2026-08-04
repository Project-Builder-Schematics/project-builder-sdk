// Build authority for dist/runner-manifest.json: derive -> fail closed on any violation ->
// hash all 24 files -> write once -> print the two identity lines.
//
// The package root is resolved with `fileURLToPath`, NOT `new URL(...).pathname` (this
// repo's test-helper idiom): `.pathname` does not percent-decode, so it breaks on a build
// path containing a space — REQ-RMD-02.1 plants exactly that.
//
// REQ-FCG-01: exactly ONE fail-closed boundary, structural — every throw inside `generate()`
// (a deliberately-tagged `GenerationFailure`, a malformed-JSON parse error, an unanticipated
// exception) propagates to the SAME outer `catch`, which unconditionally removes both the
// final manifest path and the write-temp path before exiting non-zero. This is what makes
// "no failure path bypasses the boundary" true BY CONSTRUCTION, not by enumerating cases.
//
// usage: bun scripts/generate-runner-manifest.ts [packageRoot]
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  comparePaths,
  deriveRunnerClosure,
  renderViolations,
  serialiseManifest,
  sha256Bytes,
  sha256File,
  DIST_DIR_NAME,
  ENTRY_RELATIVE_PATH,
  MANIFEST_RELATIVE_PATH,
  SRC_DIR_NAME,
  type RunnerManifest,
  type Violation,
} from "./derive-runner-closure.ts";

const packageRoot = process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url));
const distRoot = join(packageRoot, DIST_DIR_NAME);
const manifestPath = join(distRoot, MANIFEST_RELATIVE_PATH);
// Write-temp-then-rename (REQ-FCG-01): the ONLY write path. A same-filesystem rename is
// atomic, so `manifestPath` is never observed partially written — the equivalent hash-all-
// then-write-once atomicity the requirement names as an acceptable alternative.
const tempManifestPath = `${manifestPath}.tmp`;

/** A deliberately-classified failure — carries the violation(s) the outer boundary renders. */
class GenerationFailure extends Error {
  constructor(public readonly violations: readonly Violation[]) {
    super("runner-manifest generation failed");
  }
}

function fail(violations: readonly Violation[]): never {
  throw new GenerationFailure(violations);
}

function generate(): void {
  const derivation = deriveRunnerClosure(distRoot, ENTRY_RELATIVE_PATH);
  if (derivation.violations.length > 0) fail(derivation.violations);

  // Read once, reused for both the digest and `packageVersion` below — mirrors the
  // derivation's own read-once discipline for the closure files (`fileBytes`).
  let packageJsonBytes: Buffer;
  try {
    packageJsonBytes = readFileSync(join(packageRoot, "package.json"));
  } catch {
    fail([{ rule: "unreadable-file", file: "package.json", line: null, found: "package.json" }]);
  }

  // All 24 records sort together (ambiguity B) — package.json is not appended after the
  // dist/ ones.
  const manifestPaths = [
    ...derivation.nodes.map((node) => `${DIST_DIR_NAME}/${node}`),
    "package.json",
  ].sort(comparePaths);

  // Nothing is opened for writing before every byte is known, so a truncated manifest has no
  // source in this design (REQ-BPI-02.2). Bytes come from `derivation.fileBytes` (already read
  // once during the walk) or `packageJsonBytes` above — never a second disk read per file.
  const files = manifestPaths.map((path) => {
    if (path === "package.json") {
      return { path, sha256: sha256Bytes(packageJsonBytes) };
    }
    const node = path.slice(DIST_DIR_NAME.length + 1);
    const bytes = derivation.fileBytes.get(node);
    if (bytes === undefined) {
      fail([{ rule: "unreadable-file", file: node, line: null, found: path }]);
    }
    return { path, sha256: sha256Bytes(bytes) };
  });

  // Malformed JSON throws HERE, uncaught by this function — routed to the single outer
  // boundary below, not a locally-enumerated case (REQ-FCG-01.3/R1-5; closes R2-4: a
  // pre-existing manifest must not survive this throw, which only the outer boundary's
  // unconditional cleanup guarantees).
  const rootPackage = JSON.parse(packageJsonBytes.toString("utf-8")) as { version?: unknown };

  // An `as` assertion trusts the shape; it does not check it. A `version`-less package.json
  // (or a non-string one) must fail the build, not silently produce a manifest whose
  // `packageVersion` JSON.stringify then drops — the engine needs that field to tell
  // version-mismatch apart from integrity-mismatch (REQ-RME-07.1). REQ-DGN-01.1: this is a
  // version-specific defect, never `unreadable-file` — the file WAS read; its CONTENT is
  // structurally invalid.
  const packageVersion = rootPackage.version;
  if (typeof packageVersion !== "string" || packageVersion.length === 0) {
    const found =
      typeof packageVersion === "string"
        ? `package.json has an empty "version" field`
        : `package.json is missing a non-empty "version" field (found: ${JSON.stringify(packageVersion)})`;
    fail([{ rule: "manifest-version-invalid", file: "package.json", line: null, found }]);
  }

  const manifest: RunnerManifest = {
    manifestVersion: 1,
    algorithm: "sha256",
    entry: `${DIST_DIR_NAME}/${ENTRY_RELATIVE_PATH}`,
    packageVersion,
    files,
  };

  writeFileSync(tempManifestPath, serialiseManifest(manifest));
  renameSync(tempManifestPath, manifestPath);

  process.stdout.write(
    `runner-manifest: ${files.length} files -> ${DIST_DIR_NAME}/${MANIFEST_RELATIVE_PATH}\n`
  );
  process.stdout.write(`runner-manifest-sha256: ${sha256File(manifestPath)}\n`);
}

try {
  generate();
} catch (error) {
  // The ONE fail-closed boundary (REQ-FCG-01): whatever failed, however it failed, no
  // manifest survives — neither a stale pre-existing one (R2-4) nor a partially-written temp
  // file (R1-6). A stale manifest surviving a failed derivation is indistinguishable from
  // tampering on the user's machine, so this removal is part of failing, not a cleanup nicety.
  rmSync(manifestPath, { force: true });
  rmSync(tempManifestPath, { force: true });

  if (error instanceof GenerationFailure) {
    process.stderr.write(
      renderViolations(error.violations, { distDirName: DIST_DIR_NAME, srcDirName: SRC_DIR_NAME })
    );
  } else {
    // An unrouted throw (REQ-FCG-01.3) — no enumerated case named it, but the boundary still
    // fails closed and reports what it can, rather than leaking a raw uncaught-exception trace.
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(
      `runner-manifest: generation failed with an unrouted error.\n${detail}\n\nNo manifest was written; ${DIST_DIR_NAME}/${MANIFEST_RELATIVE_PATH} does not exist.\n`
    );
  }
  process.exit(1);
}
