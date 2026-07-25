/**
 * S-004 — Tier C: the packaging boundary (REQ-PMF-01, REQ-PMF-02).
 *
 * `npm pack` is NORMATIVE here because it is what `publish.yml` uses. FIT-14 keeps
 * `bun pm pack` for its own listing; the two coexist deliberately (design §10, open
 * question 3) — packing with one packer and releasing with the other would prove the
 * wrong thing.
 *
 * NO CONDITIONAL SKIP, ever. R-2 is binding: on a missing or unreachable registry this
 * file FAILS LOUDLY. PMF-02.3 is the ONLY scenario covering the production install path,
 * so an `it.skipIf(offline)` here would false-pass precisely the thing the slice exists to
 * prove. north-star.md risk 4 states the real danger: not the flake, but the pressure to
 * quiet it.
 *
 * Every step runs at its own temp root. The real `dist/`, the real `package.json` and the
 * repo's own `node_modules` are never mutated.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTscBuild } from "../support/shared-build.ts";
import { hashFile } from "../support/scratch-consumer.ts";
import type { RunnerManifest } from "../../scripts/derive-runner-closure.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;

// npm pack + a real registry install; bun's 5s default would time out on the network leg,
// and an undeclared timeout is exactly the flake class this suite already paid for once.
const TIER_C_TIMEOUT = 300_000;

const MANIFEST_RELATIVE_PATH = "dist/runner-manifest.json";
const PACKAGE_NAME = "@pbuilder/sdk";
const EXPECTED_RECORD_COUNT = 24;

// Port 1 is reserved and never listening; the fast-fail flags keep the failure inside seconds.
const DEAD_REGISTRY = "http://127.0.0.1:1";

const temporaryRoots: string[] = [];

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

/** `package.json` sorts last under byte order, so it is literally the 24th record. */
function entryTwentyFour(manifest: RunnerManifest): { path: string; sha256: string } {
  const record = manifest.files[EXPECTED_RECORD_COUNT - 1];
  if (record === undefined) {
    throw new Error(
      `Tier C: manifest carries ${manifest.files.length} records, expected ${EXPECTED_RECORD_COUNT}`
    );
  }
  return record;
}

// `hashFile` (test/support/scratch-consumer.ts) is a TEST-side hasher, never the
// generator's, or PMF-02.1 degrades to f(x) === f(x). fit-42 imports the same helper for the
// identical recompute-and-compare purpose.

