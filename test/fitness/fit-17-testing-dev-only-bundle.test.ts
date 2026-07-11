/**
 * FIT-17 (new, ADR-0034 guard 1): dev-only bundle containment. The `CONTRACT_FAKE_PREFIX`
 * literal — the normative fake's own message-fragment marker — MUST be ABSENT from the
 * minified production bundles of `.`, `./commons`, `./conformance`, and (mandatory positive
 * control) PRESENT in the `./testing` bundle. Both halves matter: an absence-only guard could
 * pass by accident (e.g. the fake never building at all); the presence check proves the scan
 * mechanism actually detects the literal when it should.
 *
 * The literal is imported from `rejection-messages.ts`'s `CONTRACT_FAKE_PREFIX` export
 * (REQ-TES-04.4) — never re-hardcoded here, so this guard and FIT-11's leak dictionary can
 * never silently drift apart.
 *
 * Bundled entries are the `src/` entry files (FIT-03 idiom, SEC-m1): equivalence with dist
 * holds because tsc emits `dist/` 1:1 per-module (no bundling), so the `src` import graph IS
 * the `dist` import graph `bun build` resolves. `package.json` declaring no `sideEffects`
 * field is a recorded assumption this equivalence depends on — asserted here.
 *
 * [permanent-fixture]: this file's positive control (REQ-TES-04.2) stays in the suite
 * forever — it is what proves the absence checks are not passing by accident.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTRACT_FAKE_PREFIX } from "../../src/testing/rejection-messages.ts";
import { ensureMinifiedEntry } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;

const PRODUCTION_ENTRIES = ["src/index.ts", "src/commons/index.ts", "src/conformance/index.ts"];
const TESTING_ENTRY = "src/testing/index.ts";

/** Scans actual bundle OUTPUT content for the fake's marker literal — never the exports map. */
function bundleContainsFakeLiteral(bundleOutput: string): boolean {
  return bundleOutput.includes(CONTRACT_FAKE_PREFIX);
}

describe("FIT-17 — dev-only bundle containment: fake text absent from production, present in ./testing", () => {
  for (const entry of PRODUCTION_ENTRIES) {
    it(`REQ-TES-04.1: ${entry} minified bundle does not contain the fake literal`, () => {
      const { output } = ensureMinifiedEntry(entry);
      expect(bundleContainsFakeLiteral(output)).toBe(false);
    });
  }

  // [permanent-fixture] Mandatory positive control — proves the absence checks above are not
  // passing by accident (e.g. the fake never building into any bundle at all).
  it("[permanent-fixture] REQ-TES-04.2: ./testing minified bundle DOES contain the fake literal", () => {
    const { output } = ensureMinifiedEntry(TESTING_ENTRY);
    expect(bundleContainsFakeLiteral(output)).toBe(true);
  });

  it("[red-proof] REQ-TES-04.3: a conditional-exports-routed bundle still carrying the literal is caught", () => {
    // Simulated minified-bundle STRING (never a real production entry) — proves the scan
    // reads actual bundle OUTPUT content, so a conditional (fail-open) exports routing that
    // still bundles the fake into a production entry cannot evade it.
    const fixtureBundleOutput = `var a=1;function b(){return"${CONTRACT_FAKE_PREFIX} already exists"}module.exports=b;`;
    expect(bundleContainsFakeLiteral(fixtureBundleOutput)).toBe(true);
  });

  it("REQ-TES-04.4: the scanned literal is sourced structurally from rejection-messages.ts, not hardcoded", () => {
    const selfSource = readFileSync(import.meta.path, "utf-8");
    const hasStructuralImport =
      /import\s*\{\s*CONTRACT_FAKE_PREFIX\s*\}\s*from\s*["'][^"']*rejection-messages\.ts["']/.test(selfSource);
    expect(hasStructuralImport).toBe(true);

    // A hardcoded duplicate of the literal's own quoted value would drift silently — assert
    // it never appears as a separate string constant in this file.
    const quotedLiteralPattern = new RegExp(`["']${CONTRACT_FAKE_PREFIX}["']`);
    expect(quotedLiteralPattern.test(selfSource)).toBe(false);
  });

  it("package.json declares no sideEffects field (bundler tree-shaking equivalence assumption, SEC-m1)", () => {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as Record<string, unknown>;
    expect(pkg.sideEffects).toBeUndefined();
  });
});
