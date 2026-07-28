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
import { spawnSync, execFileSync } from "node:child_process";
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

/**
 * Collapses the canary-no-echo idiom shared by the 13 near-identical `path-guards baseline
 * branches` cases below: run `thunk` against a fresh `ContractFake` anchored at `dir`, then
 * assert it rejects with an Error whose full surface never leaks `canary`. Each call site's
 * OWN distinguishing setup (extra symlinks/files, the thunk itself) stays inline; only this
 * common tail is shared.
 */
async function expectRejectsCanaryFree(dir: string, canary: string, thunk: () => void): Promise<void> {
  const fake = new ContractFake({ seed: {} });
  const caught = await rejectedRun(fake, thunk, { packageDir: dir });
  expect(caught).toBeInstanceOf(Error);
  expect(surfaceContains(caught as Error, canary)).toBe(false);
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

    await expectRejectsCanaryFree(dir, canary, () => {
      scaffold({ from: "does-not-exist", to: "out" });
    });
  });

  it("scaffold: a 'from' root that resolves to a regular file (non-regular) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-nonregular");
    const dir = scratchDirWithCanaryPrefix(canary);
    writeFileSync(join(dir, "not-a-dir"), "content", "utf-8");

    await expectRejectsCanaryFree(dir, canary, () => {
      scaffold({ from: "not-a-dir", to: "out" });
    });
  });

  it("scaffold: a lexically-escaping 'from' ('..') never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-lexical");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      scaffold({ from: "../escape", to: "out" });
    });
  });

  it("copyIn: a missing 'from' source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-missing");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("does-not-exist.txt", "out/copied.txt");
    });
  });

  it("copyIn: a 'from' source that is a directory (non-regular) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-nonregular");
    const dir = scratchDirWithCanaryPrefix(canary);
    mkdirSync(join(dir, "a-directory"));

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("a-directory", "out/copied.txt");
    });
  });

  it("copyIn: a lexically-escaping 'from' ('..') never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-lexical");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("../escape.txt", "out/copied.txt");
    });
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

    await expectRejectsCanaryFree(dir, canary, () => {
      create("out/x.ts", { templateFile: "loop", options: {} });
    });
  });

  it("copyIn: an ELOOP (symlink cycle) source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-eloop");
    const dir = scratchDirWithCanaryPrefix(canary);
    symlinkSync("loop", join(dir, "loop"));

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("loop", "out/copied.txt");
    });
  });

  it("scaffold: a per-entry ELOOP (symlink cycle discovered by the walk) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-eloop");
    const dir = scratchDirWithCanaryPrefix(canary);
    mkdirSync(join(dir, "files"));
    symlinkSync("loop", join(dir, "files", "loop"));

    await expectRejectsCanaryFree(dir, canary, () => {
      scaffold({ from: "files", to: "out" });
    });
  });

  it("templateFile: an embedded NUL byte source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("templatefile-nul");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      create("out/x.ts", { templateFile: "a\0b", options: {} });
    });
  });

  it("copyIn: an embedded NUL byte source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-nul");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("a\0b", "out/copied.txt");
    });
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

    await expectRejectsCanaryFree(dir, canary, () => {
      create("out/x.ts", { templateFile: ".", options: {} });
    });
  });

  it("copyIn: a degenerate '.' source (resolves to packageDir itself) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-degenerate");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn(".", "out/copied.txt");
    });
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

