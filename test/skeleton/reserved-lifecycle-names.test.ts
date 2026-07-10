/**
 * RLN-01/02/03 — reserved lifecycle names, enforced from module structure (design §4.2/
 * §4.4, ADR-0028, S-004). Integration level (design §4.6 Test Derivation): drives
 * `defineFactory` end-to-end against scratch package dirs, proving the WIRED pre-`als.run`
 * scan (discovery -> reject) — distinct from `schema-discovery.test.ts`'s unit-level direct
 * calls into `findReservedSibling`, and from FIT-16's build-time always-on structural scan
 * (`test/fitness/fit-16-reserved-name-scan.test.ts`), which reuses the same discovery
 * function over a fixed allowlist regardless of `packageDir`.
 */
import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";

let dirs: string[] = [];

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rln-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    try {
      chmodSync(dir, 0o755);
    } catch {
      // best-effort
    }
    rmSync(dir, { recursive: true, force: true });
  }
  dirs = [];
});

async function runAgainst(packageDir: string): Promise<unknown> {
  const fake = new ContractFake({ seed: {} });
  const run = defineFactory<void>(() => {}, { packageDir });
  try {
    await run(undefined, { client: fake });
    return undefined;
  } catch (err) {
    return err;
  }
}

describe("REQ-RLN-01 — schematic-level reserved names, enforced from module structure", () => {
  it("REQ-RLN-01.1: a pre-execute.ts sibling is rejected, naming pre-execute", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "pre-execute.ts"), "export {};", "utf-8");

    const err = await runAgainst(dir);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toEqual(
      "reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module"
    );
    expect(err).not.toBeInstanceOf(AuthoringError);
  });

  it("REQ-RLN-01.2: a clean factory package (no reserved siblings) is accepted", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "factory.ts"), "export {};", "utf-8");

    expect(await runAgainst(dir)).toBeUndefined();
  });

  it("REQ-RLN-01.3: a post-execute.ts sibling is independently rejected, naming post-execute", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "post-execute.ts"), "export {};", "utf-8");

    const err = await runAgainst(dir);

    expect((err as Error).message).toEqual(
      "reserved lifecycle name: post-execute is reserved and cannot be declared by a factory module"
    );
  });

  it("dir-form: a pre-execute/ directory sibling is rejected (ADR-0028)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "pre-execute"));
    writeFileSync(join(dir, "pre-execute", "index.ts"), "export {};", "utf-8");

    const err = await runAgainst(dir);

    expect((err as Error).message).toEqual(
      "reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module"
    );
  });

  it("constraint 4: a non-ENOENT unreadable package dir fails closed (never silently 'no reserved siblings')", async () => {
    if (process.getuid?.() === 0) {
      throw new Error(
        "must run as non-root: chmod-000 fixtures are bypassed by root, invalidating the non-ENOENT fail-closed proof"
      );
    }
    const dir = scratchDir();
    chmodSync(dir, 0o000);

    const err = await runAgainst(dir);

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthoringError);
  });
});

describe("REQ-RLN-02 — reserved-name rejection shape", () => {
  it("REQ-RLN-02.1: distinguishable from a run-boundary schema-validation rejection by message literal alone", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "pre-execute.ts"), "export {};", "utf-8");

    const err = await runAgainst(dir);

    expect((err as Error).message.startsWith("reserved lifecycle name:")).toBe(true);
    expect((err as Error).message.startsWith("invalid input:")).toBe(false);
  });
});

describe("REQ-RLN-01.4 / REQ-RLN-03 — boundary pins (characterization)", () => {
  it("REQ-RLN-01.4: a schema.json property literally named pre-execute is NOT rejected by this REQ (module structure only)", async () => {
    const dir = scratchDir();
    writeFileSync(
      join(dir, "schema.json"),
      JSON.stringify({ properties: { "pre-execute": { type: "string", label: "x", required: false } } }),
      "utf-8"
    );

    expect(await runAgainst(dir)).toBeUndefined();
  });

  it("REQ-RLN-03.1: a schema.json property key named add is accepted (collection-level, out of scope / L2)", async () => {
    const dir = scratchDir();
    writeFileSync(
      join(dir, "schema.json"),
      JSON.stringify({ properties: { add: { type: "string", label: "x", required: false } } }),
      "utf-8"
    );

    expect(await runAgainst(dir)).toBeUndefined();
  });

  it("REQ-RLN-03.2: an exported function named remove is accepted despite colliding with the shipped author verb", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "remove.ts"), "export function remove() {}", "utf-8");

    expect(await runAgainst(dir)).toBeUndefined();
  });
});
