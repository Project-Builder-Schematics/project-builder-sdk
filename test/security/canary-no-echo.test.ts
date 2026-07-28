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
import { describe, it, expect, beforeAll, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { canaryToken, seedSchema, spawnCapture } from "../support/canary.ts";
import * as react from "../../src/dialects/react/index.ts";
import { makeSpyClient } from "../support/spy-client.ts";
import { scaffold, copyIn, create } from "../../src/commons/index.ts";
import { classifyTransport } from "../../src/scaffold/classify-transport.ts";
import { rejectedRun } from "../support/rejection-capture.ts";

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

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "canary-"));
  dirs.push(dir);
  return dir;
}

// REQ-RBV-04.1 canary seeding rule (design §7): a `source-*`/lexical-screen message's
// `{path}` slot is always PACKAGE-RELATIVE — seeding the canary into the relative literal
// would make the no-echo assertion self-contradictory (the relative path is SUPPOSED to
// appear). The canary is therefore seeded into the ABSOLUTE PREFIX — the `mkdtemp`
// directory name itself — and the assertion is "no absolute path component leaked".
function scratchDirWithCanaryPrefix(canary: string): string {
  const dir = mkdtempSync(join(tmpdir(), `canary-${canary}-`));
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

// S-000.7 — the MINIMUM canary-no-echo subset for the new `path-guards.ts` baseline
// branches (missing / non-regular / lexical-reject), driven via `scaffold` + `copyIn`,
// landing GREEN before `test/scaffold/containment.test.ts`'s own (now-obsolete) coverage
// of this obligation is deleted — so the no-echo guarantee is never uncovered even
// momentarily (design §9 step 3 / slices.md Sequencing Note). S-001 extends this to the
// FULL hardened branch set (ELOOP, NUL, degenerate strings, the recursive-walk canary).
describe("REQ-RBV-04.1 — path-guards baseline branches never leak the absolute temp-dir prefix (S-000 minimum subset)", () => {
  it("scaffold: a missing 'from' root never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-missing");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "does-not-exist", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("scaffold: a 'from' root that resolves to a regular file (non-regular) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-nonregular");
    const dir = scratchDirWithCanaryPrefix(canary);
    writeFileSync(join(dir, "not-a-dir"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "not-a-dir", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("scaffold: a lexically-escaping 'from' ('..') never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-lexical");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "../escape", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("copyIn: a missing 'from' source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-missing");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("does-not-exist.txt", "out/copied.txt");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("copyIn: a 'from' source that is a directory (non-regular) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-nonregular");
    const dir = scratchDirWithCanaryPrefix(canary);
    mkdirSync(join(dir, "a-directory"));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("a-directory", "out/copied.txt");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("copyIn: a lexically-escaping 'from' ('..') never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-lexical");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("../escape.txt", "out/copied.txt");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });
});

// S-001 — extends the S-000.7 minimum subset to the FULL hardened branch set: ELOOP
// (symlink cycle), embedded NUL, degenerate source strings, and REQ-FSC-10.4's recursive
// mid-walk failure. Driven through the real `create({templateFile})`/`scaffold`/`copyIn`
// verbs wherever directly constructible; the scaffold per-entry NUL case is sanctioned at
// the `classifyTransport` boundary via a direct unit call (same pattern REQ-PSH-01.3
// already uses, `package-source-io-hygiene` spec V3.3) because a walk-discovered entry
// name structurally cannot contain a NUL byte.
describe("REQ-RBV-04.1 — path-guards baseline branches never leak the absolute temp-dir prefix (S-001 full hardened set)", () => {
  it("templateFile: an ELOOP (symlink cycle) source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("templatefile-eloop");
    const dir = scratchDirWithCanaryPrefix(canary);
    symlinkSync("loop", join(dir, "loop"));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("out/x.ts", { templateFile: "loop", options: {} });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("copyIn: an ELOOP (symlink cycle) source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-eloop");
    const dir = scratchDirWithCanaryPrefix(canary);
    symlinkSync("loop", join(dir, "loop"));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("loop", "out/copied.txt");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("scaffold: a per-entry ELOOP (symlink cycle discovered by the walk) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-eloop");
    const dir = scratchDirWithCanaryPrefix(canary);
    mkdirSync(join(dir, "files"));
    symlinkSync("loop", join(dir, "files", "loop"));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("templateFile: an embedded NUL byte source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("templatefile-nul");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("out/x.ts", { templateFile: "a\0b", options: {} });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("copyIn: an embedded NUL byte source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-nul");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("a\0b", "out/copied.txt");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("scaffold (classifyTransport boundary, REQ-PSH-02.3's sanctioned direct-unit-call route): an embedded NUL byte per-entry relPath never leaks the canary-seeded absolute prefix", () => {
    const canary = canaryToken("scaffold-nul");
    const dir = scratchDirWithCanaryPrefix(canary);

    let caught: unknown;
    try {
      classifyTransport({ packageDir: dir, relPath: "a\0b", isTemplateMarked: false, destPath: "out/x", options: {} });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("templateFile: a degenerate '.' source (resolves to packageDir itself) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("templatefile-degenerate");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("out/x.ts", { templateFile: ".", options: {} });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("copyIn: a degenerate '.' source (resolves to packageDir itself) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-degenerate");
    const dir = scratchDirWithCanaryPrefix(canary);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn(".", "out/copied.txt");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });

  it("REQ-FSC-10.4: a recursive mid-walk readdirSync failure (nested sub-directory EACCES) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-recursive-walk");
    const dir = scratchDirWithCanaryPrefix(canary);
    const nested = join(dir, "files", "nested");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "leaf.ts"), "leaf", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const originalReaddirSync = fs.readdirSync;
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(((...args: Parameters<typeof fs.readdirSync>) => {
      if (args[0] === nested) {
        throw Object.assign(new Error("EACCES: simulated"), { code: "EACCES" });
      }
      return originalReaddirSync(...(args as Parameters<typeof originalReaddirSync>));
    }) as typeof fs.readdirSync);

    try {
      const caught = await rejectedRun(fake, () => {
        scaffold({ from: "files", to: "out" });
      }, { packageDir: dir });

      expect(caught).toBeInstanceOf(Error);
      expect(surfaceContains(caught as Error, canary)).toBe(false);
    } finally {
      readdirSpy.mockRestore();
    }
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

describe("REQ-RXD-13.1 — react setJsxProp: a canary-bearing hostile propName never leaks on a name-validator reject", () => {
  it("a canary embedded in a grammar-invalid propName (>=24 chars, no <=16-char fragment can contain it) never appears on the error surface", async () => {
    const canary = canaryToken("jsxprop");
    expect(canary.length).toBeGreaterThanOrEqual(24);
    // "=" is not admitted by the attribute-name grammar — this rejects at the validator,
    // before any AST mutation, exactly like REQ-RXD-06.1's propName-position injection case.
    const hostilePropName = `${canary}=x`;
    const { client } = makeSpyClient({ "Button.tsx": "const el = <Button />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", hostilePropName, "{1}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(surfaceContains(caught as Error, canary)).toBe(false);
  });
});
