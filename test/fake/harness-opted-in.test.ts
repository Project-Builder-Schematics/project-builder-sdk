/**
 * REQ-ATH-17 (S-002, bare-factory-migration): a `packageDir`-opted-in factory run via
 * `runFactoryForTest(fn, input, { packageDir })` — the harness needs ZERO production code
 * change beyond what S-000 already shipped (design §4.3's explicit claim): `packageDir`
 * simply moves from `defineFactory`'s own call site into `runFactoryForTest`'s options bag.
 *
 * REQ-ATH-13 (schema-invalid/valid rejection through the harness) was REPEALED by spec V2
 * — the migration structurally inverts its "packageDir lives in the factory's definition"
 * premise. The observable guarantee it protected relocates to REQ-ATH-17.1/.2 (executed,
 * pinned in `test/fake/harness-options-bag.test.ts`, S-000); this file keeps the additional
 * input-shape variety below as plain regression coverage of the SAME REQ-ATH-17 guarantee,
 * not a second, independent REQ.
 *
 * **`inline-collection-marker` S-000.2 (REQ-MFB-01, REQ-RBV-06.2)**: the pre-`als.run`
 * `collection.json` ancestor-walk probe (`existsSync`) is DELETED — `packageDir` is now the
 * SOLE run anchor. The bootstrap read-set shrinks from THREE reads to exactly TWO, in a
 * PINNED ORDER: the reserved-lifecycle-name scan (`readdirSync`) FIRST, then the schema read
 * (`readFileSync`). Both are the factory's own declared opted-in behaviour (REQ-ATH-11's
 * carve-out) — neither is harness machinery, neither is optional. Every OTHER surface (net,
 * Bun I/O, fetch, env/argv gets, and any OTHER fs call) still fails closed, per the design's
 * fail-closed guarantee.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { join } from "node:path";
import * as fs from "node:fs";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, AuthoringError } from "../../src/commons/index.ts";
import { instrumentHarnessIO, type IoEvent } from "../support/harness-io-instrumentation.ts";

const FIXTURE_DIR = join(import.meta.dir, "../fixtures/harness-opted-in");
const SCHEMA_PATH = join(FIXTURE_DIR, "schema.json");

// The ONLY node:fs events an opted-in factory's OWN declared behaviour is allowed to
// produce — the reserved-lifecycle-name directory scan of `<packageDir>` itself, and the
// schema read of `<packageDir>/schema.json`. No THIRD (containment-ceiling) probe exists.
function isDeclaredOptedInRead(event: IoEvent): boolean {
  if (event.surface !== "node:fs") return false;
  if (event.key === "readdirSync") return event.arg === FIXTURE_DIR;
  if (event.key === "readFileSync") return event.arg === SCHEMA_PATH;
  return false;
}

describe("REQ-ATH-17.3 — positive fs-read oracle proves packageDir was actually forwarded", () => {
  it("only the declared opted-in reads are allowed; every other surface stays zero", async () => {
    const instrumentation = instrumentHarnessIO();
    try {
      const run = (): void => {
        create("server.config.ts", { template: "static content", options: {} });
      };

      const result = await runFactoryForTest(run, { port: 8080 }, { packageDir: FIXTURE_DIR });

      expect(result.error).toBeUndefined();

      const undeclaredFsEvents = instrumentation.events().filter(
        (event) => event.surface === "node:fs" && !isDeclaredOptedInRead(event)
      );
      expect(undeclaredFsEvents).toEqual([]);

      // Mutation-resistant: proves readFileSync/readdirSync BOTH actually fired against
      // the package directory — a mutant that silently drops the forwarded `packageDir`
      // (passing `undefined` through) would leave this list empty.
      const declaredFsEvents = instrumentation.events().filter(isDeclaredOptedInRead);
      expect(declaredFsEvents.map((event) => event.key).sort()).toEqual([
        "readFileSync",
        "readdirSync",
      ]);

      const otherSurfaceEvents = instrumentation.events().filter((event) => event.surface !== "node:fs");
      expect(otherSurfaceEvents).toEqual([]);
      expect(instrumentation.envGets).toEqual(0);
      expect(instrumentation.argvGets).toEqual(0);
    } finally {
      instrumentation.restore();
    }
  });
});

describe("REQ-RBV-06.2 — the two-read bootstrap set fires in a pinned order: reserved-name scan, then schema read", () => {
  it("readdirSync (reserved-name scan) is called before readFileSync (schema read), never the reverse", async () => {
    // Records call ORDER across two different fs functions — `instrumentHarnessIO`'s
    // `events()` groups by spy (function identity), which cannot reconstruct
    // cross-function chronology; a direct pass-through wrapper with a shared `order`
    // array can.
    const order: string[] = [];
    const originalReaddirSync = fs.readdirSync;
    const originalReadFileSync = fs.readFileSync;
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(((...args: Parameters<typeof fs.readdirSync>) => {
      order.push("readdirSync");
      return (originalReaddirSync as (...a: Parameters<typeof fs.readdirSync>) => ReturnType<typeof fs.readdirSync>)(...args);
    }) as typeof fs.readdirSync);
    const readFileSpy = spyOn(fs, "readFileSync").mockImplementation(((...args: Parameters<typeof fs.readFileSync>) => {
      order.push("readFileSync");
      return (originalReadFileSync as (...a: Parameters<typeof fs.readFileSync>) => ReturnType<typeof fs.readFileSync>)(...args);
    }) as typeof fs.readFileSync);

    try {
      const run = (): void => {
        create("server.config.ts", { template: "static content", options: {} });
      };

      const result = await runFactoryForTest(run, { port: 8080 }, { packageDir: FIXTURE_DIR });

      expect(result.error).toBeUndefined();
      const firstReaddirIndex = order.indexOf("readdirSync");
      const firstReadFileIndex = order.indexOf("readFileSync");
      expect(firstReaddirIndex).toBeGreaterThanOrEqual(0);
      expect(firstReadFileIndex).toBeGreaterThanOrEqual(0);
      expect(firstReaddirIndex).toBeLessThan(firstReadFileIndex);
    } finally {
      readdirSpy.mockRestore();
      readFileSpy.mockRestore();
    }
  });
});

describe("REQ-ATH-17 — packageDir-opted-in factory support through the harness (regression, additional input-shape coverage over harness-options-bag.test.ts's S-000 pins)", () => {
  it("schema-invalid input rejects all-or-nothing via result.error", async () => {
    const run = (): void => {
      create("server.config.ts", { template: "static content", options: {} });
    };

    const result = await runFactoryForTest(run, {}, { packageDir: FIXTURE_DIR });

    expect(result.tree.size).toEqual(0);
    expect(result.emitted).toEqual([]);
    expect(result.error).toBeInstanceOf(AuthoringError);
    const err = result.error as AuthoringError;
    expect(err.reason).toEqual("invalid-input");
    expect(err.origin).toEqual("authoring-rejected");
    expect(err.message).toEqual("invalid input: port must be number");
  });

  it("schema-valid input runs the opted-in factory normally", async () => {
    const run = (input: { port: number }): void => {
      create("server.config.ts", {
        template: "export const port = {{port}};",
        options: { port: input.port },
      });
    };

    const result = await runFactoryForTest(run, { port: 8080 }, { packageDir: FIXTURE_DIR });

    // Template placeholders survive unrendered (REQ-ATH-10) — this asserts the run
    // COMMITTED, indistinguishable from REQ-ATH-01.1's non-opted-in happy path, not that
    // the SDK interpolates `{{port}}` itself (it never does; the engine renders templates).
    expect(result.tree.get("server.config.ts")).toEqual("export const port = {{port}};");
    expect(result.error).toBeUndefined();
  });
});
