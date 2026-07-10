/**
 * RBV-01/02/03/05 — run-boundary validation matrix (design §4.2/§4.4, S-003). Integration
 * level (design §4.6 Test Derivation): drives `defineFactory` end-to-end against scratch
 * package dirs (mkdtempSync + seedSchema), proving the WIRED boundary — discovery -> parse
 * -> validate -> reject/warn — distinct from `schema-validate.test.ts`'s unit-level direct
 * calls into `validateInput` (which own the exhaustive finding-shape matrix).
 */
import { describe, it, expect, spyOn, afterEach } from "bun:test";
import { mkdtempSync, rmSync, chmodSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { seedSchema } from "../support/canary.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const PORT_SCHEMA = { properties: { port: { type: "number", label: "Port", required: true } } };

let dirs: string[] = [];

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rbv-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    // chmod back to writable/readable so cleanup itself never fails on a locked-down fixture.
    try {
      chmodSync(dir, 0o755);
    } catch {
      // best-effort
    }
    rmSync(dir, { recursive: true, force: true });
  }
  dirs = [];
});

async function runAgainst(packageDir: string, input: unknown): Promise<unknown> {
  const fake = new ContractFake({ seed: {} });
  const run = defineFactory<unknown>(() => {}, { packageDir });
  try {
    await run(input, { client: fake });
    return undefined;
  } catch (err) {
    return err;
  }
}

describe("REQ-RBV-01 — run-boundary validation matrix (site proof samples, wired)", () => {
  it("REQ-RBV-01.2: a wrong-typed value rejects before fn executes", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: "8080" });

    expect(err).toBeInstanceOf(AuthoringError);
    expect((err as Error).message).toEqual("invalid input: port must be number");
    expect((err as AuthoringError).origin).toEqual("authoring-rejected");
    expect((err as AuthoringError).reason).toEqual("invalid-input");
  });

  it("REQ-RBV-01.3: an excess key rejects, naming the excess key", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: 8080, extra: true });

    expect((err as Error).message).toEqual("invalid input: extra is a reserved or disallowed key");
  });

  it("REQ-RBV-01.4: a non-JSON value (function) rejects, naming the declared type never the received kind", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: () => 8080 });

    expect((err as Error).message).toEqual("invalid input: port must be number");
  });

  it("REQ-RBV-01.5: a resolved input key literally named a reserved lifecycle name rejects", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);
    const input = JSON.parse('{"port": 8080, "pre-execute": "x"}');

    const err = await runAgainst(dir, input);

    expect((err as Error).message).toEqual("invalid input: pre-execute is a reserved or disallowed key");
  });

  it("REQ-RBV-01.6 (SEC-B2): a __proto__ input key rejects fail-closed without polluting Object.prototype", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);
    const input = JSON.parse('{"port": 8080, "__proto__": "malicious"}');
    const canaryKey = "rbvWiredCanary";
    (Object.prototype as Record<string, unknown>)[canaryKey] = "seeded";

    try {
      const err = await runAgainst(dir, input);

      expect((err as Error).message).toEqual("invalid input: __proto__ is a reserved or disallowed key");
      expect(({} as Record<string, unknown>)[canaryKey]).toEqual("seeded");
    } finally {
      delete (Object.prototype as Record<string, unknown>)[canaryKey];
    }
  });

  it("REQ-RBV-01.7: null/undefined/empty-string trichotomy — (i) absent and (ii) null both reject, (iii) empty string passes", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const missing = await runAgainst(dir, {});
    expect((missing as Error).message).toEqual("invalid input: port must be number");

    const nullValue = await runAgainst(dir, { port: null });
    expect((nullValue as Error).message).toEqual("invalid input: port must be number");

    const stringDir = scratchDir();
    seedSchema(stringDir, { properties: { name: { type: "string", label: "Name", required: true } } });
    const emptyString = await runAgainst(stringDir, { name: "" });
    expect(emptyString).toBeUndefined();
  });

  it("REQ-RBV-01.8: a template-syntax-looking string value passes through as opaque data", async () => {
    const dir = scratchDir();
    seedSchema(dir, { properties: { name: { type: "string", label: "Name", required: true } } });

    const err = await runAgainst(dir, { name: "${env.PORT}" });

    expect(err).toBeUndefined();
  });
});

