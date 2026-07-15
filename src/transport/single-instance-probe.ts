// REQ-SEC-07 (ADR-05): at handshake time, before the factory import proceeds, compares the
// runner's OWN resolved `@pbuilder/sdk` package root against the one the factory's module
// graph resolves to — a consistency check for the module-level ALS single-instance pin
// (`context.ts:74`), never an anti-tamper/supply-chain control (A3, explicitly out of
// scope). Resolution-only: `module.createRequire(anchorUrl).resolve(specifier)` never
// executes the target module's top-level code — a pure specifier->path lookup, satisfying
// SEC-07.3 for real, not by convention.
//
// ADR-05 DEVIATION (discovered building this slice, not guessed): ADR-05 names Bun's
// `import.meta.resolveSync` as primary with `createRequire(...).resolve` as fallback "if
// Bun's import.meta.resolve semantics prove unavailable". Both halves of that premise
// proved true here: (1) `import.meta.resolveSync` is Bun-only and untyped under
// `tsconfig.build.json` (this repo's OWN build-time config types `src/**` against plain
// `"node"`, per the project's Node-type-portable-.d.ts convention — verified by running
// `bun run build`, which fails `tsc -p tsconfig.build.json` on `Property 'resolveSync'
// does not exist on type 'ImportMeta'`); (2) `createRequire(...).resolve` does NOT support
// Node's package self-reference resolution in this Bun version (verified empirically:
// `import.meta.resolveSync("@pbuilder/sdk", anchor)` resolves this repo's own package by
// name via its `exports` map, but `createRequire(anchor).resolve("@pbuilder/sdk")` throws
// "Cannot find module" for the identical anchor) — so it is not a drop-in fallback for the
// self-reference case. Given `import.meta.resolveSync` is unusable at compile time for the
// published source tree regardless, `createRequire` is the SOLE mechanism here — fully
// portable, and correct for the REAL production shape of this check (a factory in a
// consumer project resolving `@pbuilder/sdk` as an ordinary `node_modules` dependency,
// never as a self-reference — self-reference only arose in this repo's OWN dogfooding
// tests, not in any real caller).
import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toProjectRelativePath } from "./error-text.ts";

const SDK_SPECIFIER = "@pbuilder/sdk";

export type SingleInstanceProbeResult = { ok: true } | { ok: false; message: string };

// Resolution-only: never `import()`s the target, only locates it.
function resolveSpecifierPath(specifier: string, anchorUrl: string): string {
  return createRequire(anchorUrl).resolve(specifier);
}

// Walks up from a resolved file to its nearest package.json ancestor, so two resolutions
// landing on DIFFERENT files inside the SAME package (e.g. one via `main`, one via a
// deep-import) still compare equal — the comparison unit is the PACKAGE, not one file.
function packageRootFor(filePath: string): string {
  let dir = dirname(filePath);
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return realpathSync(dir);
    const parent = dirname(dir);
    if (parent === dir) return realpathSync(dirname(filePath));
    dir = parent;
  }
}

// `path.relative(root, root)` is `""` — a project-relative path to the project root
// itself. Rendered as "." for readability; still never an absolute path.
function displayRelative(absolutePath: string): string {
  const relative = toProjectRelativePath(absolutePath);
  return relative === "" ? "." : relative;
}

function splitMessage(runnerRoot: string, factoryRoot: string): string {
  return (
    `single-instance probe: the runner's SDK copy (${displayRelative(runnerRoot)}) and the ` +
    `factory's resolved SDK copy (${displayRelative(factoryRoot)}) are not the same package — ` +
    `a split module graph breaks the single-instance ALS pin`
  );
}

// REQ-SEC-07.3: this module IS part of the runner's own SDK copy — its own on-disk
// location needs no specifier resolution, only a realpath + package-root walk.
function runnerOwnPackageRoot(): string {
  return packageRootFor(fileURLToPath(import.meta.url));
}

/**
 * REQ-SEC-07: probes whether `factoryUrl`'s module graph would resolve the SAME
 * `@pbuilder/sdk` copy the runner itself is. MUST be called BEFORE the factory's dynamic
 * import (RUN-02/RUN-03) proceeds — resolution-only, never executes any of the factory's
 * or the resolved package's top-level code. A resolution failure (the factory's location
 * has no resolvable `@pbuilder/sdk` at all) fails closed the same way a split does — never
 * throws, never guesses a match.
 *
 * `resolveSpecifier` is injectable (mirrors this codebase's `FrameChannel`/`RunnerIo`
 * pattern) — production always uses the default (real `createRequire` resolution); tests
 * override it ONLY where real package resolution has an orthogonal fixture-construction
 * problem (this repo's own `package.json` has no CJS-`require`-resolvable `exports`
 * condition, so it cannot itself be used as a synthetic "same package" fixture). The
 * resolution MECHANISM itself (never executes, genuinely finds real packages) is proven
 * with the REAL default resolver in the split/unresolvable test cases.
 */
export function probeSingleInstance(
  factoryUrl: string,
  resolveSpecifier: (specifier: string, anchorUrl: string) => string = resolveSpecifierPath
): SingleInstanceProbeResult {
  const runnerRoot = runnerOwnPackageRoot();

  let factoryRoot: string;
  try {
    factoryRoot = packageRootFor(resolveSpecifier(SDK_SPECIFIER, factoryUrl));
  } catch (err) {
    // Self-contained fallback: `createRequire` does not resolve a package's OWN name from
    // within itself in this Bun version (the self-reference gap documented above). If the
    // factory's OWN nearest package.json ancestor already IS the runner's package root,
    // there is only ONE copy by construction — no separate specifier resolution can prove
    // more than that. This is the ordinary shape of THIS repo's own dogfooding fixtures
    // (factories living inside @pbuilder/sdk's own source tree); a real external consumer's
    // factory is never inside this package, so it always resolves via the primary path
    // above and never reaches this fallback.
    try {
      if (packageRootFor(fileURLToPath(factoryUrl)) === runnerRoot) return { ok: true };
    } catch {
      // Falls through to the original resolution failure below.
    }
    return {
      ok: false,
      message: `single-instance probe: could not resolve "${SDK_SPECIFIER}" from the factory's location — ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  if (runnerRoot === factoryRoot) return { ok: true };
  return { ok: false, message: splitMessage(runnerRoot, factoryRoot) };
}