// judgment-day round 1, G6: seven signed enumerated branches (REQ-RBV-04.1) had no
// canary-no-echo test — the reason/message was proven elsewhere, but never that the FULL
// error surface (message, .stack, own enumerable properties) stays canary-free when driven
// through the real commons verb. Plus the G1 root-symlink rejection (owner ruling 16),
// delivered alongside its own RED-first walk.test.ts coverage.
describe("REQ-RBV-04.1 — judgment-day round 1: the seven previously-uncovered enumerated branches, plus the G1 root-symlink rejection", () => {
  it("scaffold: a symlinked WALK ROOT (owner ruling 16) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-root-symlink");
    const dir = scratchDirWithCanaryPrefix(canary);
    const target = scratchDir();
    writeFileSync(join(target, "secret.ts"), "secret", "utf-8");
    symlinkSync(target, join(dir, "link-root"), "dir");

    await expectRejectsCanaryFree(dir, canary, () => {
      scaffold({ from: "link-root", to: "out" });
    });
  });

  it("REQ-PSH-01.1: copyIn — a FIFO source (non-regular, non-directory) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-fifo");
    const dir = scratchDirWithCanaryPrefix(canary);
    execFileSync("mkfifo", [join(dir, "pipe")]);

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("pipe", "out/copied.txt");
    });
  });

  it("REQ-PSH-02.2: templateFile — an injected EACCES read failure never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("templatefile-eacces");
    const dir = scratchDirWithCanaryPrefix(canary);
    const target = join(dir, "tpl.ts.template");
    writeFileSync(target, "content", "utf-8");

    const originalStatSync = fs.statSync;
    const statSpy = spyOn(fs, "statSync").mockImplementation(((...args: Parameters<typeof fs.statSync>) => {
      if (args[0] === target) {
        throw Object.assign(new Error("EACCES: simulated"), { code: "EACCES" });
      }
      return originalStatSync(...(args as Parameters<typeof originalStatSync>));
    }) as typeof fs.statSync);

    try {
      await expectRejectsCanaryFree(dir, canary, () => {
        create("out/x.ts", { templateFile: "tpl.ts.template", options: {} });
      });
    } finally {
      statSpy.mockRestore();
    }
  });

  it("REQ-PSH-02.4: templateFile — a broken symlink source never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("templatefile-broken-symlink");
    const dir = scratchDirWithCanaryPrefix(canary);
    symlinkSync(join(dir, "never-created.txt"), join(dir, "broken.txt"));

    await expectRejectsCanaryFree(dir, canary, () => {
      create("out/x.ts", { templateFile: "broken.txt", options: {} });
    });
  });

  it("REQ-IPF-01.2: an absolute source path never leaks the canary-seeded absolute prefix (driven once per verb, three cases)", async () => {
    const templateFileCanary = canaryToken("templatefile-absolute");
    const templateFileDir = scratchDirWithCanaryPrefix(templateFileCanary);
    await expectRejectsCanaryFree(templateFileDir, templateFileCanary, () => {
      create("out/x.ts", { templateFile: "/abs/secret.ts", options: {} });
    });

    const copyInCanary = canaryToken("copyin-absolute");
    const copyInDir = scratchDirWithCanaryPrefix(copyInCanary);
    await expectRejectsCanaryFree(copyInDir, copyInCanary, () => {
      copyIn("/abs/secret.ts", "out/copied.txt");
    });

    const scaffoldCanary = canaryToken("scaffold-absolute");
    const scaffoldDir = scratchDirWithCanaryPrefix(scaffoldCanary);
    await expectRejectsCanaryFree(scaffoldDir, scaffoldCanary, () => {
      scaffold({ from: "/abs/secret", to: "out" });
    });
  });

  it("REQ-IPF-01.6: copyIn — a segment-aware '..' variant ('sub/..') never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("copyin-dotdot-variant");
    const dir = scratchDirWithCanaryPrefix(canary);

    await expectRejectsCanaryFree(dir, canary, () => {
      copyIn("sub/..", "out/copied.txt");
    });
  });

  it("REQ-IPF-02.1: scaffold — an escaping destination ('to') never leaks the canary-seeded absolute prefix (the template echoes the RELATIVE literal only, `validateDestinationLexical` never sees packageDir's absolute prefix)", async () => {
    const canary = canaryToken("scaffold-dest-escape");
    const dir = scratchDirWithCanaryPrefix(canary);
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");

    await expectRejectsCanaryFree(dir, canary, () => {
      scaffold({ from: "files", to: "../escape" });
    });
  });

  it("REQ-FSC-10.3: scaffold — a walk-ROOT EACCES (injected, non-ENOENT/ENOTDIR) never leaks the canary-seeded absolute prefix", async () => {
    const canary = canaryToken("scaffold-root-eacces");
    const dir = scratchDirWithCanaryPrefix(canary);
    const filesDir = join(dir, "files");
    mkdirSync(filesDir);
    const fake = new ContractFake({ seed: {} });

    const originalReaddirSync = fs.readdirSync;
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(((...args: Parameters<typeof fs.readdirSync>) => {
      if (args[0] === filesDir) {
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
