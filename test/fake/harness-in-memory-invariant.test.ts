/**
 * REQ-ATH-11.1 (S-002): the in-memory-only invariant, scoped to HARNESS MACHINERY —
 * `runFactoryForTest` itself, the fake, the spy-recording wrapper, and the seeding path —
 * which MUST NEVER touch the filesystem, network, environment variables, or `process.argv`.
 *
 * Concrete instrumentation (design §4.6b): call-interception spies on `node:fs`, `node:net`,
 * Bun-native I/O (`Bun.write`/`file`/`spawn`/`$`/`connect`), and global `fetch`; Proxy GET
 * traps on `process.env`/`process.argv`. Spies stay armed for the run's FULL duration and
 * call through to the real implementation (pass-through) — this test observes, never
 * disables, the platform.
 *
 * `node:fs`/`node:net` are instrumented BLANKET (every function-typed export), not a
 * curated name subset — the invariant governs "any I/O", and a hand-picked list would
 * silently stop covering a method nobody remembered to add. Bun-native I/O and `fetch`
 * are named individually, matching design §4.6b's own enumeration.
 *
 * REQ-ATH-11.2 (S-002, bare-factory-migration): a `packageDir`-opted-in factory run via
 * `runFactoryForTest(fn, input, { packageDir })` legitimately performs its own declared
 * disk reads (reserved-name scan, `schema.json`) — observed, never flagged. This file
 * asserts the ZERO-events floor for the non-opted-in path (REQ-ATH-11.1); the opted-in
 * positive fs-read oracle (REQ-ATH-17.3) lives in `harness-opted-in.test.ts`, alongside
 * this same invariant's other opted-in scenarios.
 *
 * REQ-ATH-14 (bare-factory-migration, `author-test-harness` spec delta): widens the
 * carve-out to `scaffold`/`copyIn`/`create({templateFile})` reads performed BY an
 * opted-in factory, PROVIDED the resolved target lies within the run's resolved
 * collection root (`packageRoot`) — by RESOLVED PATH, not by call name (a per-file
 * enumeration would not scale to `scaffold`'s arbitrary file count). Every other surface
 * (net, Bun I/O, fetch, env/argv gets, any disk touch OUTSIDE the collection root, or a
 * read attributable to harness machinery itself) still fails closed — the widened
 * allow-list is scoped EXCLUSIVELY to reads within the collection root, never a blanket
 * exemption.
 */
import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, modify, find, remove, rename, move, copy, scaffold } from "../../src/commons/index.ts";
import { isWithinCeiling } from "../../src/scaffold/containment.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { instrumentHarnessIO, type IoEvent } from "../support/harness-io-instrumentation.ts";

const scratchDir = scratchDirFactory("harness-in-memory-invariant-");

describe("REQ-ATH-11.1 — in-memory-only invariant (harness machinery)", () => {
  it("[permanent-fixture][red-proof] a planted fs read during the run is detected by the instrumentation", async () => {
    const instrumentation = instrumentHarnessIO();
    try {
      // Plants a real node:fs call INSIDE the factory — proves the instrumentation is not
      // vacuous (a broken/no-op spy setup would let this slide through undetected).
      const run = (): void => {
        fs.readFileSync(import.meta.path, "utf-8");
        create("planted.ts", { template: "x", options: {} });
      };

      await runFactoryForTest(run, undefined);

      const fsEvents = instrumentation.events().filter((event) => event.surface === "node:fs");
      expect(fsEvents.length).toBeGreaterThan(0);
      expect(fsEvents.some((event) => event.key === "readFileSync")).toBe(true);
    } finally {
      instrumentation.restore();
    }
  });

  it("REQ-ATH-11.1: every verb against a non-trivial seed touches zero instrumented I/O surfaces and zero env/argv gets", async () => {
    const instrumentation = instrumentHarnessIO();
    try {
      const run = async (): Promise<void> => {
        create("created.ts", { template: "new-content", options: {} });
        const seeded = await find("seeded.ts").read();
        modify("seeded.ts", `${seeded}-modified`);
        remove("to-delete.ts");
        rename("to-rename.ts", "renamed.ts");
        move("to-move.ts", "moved-dir");
        copy("to-copy.ts", "copied.ts");
      };

      const result = await runFactoryForTest(run, undefined, {
        seed: {
          "seeded.ts": "seed-content",
          "to-delete.ts": "x",
          "to-rename.ts": "x",
          "to-move.ts": "x",
          "to-copy.ts": "x",
        },
      });

      expect(result.error).toBeUndefined();
      expect(instrumentation.events()).toEqual([]);
      expect(instrumentation.envGets).toEqual(0);
      expect(instrumentation.argvGets).toEqual(0);
    } finally {
      instrumentation.restore();
    }
  });
});

