// REQ-SEC-07 (ADR-05): the single-instance realpath probe. The resolution MECHANISM
// (`createRequire(...).resolve`, resolution-only) is proven against REAL fixtures — a
// planted top-level throw in a mismatched "@pbuilder/sdk" copy proves SEC-07.3 directly
// rather than by inspection. The MATCH comparison uses the injectable `resolveSpecifier`
// seam: this repo's own `package.json` has no CJS-`require`-resolvable `exports`
// condition (verified empirically), so it cannot serve as a synthetic "same package"
// fixture for the real resolver — injection lets the COMPARISON logic (real
// `packageRootFor` + real equality) be tested honestly without that orthogonal problem.

import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { probeSingleInstance } from "../../src/transport/single-instance-probe.ts";

describe("REQ-SEC-07 — single-instance realpath probe", () => {
  it("Scenario REQ-SEC-07.1: matching SDK copies proceed — the factory's resolved @pbuilder/sdk lands in the SAME package root as the runner's own", () => {
    // The injected resolver returns a real file inside THIS repo's own src/ tree — the
    // runner's own package root (computed for real, by walking up from
    // single-instance-probe.ts's own location) and the "factory's resolved" root (walking
    // up from this injected file) are the SAME real directory, proving the comparison
    // itself, independent of how the specifier was resolved (that mechanism is proven for
    // real below, in the split/unresolvable cases).
    const anyFileInThisRepo = fileURLToPath(import.meta.url);
    const result = probeSingleInstance("file:///irrelevant/anchor/factory.ts", () => anyFileInThisRepo);
    expect(result).toEqual({ ok: true });
  });

  describe("Scenario REQ-SEC-07.2/.3: a split SDK copy", () => {
    let dirs: string[] = [];

    afterEach(() => {
      for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
      dirs = [];
    });

    // Builds a factory anchor OUTSIDE this repo with its OWN node_modules/@pbuilder/sdk —
    // a genuinely different package instance than the one the runner ships as. The
    // package's `index.js` throws at top level: if `probeSingleInstance` ever IMPORTS
    // (rather than merely resolves) this file, that throw surfaces and the test fails for
    // the wrong reason — direct, real proof of SEC-07.3's resolution-only claim.
    function buildSplitFixture(): string {
      const dir = mkdtempSync(join(tmpdir(), "single-instance-probe-"));
      dirs.push(dir);
      const sdkDir = join(dir, "node_modules", "@pbuilder", "sdk");
      mkdirSync(sdkDir, { recursive: true });
      writeFileSync(
        join(sdkDir, "package.json"),
        JSON.stringify({ name: "@pbuilder/sdk", version: "0.0.0", main: "index.js" })
      );
      writeFileSync(
        join(sdkDir, "index.js"),
        'throw new Error("factory SDK copy top-level code executed — SEC-07.3 violated");'
      );
      writeFileSync(join(dir, "factory.ts"), "export default function factory() {}\n");
      return `file://${dir}/factory.ts`;
    }

    it("REQ-SEC-07.2: split SDK copies fail the greeting, naming both paths PROJECT-RELATIVE (never absolute)", () => {
      const factoryUrl = buildSplitFixture();
      const result = probeSingleInstance(factoryUrl);
      expect(result.ok).toBe(false);
      const message = (result as { ok: false; message: string }).message;
      // "project-relative" means expressed AS a `../`-relative (or `<outside-project>`)
      // path, never that the path's own segment names vanish — on POSIX, path.relative
      // between two absolute paths under different roots still embeds the target's own
      // directory names after the `../` traversal (error-text.ts's own documented
      // limitation). The real invariant under test: no ABSOLUTE path (a bare leading "/")
      // is ever embedded in parens.
      expect(message).not.toMatch(/\(\//);
      expect(message.length).toBeGreaterThan(0);
    });

    it("REQ-SEC-07.3: the probe is resolution-only — it never executes the mismatched copy's top-level code, and completes without throwing", () => {
      const factoryUrl = buildSplitFixture();
      expect(() => probeSingleInstance(factoryUrl)).not.toThrow();
      expect(probeSingleInstance(factoryUrl).ok).toBe(false);
    });
  });

  it("self-contained fallback: a factory that lives INSIDE this SDK's own package tree (this project's own dogfooding fixture shape) matches via the REAL default resolver, with no injection", () => {
    // The default (real, uninjected) resolver: createRequire's self-reference gap makes
    // "@pbuilder/sdk" unresolvable from a factory anchored inside this repo's own tree —
    // the fallback in probeSingleInstance recovers by checking whether the factory's own
    // nearest package.json ancestor already IS the runner's package root. This is the
    // EXACT shape `test/fixtures/frame-runner/**` factories are in (this repo dogfoods
    // itself as the SDK it ships) — the runner's real happy-path e2e/integration tests
    // depend on this fallback firing correctly.
    const anchor = new URL("../fixtures/frame-runner/happy/factory.ts", import.meta.url).href;
    expect(probeSingleInstance(anchor)).toEqual({ ok: true });
  });

  it("a factory anchor whose @pbuilder/sdk cannot be resolved at all still fails closed with a message, never throws (defensive — no dedicated REQ scenario, but SEC-07's 'never crash' posture mirrors SEC-04's)", () => {
    const dir = mkdtempSync(join(tmpdir(), "single-instance-probe-unresolvable-"));
    try {
      writeFileSync(join(dir, "factory.ts"), "export default function factory() {}\n");
      const result = probeSingleInstance(`file://${dir}/factory.ts`);
      expect(result.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