// Fails loudly with the command's own output. This is the mechanism criterion 5 names: an
// unreachable registry surfaces here as a test failure carrying npm's diagnosis, never as
// a skip.
function run(command: string, args: readonly string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `Tier C: \`${command} ${args.join(" ")}\` failed in ${cwd} (exit ${result.status}).\n` +
        `This test never skips — a missing or unreachable registry MUST fail here, because\n` +
        `PMF-02.3 is the only scenario covering the production install path.\n` +
        `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return result.stdout;
}

/** A package root holding exactly what npm would publish: `files: ["dist"]` plus package.json. */
function packageRootCopy(prefix: string): string {
  const root = temporaryRoot(prefix);
  cpSync(join(PROJECT_ROOT, "dist"), join(root, "dist"), { recursive: true });
  cpSync(join(PROJECT_ROOT, "package.json"), join(root, "package.json"));
  return root;
}

function packTarball(packageRoot: string): string {
  const destination = temporaryRoot("pmf-tarball-");
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", destination], packageRoot);
  const entries = readdirSync(destination).filter((name) => name.endsWith(".tgz"));
  if (entries.length !== 1) {
    throw new Error(`Tier C: expected exactly one tarball in ${destination}, saw ${entries.join(", ")}`);
  }
  return join(destination, entries[0] as string);
}

/** Extracts and strips the `package/` prefix explicitly, per the spec's normative note. */
function extractTarball(tarballPath: string): string {
  const root = temporaryRoot("pmf-extract-");
  run("tar", ["-xzf", tarballPath, "-C", root], root);
  return join(root, "package");
}

let extracted = "";
let packedManifest: RunnerManifest;
let dryRunFiles: string[] = [];
let tarballPath = "";

beforeAll(() => {
  ensureTscBuild();

  const source = packageRootCopy("pmf-source-");
  const dryRun = run(
    "npm",
    ["pack", "--dry-run", "--ignore-scripts", "--json"],
    source
  );
  dryRunFiles = (JSON.parse(dryRun) as Array<{ files: Array<{ path: string }> }>)
    .flatMap((entry) => entry.files)
    .map((file) => file.path);

  tarballPath = packTarball(source);
  extracted = extractTarball(tarballPath);
  packedManifest = JSON.parse(
    readFileSync(join(extracted, MANIFEST_RELATIVE_PATH), "utf-8")
  ) as RunnerManifest;
}, TIER_C_TIMEOUT);

afterAll(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

describe("PMF-01 — the manifest is part of the published surface", () => {
  it("npm pack's file list contains dist/runner-manifest.json", () => {
    expect(dryRunFiles.length).toBeGreaterThan(EXPECTED_RECORD_COUNT);
    expect(dryRunFiles).toContain(MANIFEST_RELATIVE_PATH);
  });
});

describe("PMF-02.1 — every digest holds against the packed bytes", () => {
  it("the packed manifest still carries exactly 24 records, package.json last", () => {
    expect(packedManifest.files.length).toBe(EXPECTED_RECORD_COUNT);
    expect(entryTwentyFour(packedManifest).path).toBe("package.json");
  });

  it("all 24 digests recompute from the extracted tarball's own bytes", () => {
    const mismatched = packedManifest.files.filter(
      (record) => hashFile(join(extracted, record.path)) !== record.sha256
    );
    expect(packedManifest.files.length).toBe(EXPECTED_RECORD_COUNT);
    expect(mismatched.map((record) => record.path)).toEqual([]);
  });
});

describe("PMF-02.2 — a version stamped after the build breaks entry #24", () => {
  // The behavioural proof of the publish-ordering property. S-002's BPI-03.1 establishes it
  // structurally from publish.yml; this is what it looks like when the property is violated.
  it(
    "rewriting package.json#version after packing makes entry #24's digest MISMATCH",
    () => {
      const rewritten = packageRootCopy("pmf-rewrite-");
      const packageJsonPath = join(rewritten, "package.json");
      const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string };
      const originalVersion = parsed.version;
      parsed.version = "0.0.0-dev.deadbee";
      writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`);

      const stampedExtract = extractTarball(packTarball(rewritten));

      const entry24 = entryTwentyFour(packedManifest);
      expect(entry24.path).toBe("package.json");
      expect(hashFile(join(stampedExtract, "package.json"))).not.toBe(entry24.sha256);

      // Named: `version` is the field that moved, and it is the ONLY one.
      const shipped = JSON.parse(readFileSync(join(stampedExtract, "package.json"), "utf-8")) as Record<
        string,
        unknown
      >;
      const canonical = JSON.parse(readFileSync(join(extracted, "package.json"), "utf-8")) as Record<
        string,
        unknown
      >;
      const differing = Object.keys(canonical).filter(
        (key) => JSON.stringify(canonical[key]) !== JSON.stringify(shipped[key])
      );
      expect(differing).toEqual(["version"]);
      expect(shipped.version).not.toBe(originalVersion);
    },
    TIER_C_TIMEOUT
  );
});

