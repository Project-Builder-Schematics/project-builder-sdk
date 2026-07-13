/**
 * REQ-FSC-01 (S-001, design §Test Derivation): `scaffold`'s mandatory/optional argument
 * shape — `from`/`to` are mandatory and reject fail-loud BEFORE any directory read; every
 * other field defaults per REQ-FSC-01. Exercised through `commons.scaffold` inside a real
 * `defineFactory` run (this leaf's entrypoint needs the active RunContext).
 *
 * REQ-FEH-03/04 (S-003, design §Test Derivation): `copyIn`'s always-by-reference,
 * no-classification posture and its mandatory-arg/rejection/void-return contract —
 * exercised the same way, through `commons.copyIn`.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, copyIn, dryRun } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { rejectedRun } from "../support/rejection-capture.ts";
import { expectAuthoringReason } from "../support/expect-reason.ts";

const scratchDir = scratchDirFactory("scaffold-index-");

describe("REQ-FSC-01.1 — missing mandatory 'from' rejects before any directory read", () => {
  it("rejects fail-loud, never reaching the walk", async () => {
    const dir = scratchDir();
    // A `files/` dir that WOULD produce entries if walked — proves the rejection pre-empts
    // any directory read (its content is irrelevant to the assertion, only that it's unread).
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ to: "out" } as unknown as Parameters<typeof scaffold>[0]);
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("REQ-FSC-01.3 — missing mandatory 'to' rejects before any directory read", () => {
  it("rejects fail-loud", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files" } as unknown as Parameters<typeof scaffold>[0]);
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
  });
});

describe("REQ-FSC-01.2 — optional args default correctly", () => {
  it("a call with only from/to scaffolds both files with no filtering, no rename, force: false", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "files", "b.ts"), "B", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
      const plan = dryRun();
      expect(plan.map((e) => e.path).sort()).toEqual(["out/a.ts", "out/b.ts"]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree()).toEqual(
      new Map([
        ["out/a.ts", "A"],
        ["out/b.ts", "B"],
      ])
    );
  });
});

describe("REQ-FEH-03.1 — copyIn on a text file still copies verbatim, unrendered", () => {
  it("a text file containing a {= =}-looking sequence emits a by-reference directive — no classification performed", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "literal.txt"), "{= this looks like a token =}", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      copyIn("literal.txt", "dest/literal.txt");

      const plan = dryRun();
      expect(plan).toEqual([{ verb: "copyIn", path: "literal.txt", kind: "copied" }]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    // BRC-04/Q21: by-reference bytes never land in result.tree — emit-only.
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("REQ-FEH-04 — copyIn's mandatory args and void return", () => {
  it("REQ-FEH-04.1: missing 'to' rejects fail-loud, no directive emitted", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("asset.svg", undefined as unknown as string);
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-FEH-04.2: missing 'from' rejects fail-loud, no directive emitted", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn(undefined as unknown as string, "dest/asset.svg");
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-FEH-04.3 posture / design §Data Model: copyIn returns void, not a WritableHandle", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      const result = copyIn("asset.svg", "dest/asset.svg");
      expect(result).toBeUndefined();
    }, { packageDir: dir });

    await run(undefined, { client: fake });
  });

  it("design §Data Model 'no resolution anchor': copyIn inside a bare defineFactory(fn) run fails loud, never falls back to cwd", async () => {
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    expectAuthoringReason(caught, "invalid-input");
  });
});
