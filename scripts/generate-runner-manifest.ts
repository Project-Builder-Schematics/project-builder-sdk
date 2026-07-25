// Build authority for dist/runner-manifest.json: derive -> fail closed on any violation ->
// hash all 24 files -> write once -> print the two identity lines.
//
// The package root is resolved with `fileURLToPath`, NOT `new URL(...).pathname` (this
// repo's test-helper idiom): `.pathname` does not percent-decode, so it breaks on a build
// path containing a space — REQ-RMD-02.1 plants exactly that.
//
// usage: bun scripts/generate-runner-manifest.ts [packageRoot]
import { readFileSync, rmSync, writeFileSync } from "node:fs";
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

// A stale manifest surviving a failed derivation is indistinguishable from tampering on the
// user's machine, so the unlink is part of failing — not a cleanup nicety.
function failClosed(violations: readonly Violation[]): never {
  process.stderr.write(
    renderViolations(violations, { distDirName: DIST_DIR_NAME, srcDirName: SRC_DIR_NAME })
  );
  rmSync(manifestPath, { force: true });
  process.exit(1);
}

const derivation = deriveRunnerClosure(distRoot, ENTRY_RELATIVE_PATH);
if (derivation.violations.length > 0) failClosed(derivation.violations);

// Read once, reused for both the digest and `packageVersion` below — mirrors the
// derivation's own read-once discipline for the closure files (`fileBytes`).
let packageJsonBytes: Buffer;
try {
  packageJsonBytes = readFileSync(join(packageRoot, "package.json"));
} catch {
  failClosed([{ rule: "unreadable-file", file: "package.json", line: null, found: "package.json" }]);
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
    return failClosed([{ rule: "unreadable-file", file: node, line: null, found: path }]);
  }
  return { path, sha256: sha256Bytes(bytes) };
});

const rootPackage = JSON.parse(packageJsonBytes.toString("utf-8")) as { version: string };

const manifest: RunnerManifest = {
  manifestVersion: 1,
  algorithm: "sha256",
  entry: `${DIST_DIR_NAME}/${ENTRY_RELATIVE_PATH}`,
  packageVersion: rootPackage.version,
  files,
};

writeFileSync(manifestPath, serialiseManifest(manifest));

process.stdout.write(
  `runner-manifest: ${files.length} files -> ${DIST_DIR_NAME}/${MANIFEST_RELATIVE_PATH}\n`
);
process.stdout.write(`runner-manifest-sha256: ${sha256File(manifestPath)}\n`);
