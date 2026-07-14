/**
 * Shared scratch-consumer seam (design §4.1 "de-forking rather than duplicating", ADR-0041):
 * build → pack/install (tarball leg) OR build → link (bun-link leg), plus the
 * `runScratchScript` helper both legs use to probe the installed/linked package from a
 * REAL consumer's own vantage — an `import(...)` BY PACKAGE NAME inside a small `.mjs`
 * script run in the scratch dir, never a relative `dist` path (a relative import never
 * exercises the `exports` map — the exact gap this whole seam exists to close).
 *
 * Extracted from `test/e2e/installed-consumer.e2e.test.ts` (S-000.1) — that file, the
 * docs-as-test machine leg (S-003), and any future consumer-vantage vehicle share this ONE
 * module instead of each re-deriving build/pack/install/link plumbing.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ensureTscBuild } from "./shared-build.ts";

export const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

export function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function cleanScratchDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Writes `source` as `fileName` inside `dir` and runs it with `bun run <fileName>`,
 * `cwd: dir` — so its imports resolve through the SCRATCH consumer's own `node_modules`,
 * never the repo's `src`. Returns stdout; throws (with stdout+stderr) on a non-zero exit.
 */
export function runScratchScript(dir: string, fileName: string, source: string): string {
  writeFileSync(join(dir, fileName), source);
  const result = spawnSync("bun", ["run", fileName], { cwd: dir, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`scratch consumer script "${fileName}" failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

export function parseLastJsonLine(stdout: string): unknown {
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1] ?? "");
}

// --- Tarball leg: build -> bun pm pack -> bun install (ADR-0036) --------------------------

let repoLockfileHashBefore: string | undefined;
// Keyed BY `scratchDir` (S-003 fix) — a single module-level promise silently ignored the
// `scratchDir` argument on a cache hit, so a SECOND caller with a DIFFERENT scratch dir
// would reuse the first caller's setup instead of getting its own (latent since S-000, only
// ONE caller ever existed until this seam gained a second consumer).
const packedConsumersReady = new Map<string, Promise<void>>();

/**
 * Builds, packs the built package into a real tarball, and `bun install`s it into
 * `scratchDir` as a `file:` dependency — at most ONCE per `scratchDir` per process
 * (memoized, keyed by dir). Captures the REPO's own lockfile hash immediately before the
 * scratch install so callers can assert it never changed (SEC-m2 — the scratch install must
 * never touch the repo's lockfile).
 */
export function ensurePackedConsumer(scratchDir: string): Promise<void> {
  const cached = packedConsumersReady.get(scratchDir);
  if (cached !== undefined) {
    return cached;
  }

  const ready = (async () => {
    ensureTscBuild();
    repoLockfileHashBefore = hashFile(join(PROJECT_ROOT, "bun.lock"));

    cleanScratchDir(scratchDir);
    mkdirSync(scratchDir, { recursive: true });

    const packResult = spawnSync(
      "bun",
      ["pm", "pack", "--destination", scratchDir, "--quiet"],
      { cwd: PROJECT_ROOT, encoding: "utf-8" }
    );
    if (packResult.status !== 0) {
      throw new Error(`bun pm pack failed:\n${packResult.stdout}\n${packResult.stderr}`);
    }
    const tarballPath = packResult.stdout.trim();
    if (!existsSync(tarballPath)) {
      throw new Error(`bun pm pack did not produce a tarball at ${tarballPath}`);
    }

    writeFileSync(
      join(scratchDir, "package.json"),
      JSON.stringify(
        {
          name: "installed-consumer-scratch",
          version: "0.0.0",
          private: true,
          type: "module",
          dependencies: { "@pbuilder/sdk": `file:${tarballPath}` },
        },
        null,
        2
      )
    );

    // `--ignore-scripts` (SEC-m2): blocks lifecycle-script network egress — the actual
    // supply-chain guard. The registry is left at its ambient default (not forced
    // non-routable) because the `file:` dependency's own `ts-morph` dependency needs it.
    const installResult = spawnSync("bun", ["install", "--ignore-scripts"], {
      cwd: scratchDir,
      encoding: "utf-8",
      env: process.env,
    });
    if (installResult.status !== 0) {
      throw new Error(`scratch bun install failed:\n${installResult.stdout}\n${installResult.stderr}`);
    }
  })();

  packedConsumersReady.set(scratchDir, ready);
  return ready;
}

/**
 * The repo's own `bun.lock` hash, captured immediately before `ensurePackedConsumer`'s
 * scratch install ran. Throws if `ensurePackedConsumer` has not been awaited yet.
 */
export function repoLockfileHashAtPackTime(): string {
  if (repoLockfileHashBefore === undefined) {
    throw new Error("repoLockfileHashAtPackTime: ensurePackedConsumer() has not run yet");
  }
  return repoLockfileHashBefore;
}

// --- Bun-link leg: `bun run link:sdk` (build + bun link) -> bun link @pbuilder/sdk --------

let producerLinked: Promise<void> | undefined;
// Keyed BY `scratchDir` (S-003 fix, same shape as `packedConsumersReady` above) — MULTIPLE
// test files each own a DIFFERENT bun-link scratch consumer sharing this ONE global producer
// registration; a single module-level promise used to ignore `scratchDir` on a cache hit, so
// a second caller silently reused the first caller's dir instead of getting its own.
const linkedConsumersReady = new Map<string, Promise<void>>();

/**
 * Runs `bun run link:sdk` (ADR-0041) — `bun run build` then `bun link`, registering the
 * package in Bun's GLOBAL link store. Memoized ONCE per "linked" epoch, but the memo is
 * RESET by `unlinkSdk()` below: whichever test file's `afterAll` tears the global
 * registration down first must not strand a LATER file (still mid-suite) that calls
 * `ensureLinkedConsumer` afterward expecting the registration to still exist.
 */
function ensureProducerLinked(): Promise<void> {
  if (producerLinked !== undefined) {
    return producerLinked;
  }

  producerLinked = (async () => {
    const linkSdkResult = spawnSync("bun", ["run", "link:sdk"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
    if (linkSdkResult.status !== 0) {
      throw new Error(`bun run link:sdk failed:\n${linkSdkResult.stdout}\n${linkSdkResult.stderr}`);
    }
  })();

  return producerLinked;
}

/**
 * Ensures `scratchDir` is a `bun link @pbuilder/sdk`-consuming scratch consumer — at most
 * ONCE per `scratchDir` per process (memoized, keyed by dir — see the Map comment above).
 * Callers MUST pair this with `unlinkSdk()` in an `afterAll` to release the global
 * registration (the consumer's own local reference is released when `scratchDir` itself is
 * removed).
 */
export function ensureLinkedConsumer(scratchDir: string): Promise<void> {
  const cached = linkedConsumersReady.get(scratchDir);
  if (cached !== undefined) {
    return cached;
  }

  const ready = (async () => {
    await ensureProducerLinked();

    cleanScratchDir(scratchDir);
    mkdirSync(scratchDir, { recursive: true });

    writeFileSync(
      join(scratchDir, "package.json"),
      JSON.stringify(
        { name: "linked-consumer-scratch", version: "0.0.0", private: true, type: "module" },
        null,
        2
      )
    );

    const linkResult = spawnSync("bun", ["link", "@pbuilder/sdk"], { cwd: scratchDir, encoding: "utf-8" });
    if (linkResult.status !== 0) {
      throw new Error(`bun link @pbuilder/sdk failed:\n${linkResult.stdout}\n${linkResult.stderr}`);
    }
  })();

  linkedConsumersReady.set(scratchDir, ready);
  return ready;
}

/**
 * Releases the GLOBAL link-store registration `ensureProducerLinked` created (ADR-0041's
 * global-link-store hygiene note) AND resets the producer memo, so a LATER caller (a
 * different test file, still mid-suite) re-establishes it rather than silently relying on a
 * torn-down registration. Call from `afterAll`. Best-effort: a failure here means the
 * registration was already absent, not a test failure.
 */
export function unlinkSdk(): void {
  spawnSync("bun", ["unlink"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  producerLinked = undefined;
}
