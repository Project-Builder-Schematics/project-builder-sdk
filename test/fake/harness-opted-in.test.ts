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
 * **Executor note — ATH-11.2/ATH-17.3 predicate widened beyond the design §4.6b literal
 * text**: §4.6b's event-allowlist predicate names only "the `node:fs` read events whose
 * resolved target path equals `<packageDir>/schema.json`" as observed-not-flagged.
 * Investigating the ACTUAL merged discovery surface shows `defineFactory`'s opted-in
 * branch (`src/core/context.ts`) makes THREE unconditional `node:fs`-family reads, in
 * order, all BEFORE `als.run`: the `collection.json` ancestor-walk probe
 * (`existsSync`), the reserved-lifecycle-name scan (`readdirSync`), then the schema read
 * (`readFileSync`). All three are the factory's own declared opted-in behaviour (REQ-ATH-11's
 * carve-out) — neither is harness machinery, neither is optional, and an author cannot opt
 * out of one without the others (`options.packageDir !== undefined` gates all three
 * identically). The predicate below therefore allows all three resolved paths rather than
 * the single path §4.6b's prose names. Every OTHER surface (net, Bun I/O, fetch, env/argv
 * gets, and any OTHER fs call) still fails closed, per the design's fail-closed guarantee.
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, AuthoringError } from "../../src/commons/index.ts";
import { instrumentHarnessIO, type IoEvent } from "../support/harness-io-instrumentation.ts";

const FIXTURE_DIR = join(import.meta.dir, "../fixtures/harness-opted-in");
const SCHEMA_PATH = join(FIXTURE_DIR, "schema.json");
// ADR-0046 (schematic-local-files): the pre-`als.run` packageRoot ceiling walk
// (`resolvePackageRoot`, `src/core/context.ts`) adds a THIRD unconditional, factory-own
// declared read — `existsSync(<packageDir>/collection.json)` — alongside the reserved-name
// scan and the schema read below. The fixture's own `collection.json` marker means the walk
// resolves on its FIRST probe, at `packageDir` itself.
const COLLECTION_JSON_PATH = join(FIXTURE_DIR, "collection.json");

// The ONLY node:fs events an opted-in factory's OWN declared behaviour is allowed to
// produce — the reserved-lifecycle-name directory scan of `<packageDir>` itself, the
// containment-ceiling probe of `<packageDir>/collection.json`, and the schema read of
// `<packageDir>/schema.json`.
function isDeclaredOptedInRead(event: IoEvent): boolean {
  if (event.surface !== "node:fs") return false;
  if (event.key === "readdirSync") return event.arg === FIXTURE_DIR;
  if (event.key === "readFileSync") return event.arg === SCHEMA_PATH;
  if (event.key === "existsSync") return event.arg === COLLECTION_JSON_PATH;
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

      // Mutation-resistant: proves existsSync/readFileSync/readdirSync ALL actually fired
      // against the package directory — a mutant that silently drops the forwarded
      // `packageDir` (passing `undefined` through) would leave this list empty.
      const declaredFsEvents = instrumentation.events().filter(isDeclaredOptedInRead);
      expect(declaredFsEvents.map((event) => event.key).sort()).toEqual([
        "existsSync",
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
