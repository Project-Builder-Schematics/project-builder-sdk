/**
 * REQ-RBV-04 — dictionary-seeded canary scan across every rejection branch this change
 * introduces (design §4.6 Test Derivation, S-005). Stronger than the per-branch spot-checks
 * already in run-boundary-validation.test.ts/reserved-lifecycle-names.test.ts/
 * codegen-cli.test.ts (which each assert `.not.toContain("<one known literal>")`): here a
 * freshly generated, unpredictable canary token is seeded as the VALUE under test for every
 * branch, and the FULL error surface (message, `.stack`, own enumerable properties, and —
 * for the bin — captured stdout/stderr) is scanned for it. Key NAMES are exempted
 * (REQ-RBV-04.2 asymmetry — naming the offending key is required, e.g. RBV-01.3/.5/.6's
 * message).
 *
 * Self-building `beforeAll` (S-001 precedent, `codegen-cli.test.ts`): this file also spawns
 * the DIST bin artifact for the TFO-04.1 branch, so a bare `bun test` on a fresh checkout
 * must not depend on file-execution order producing `dist/bin` first.
 */
import { describe, it, expect, beforeAll, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { canaryToken, seedSchema, spawnCapture } from "../support/canary.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_BIN = join(PROJECT_ROOT, "dist/bin/pbuilder-codegen.js");

beforeAll(() => {
  const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `canary-no-echo: bun run build failed — cannot spawn the bin without a fresh build.\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
});

let dirs: string[] = [];

// ADR-0046 migration (schematic-local-files, S-000): every scratch dir seeds a
// `collection.json` marker directly inside it — `defineFactory({ packageDir })`'s new
// pre-`als.run` ancestor walk (REQ-PRC-03) fails loud on any packageDir with no
// collection.json ancestor, and every `runAgainst` call below opts into `packageDir`.
function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "canary-"));
  writeFileSync(join(dir, "collection.json"), "{}", "utf-8");
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  dirs = [];
});

async function runAgainst(packageDir: string, input: unknown): Promise<Error> {
  const fake = new ContractFake({ seed: {} });
  const run = defineFactory<unknown>(() => {}, { packageDir });
  try {
    await run(input, { client: fake });
    throw new Error("expected the run to reject, but it succeeded");
  } catch (err) {
    return err as Error;
  }
}

// Scans every observable surface of a thrown Error for `needle`: message, stack, and any
// own enumerable string-valued property — generic on purpose so the same scan still holds
// once S-006 adds `origin`/`reason` string fields to the (then) AuthoringError.
function surfaceContains(err: Error, needle: string): boolean {
  const surfaces: string[] = [err.message, err.stack ?? ""];
  for (const key of Object.getOwnPropertyNames(err)) {
    const value = (err as unknown as Record<string, unknown>)[key];
    if (typeof value === "string") surfaces.push(value);
  }
  return surfaces.some((surface) => surface.includes(needle));
}

const PORT_SCHEMA = { properties: { port: { type: "number", label: "Port", required: true } } };

describe("REQ-RBV-04.1 — canary scan across every rejection branch", () => {
  it("RBV-01.1: missing required key — a co-resident field's canary value never leaks", async () => {
    const canary = canaryToken("missing");
    const dir = scratchDir();
    seedSchema(dir, {
      properties: {
        port: { type: "number", label: "Port", required: true },
        extra: { type: "string", label: "Extra", required: false },
      },
    });

    const err = await runAgainst(dir, { extra: canary });

    expect(err.message).toEqual("invalid input: port must be number");
    expect(surfaceContains(err, canary)).toBe(false);
  });

  it("RBV-01.2: a wrong-typed value never leaks", async () => {
    const canary = canaryToken("wrongtype");
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: canary });

    expect(err.message).toEqual("invalid input: port must be number");
    expect(surfaceContains(err, canary)).toBe(false);
  });

  it("RBV-01.3: an excess key's VALUE never leaks (the key NAME 'extra' legitimately appears)", async () => {
    const canary = canaryToken("excess");
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: 8080, extra: canary });

    expect(err.message).toEqual("invalid input: extra is a reserved or disallowed key");
    expect(surfaceContains(err, canary)).toBe(false);
  });

  it("RBV-01.4: a non-JSON (function) value's source text never leaks", async () => {
    const canary = canaryToken("nonjson");
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);
    // The function's own SOURCE TEXT literally contains the canary — a naive `String(value)`
    // fallback anywhere in the rejection path would leak it via .toString().
    const hostileFn = new Function(`return "${canary}";`);

    const err = await runAgainst(dir, { port: hostileFn });

    expect(err.message).toEqual("invalid input: port must be number");
    expect(surfaceContains(err, canary)).toBe(false);
  });

  it("RBV-01.5: a reserved-lifecycle-name input key's VALUE never leaks", async () => {
    const canary = canaryToken("reservedkey");
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);
    const input = JSON.parse(`{"port": 8080, "pre-execute": ${JSON.stringify(canary)}}`);

    const err = await runAgainst(dir, input);

    expect(err.message).toEqual("invalid input: pre-execute is a reserved or disallowed key");
    expect(surfaceContains(err, canary)).toBe(false);
  });

  it("RBV-01.6: a __proto__ input key's VALUE never leaks", async () => {
    const canary = canaryToken("protokey");
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);
    const input = JSON.parse(`{"port": 8080, "__proto__": ${JSON.stringify(canary)}}`);

    const err = await runAgainst(dir, input);

    expect(err.message).toEqual("invalid input: __proto__ is a reserved or disallowed key");
    expect(surfaceContains(err, canary)).toBe(false);
  });

  it("RBV-01.7: null-vs-missing trichotomy — a co-resident field's canary value never leaks on either branch", async () => {
    const canary = canaryToken("nulltri");
    const schema = {
      properties: {
        port: { type: "number", label: "Port", required: true },
        extra: { type: "string", label: "Extra", required: false },
      },
    };

    const missingDir = scratchDir();
    seedSchema(missingDir, schema);
    const missingErr = await runAgainst(missingDir, { extra: canary });
    expect(missingErr.message).toEqual("invalid input: port must be number");
    expect(surfaceContains(missingErr, canary)).toBe(false);

    const nullDir = scratchDir();
    seedSchema(nullDir, schema);
    const nullErr = await runAgainst(nullDir, { port: null, extra: canary });
    expect(nullErr.message).toEqual("invalid input: port must be number");
    expect(surfaceContains(nullErr, canary)).toBe(false);
  });

  it("TFO-04.1: a canary embedded in malformed schema.json content never leaks on the bin's STDOUT/STDERR", () => {
    const canary = canaryToken("bin");
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "schema.json"), `{ "field": "${canary} BOGUS`, "utf-8");

    const result = spawnCapture("bun", [DIST_BIN, dir]);

    expect(result.status).not.toEqual(0);
    expect(result.stdout).not.toContain(canary);
    expect(result.stderr).not.toContain(canary);
  });

  it("RLN-02.1: a reserved-lifecycle-name rejection never leaks an unrelated resolved-input value", async () => {
    const canary = canaryToken("rln");
    const dir = scratchDir();
    writeFileSync(join(dir, "pre-execute.ts"), "export {};", "utf-8");

    const err = await runAgainst(dir, { value: canary });

    expect(err.message).toEqual(
      "reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module"
    );
    expect(surfaceContains(err, canary)).toBe(false);
  });
});

describe("REQ-RBV-04.2 — key names may appear, values never (asymmetry pin)", () => {
  it("an excess key literally NAMED the canary token legitimately appears in the message", async () => {
    const canary = canaryToken("keyname");
    const dir = scratchDir();
    seedSchema(dir, PORT_SCHEMA);

    const err = await runAgainst(dir, { port: 8080, [canary]: true });

    expect(err.message).toEqual(`invalid input: ${canary} is a reserved or disallowed key`);
  });
});