describe("PMF-02.3 — entry #24 survives a real registry install", () => {
  // `npm-normalize-package-bin` is a known rewriter and this package HAS a `bin` field, so
  // the install boundary is a genuinely different question from the pack boundary. A
  // mismatch here is a real finding, not a broken test.
  it(
    "entry #24 recomputes correctly against the INSTALLED package.json",
    () => {
      const consumer = temporaryRoot("pmf-consumer-");
      writeFileSync(
        join(consumer, "package.json"),
        `${JSON.stringify(
          { name: "pmf-consumer", version: "0.0.0", private: true, type: "module" },
          null,
          2
        )}\n`
      );

          run("npm", ["install", "--ignore-scripts", tarballPath], consumer);

      const installedPackageJson = join(consumer, "node_modules", PACKAGE_NAME, "package.json");
      const installedManifest = JSON.parse(
        readFileSync(join(consumer, "node_modules", PACKAGE_NAME, MANIFEST_RELATIVE_PATH), "utf-8")
      ) as RunnerManifest;

      expect(installedManifest.files.length).toBe(EXPECTED_RECORD_COUNT);
      const entry24 = entryTwentyFour(installedManifest);
      expect(entry24.path).toBe("package.json");
      expect(hashFile(installedPackageJson)).toBe(entry24.sha256);
    },
    TIER_C_TIMEOUT
  );

  it(
    "every other installed digest holds too, so #24 is not passing alone",
    () => {
      const consumer = temporaryRoot("pmf-consumer-full-");
      writeFileSync(
        join(consumer, "package.json"),
        `${JSON.stringify(
          { name: "pmf-consumer-full", version: "0.0.0", private: true, type: "module" },
          null,
          2
        )}\n`
      );

          run("npm", ["install", "--ignore-scripts", tarballPath], consumer);

      const installedRoot = join(consumer, "node_modules", PACKAGE_NAME);
      const installedManifest = JSON.parse(
        readFileSync(join(installedRoot, MANIFEST_RELATIVE_PATH), "utf-8")
      ) as RunnerManifest;

      const mismatched = installedManifest.files.filter(
        (record) => hashFile(join(installedRoot, record.path)) !== record.sha256
      );
      expect(installedManifest.files.length).toBe(EXPECTED_RECORD_COUNT);
      expect(mismatched.map((record) => record.path)).toEqual([]);
    },
    TIER_C_TIMEOUT
  );
});

describe("R-2 — this harness fails loudly, it never skips", () => {
  // Property 1: ANY non-zero exit becomes a throw carrying the command's own diagnosis.
  // Demonstrated with a missing package.json, which is a local failure on purpose — this
  // test says nothing about registries, and used to imply that it did.
  it("a non-zero exit becomes a throw carrying the command's own output", () => {
    const attempt = (): string => run("npm", ["pack"], temporaryRoot("pmf-loud-"));
    expect(attempt).toThrow(/This test never skips/);
    expect(attempt).toThrow(/ENOENT/);
  });

  it(
    "an unreachable registry fails loudly with a network diagnosis, never a skip",
    () => {
      const consumer = temporaryRoot("pmf-deadreg-");
      writeFileSync(
        join(consumer, "package.json"),
        `${JSON.stringify({ name: "pmf-deadreg", version: "0.0.0", private: true }, null, 2)}\n`
      );
      // `npm pack` never contacts a registry — verified: against a dead one it still emits a
      // tarball. Only resolution during `install` reaches the network, so this is the ONLY
      // invocation that can exercise the property criterion 5 names.
      const attempt = (): string =>
        run(
          "npm",
          [
            "install",
            "--ignore-scripts",
            "--registry",
            DEAD_REGISTRY,
            "--fetch-retries=0",
            "--fetch-timeout=3000",
            tarballPath,
          ],
          consumer
        );
      expect(attempt).toThrow(/ECONNREFUSED/);
      expect(attempt).toThrow(/This test never skips/);
    },
    TIER_C_TIMEOUT
  );

  // Guards the NEXT editor, not this one: when this harness flakes on a bad network the
  // cheap fix is a conditional skip, and that is the one change that would make the suite
  // green while deleting the only coverage of the production install path.
  it("declares no conditional skip in executable code", () => {
    const executable = readFileSync(
      join(PROJECT_ROOT, "test/e2e/runner-manifest-packaged.e2e.test.ts"),
      "utf-8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    // Assembled rather than written literally, so the pattern cannot match its own source.
    const conditionalSkip = new RegExp(`\\b(?:it|test|describe)\\.${"skip"}`);

    expect(conditionalSkip.test(executable)).toBe(false);
    // Non-vacuity: the same pattern must fire on a planted sample.
    expect(conditionalSkip.test(`it.${"skip"}If(offline)("x", () => {});`)).toBe(true);
  });
});