describe("REQ-RBV-02 — no-raw-value-echo message contract", () => {
  it("REQ-RBV-02.1: message names field+type, never the value", async () => {
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: "8080" });

    expect((err as Error).message).toContain("port");
    expect((err as Error).message).toContain("number");
    expect((err as Error).message).not.toContain("8080");
  });
});

describe("REQ-RBV-03 — no-schema opt-out signal", () => {
  it("REQ-RBV-03.1: warns loudly on every run (2nd run + 2nd factory proof), never silent, never one-time", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const dir = scratchDir(); // no schema.json seeded — legitimate opt-out
      const fake = new ContractFake({ seed: {} });
      const run = defineFactory<void>(() => {}, { packageDir: dir });

      await run(undefined, { client: fake });
      await run(undefined, { client: fake }); // 2nd run, same factory — proves statelessness

      const dir2 = scratchDir();
      const run2 = defineFactory<void>(() => {}, { packageDir: dir2 });
      await run2(undefined, { client: fake }); // 2nd, DIFFERENT factory — proves per-factory

      expect(warnSpy).toHaveBeenCalledTimes(3);
      const expectedLine1 = `[pbuilder] factory at ${relative(process.cwd(), dir)}: no schema.json found — running WITHOUT schema-derived input validation`;
      const expectedLine2 = `[pbuilder] factory at ${relative(process.cwd(), dir2)}: no schema.json found — running WITHOUT schema-derived input validation`;
      expect(warnSpy.mock.calls[0]?.[0]).toEqual(expectedLine1);
      expect(warnSpy.mock.calls[1]?.[0]).toEqual(expectedLine1); // identical on the 2nd run
      expect(warnSpy.mock.calls[2]?.[0]).toEqual(expectedLine2);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("REQ-RBV-05 — fail-closed on malformed/unreadable/empty schema", () => {
  it("(SEC-3) a non-ENOENT read error (EACCES) fails closed, never silently downgraded to the opt-out", async () => {
    if (process.getuid?.() === 0) {
      throw new Error(
        "must run as non-root: chmod-000 fixtures are bypassed by root, invalidating the non-ENOENT fail-closed proof"
      );
    }
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);
    chmodSync(join(dir, "schema.json"), 0o000);

    const err = await runAgainst(dir, { port: 8080 });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("schema.json could not be read");
    expect(err).not.toBeInstanceOf(AuthoringError);
  });

  it("REQ-RBV-05.1: a present-but-unparseable schema.json fails closed, naming the file+problem without echoing raw content", async () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "schema.json"), "{ BOGUS", "utf-8");

    const err = await runAgainst(dir, { port: 8080 });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("schema.json could not be read");
    expect((err as Error).message).not.toContain("BOGUS");
  });

  it("REQ-RBV-05.1: an invalid-shape schema.json (missing \"properties\") also fails closed via the same literal family", async () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "schema.json"), JSON.stringify({ notProperties: {} }), "utf-8");

    const err = await runAgainst(dir, { port: 8080 });

    expect((err as Error).message).toContain("schema.json could not be read");
    expect((err as Error).message).toContain('missing "properties" object');
  });

  it("a deeply-nested malformed schema.json degrades to the (position unknown) fallback instead of " +
     "crashing with an uncaught RangeError (locator stack-overflow, fail-closed message contract)", async () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    const deepNesting = readFileSync(
      join(PROJECT_ROOT, "test/fixtures/red/schema/deep-nesting/schema.json"),
      "utf-8",
    );
    writeFileSync(join(dir, "schema.json"), deepNesting, "utf-8");

    const err = await runAgainst(dir, { port: 8080 });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toEqual(
      `[pbuilder] factory at ${relative(process.cwd(), dir)}: schema.json could not be read: invalid JSON (position unknown)`
    );
    expect((err as Error).message).not.toContain("Maximum call stack");
    expect((err as Error).message).not.toContain("RangeError");
  });

  it("REQ-RBV-05.2: an empty schema (zero declared properties) is distinct from no schema — run succeeds, distinct warning text", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const dir = scratchDir();
      seedSchema(dir, { properties: {} });

      const err = await runAgainst(dir, {});

      expect(err).toBeUndefined();
      const relDir = relative(process.cwd(), dir);
      expect(warnSpy).toHaveBeenCalledWith(
        `[pbuilder] factory at ${relDir}: schema.json declares zero properties — no input validation performed`
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
