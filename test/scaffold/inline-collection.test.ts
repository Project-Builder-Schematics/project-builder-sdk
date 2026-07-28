/**
 * REQ-MFB-01.1 / REQ-MFB-01.2 (S-000, design §Data Model/§9 step 2): the AUTHORITATIVE
 * inline-collection regression test — the reported bug this whole change closes. Uses its
 * OWN `mkdtemp`, never `scratchDirFactory` (which still seeds a `collection.json` marker
 * for other suites' convenience), and asserts the FULL-ANCESTOR-CHAIN precondition
 * explicitly: no `collection.json` exists at `packageDir` or any directory above it, all
 * the way to the filesystem root — the same layout a real CLI inline-collection project has
 * (the collection lives inside `project-builder.json`; no `collection.json` ever exists on
 * disk).
 */
import { describe, it, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, scaffold, copyIn } from "../../src/commons/index.ts";

// REQ-MFB-01.1/.2's shared precondition: NO `collection.json` anywhere from `dir` up to
// (and including) the filesystem root — not merely at `dir` itself.
function assertNoAncestorMarkerAnywhere(dir: string): void {
  let current = dir;
  for (;;) {
    expect(existsSync(join(current, "collection.json"))).toBe(false);
    const parent = dirname(current);
    if (parent === current) break; // reached the filesystem root
    current = parent;
  }
}

function freshPackageDir(): string {
  // Own mkdtemp, deliberately never `scratchDirFactory` — that helper seeds a marker.
  return mkdtempSync(join(tmpdir(), "inline-collection-"));
}

describe("REQ-MFB-01.1 — missing-ancestor rejection no longer pre-empts the factory body", () => {
  it("the sentinel throw IS the thrown value — no ancestor-marker rejection precedes it", async () => {
    const dir = freshPackageDir();
    assertNoAncestorMarkerAnywhere(dir);

    const run = (): void => {
      throw new Error("body-ran");
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });

    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toEqual("body-ran");
  });
});

describe("REQ-MFB-01.2 — all three read verbs commit with no collection.json anywhere (the inline-collection regression, closed)", () => {
  it("create({templateFile}), scaffold, and copyIn all succeed against a package with no collection.json ancestor", async () => {
    const dir = freshPackageDir();
    assertNoAncestorMarkerAnywhere(dir);

    // create({templateFile}) fixture.
    writeFileSync(join(dir, "tpl.ts.template"), "export const x = {= x =};", "utf-8");

    // scaffold fixture — a by-value source folder.
    mkdirSync(join(dir, "files"), { recursive: true });
    writeFileSync(join(dir, "files", "a.ts"), "export const a = 1;", "utf-8");

    // copyIn fixture — a standalone by-reference source.
    writeFileSync(join(dir, "asset.svg"), "<svg></svg>", "utf-8");

    const run = (): void => {
      create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 } });
      scaffold({ from: "files", to: "out" });
      copyIn("asset.svg", "copied/asset.svg");
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });

    expect(result.error).toBeUndefined();

    // create/scaffold legs: byte-exact committed content.
    expect(result.tree.get("dest.ts")).toEqual("export const x = {= x =};");
    expect(result.tree.get("out/a.ts")).toEqual("export const a = 1;");

    // copyIn leg: emitted-directive-shape assertion ONLY (spec V3.2 re-pin, B5) — the
    // contract fake and run vehicle deliberately never materialize copyIn bytes
    // (`src/testing/contract-fake.ts:237-247`), so no test may assert copyIn's committed
    // byte content.
    const copyInDirectives = result.emitted.flatMap((batch) =>
      batch.instructions.filter((instruction) => instruction.op === "copyIn")
    );
    expect(copyInDirectives).toEqual([
      { op: "copyIn", copyIn: { from: "asset.svg", to: "copied/asset.svg" } },
    ]);
  });

  it("this temp-dir layout is explicitly equivalent to a real CLI inline-collection project (no collection.json anywhere, nested packageDir included)", async () => {
    const root = freshPackageDir();
    const nested = join(root, "packages", "widget");
    mkdirSync(nested, { recursive: true });
    assertNoAncestorMarkerAnywhere(nested);
    writeFileSync(join(nested, "a.ts"), "export const a = 1;", "utf-8");

    const run = (): void => {
      create("dest.ts", { template: "static content", options: {} });
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: nested });

    expect(result.error).toBeUndefined();
    expect(result.tree.get("dest.ts")).toEqual("static content");
  });
});