// The widened predicate (REQ-ATH-14): "by resolved path, not by call name" — any event
// whose first (path-shaped) argument resolves within the run's collection root is
// observed-not-flagged. Deliberately NOT an enumerated per-call-site allow-list (unlike
// `harness-opted-in.test.ts`'s two fixed paths) — `scaffold` walks an arbitrary file count,
// so only a resolved-path PREFIX check scales.
//
// TWO root representations are accepted (same macOS `/var` vs `/private/var` symlink
// distinction `containment.ts` itself has to handle) — some calls (e.g. `existsSync` on the
// `collection.json` ancestor probe) use the LEXICAL `packageDir` join, while others (e.g.
// containment's own `lstatSync`/`realpathSync`) resolve into REAL space. Never mixing a
// lexical arg against only a real root (or vice versa) would false-flag legitimate reads.
// The membership comparison itself is the production `isWithinCeiling` (segment-aware,
// platform case-fold) — the dual-root LIST stays this test's own concern.
function isWithinCollectionRoot(event: IoEvent, roots: readonly string[]): boolean {
  if (typeof event.arg !== "string") return false;
  return roots.some((root) => isWithinCeiling(event.arg as string, root));
}

describe("REQ-ATH-14 — in-memory-only invariant carve-out widened: package-root reads", () => {
  it("REQ-ATH-14.1: a factory's own scaffold reads within the collection root are observed, not flagged", async () => {
    const dir = scratchDir(); // marker seeded directly at dir — dir IS the collection root
    mkdirSync(join(dir, "files"), { recursive: true });
    writeFileSync(join(dir, "files", "a.ts"), "export const a = 1;", "utf-8");
    const roots = [dir, realpathSync(dir)];

    const instrumentation = instrumentHarnessIO();
    try {
      const run = (): void => {
        scaffold({ from: "files", to: "out" });
      };

      const result = await runFactoryForTest(run, undefined, { packageDir: dir });

      expect(result.error).toBeUndefined();

      const fsEvents = instrumentation.events().filter((event) => event.surface === "node:fs");
      // Sanity: scaffold DID perform real reads — a vacuous/broken rig would pass trivially.
      expect(fsEvents.length).toBeGreaterThan(0);

      const outsideRoot = fsEvents.filter((event) => !isWithinCollectionRoot(event, roots));
      expect(outsideRoot).toEqual([]);

      const otherSurfaceEvents = instrumentation.events().filter((event) => event.surface !== "node:fs");
      expect(otherSurfaceEvents).toEqual([]);
      expect(instrumentation.envGets).toEqual(0);
      expect(instrumentation.argvGets).toEqual(0);
    } finally {
      instrumentation.restore();
    }
  });

  it("REQ-ATH-14.2: a read attributable to harness machinery outside the collection root still trips the invariant", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"), { recursive: true });
    writeFileSync(join(dir, "files", "a.ts"), "export const a = 1;", "utf-8");
    const roots = [dir, realpathSync(dir)];

    const instrumentation = instrumentHarnessIO();
    try {
      const run = (): void => {
        // Simulates a read attributable to harness/test machinery, not the factory's own
        // declared scaffold/copyIn behaviour — deliberately OUTSIDE the collection root
        // (this test file's own source, unrelated to the scratch package dir).
        fs.readFileSync(import.meta.path, "utf-8");
        scaffold({ from: "files", to: "out" });
      };

      await runFactoryForTest(run, undefined, { packageDir: dir });

      const outsideRoot = instrumentation.events().filter(
        (event) => event.surface === "node:fs" && !isWithinCollectionRoot(event, roots)
      );
      // The widened allow-list covers ONLY factory-attributable, within-collection-root
      // reads — a harness-machinery-shaped read outside the root must still surface.
      expect(outsideRoot.some((event) => event.key === "readFileSync")).toBe(true);
    } finally {
      instrumentation.restore();
    }
  });
});
