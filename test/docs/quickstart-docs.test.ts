/**
 * Quickstart docs-as-test (S-003, REQ-AOD-01/02/07/11): the machine leg extracts
 * `docs/quickstart.md`'s `schema.json`/`factory.ts`/`factory.test.ts` fenced blocks, runs
 * the REAL codegen bin, and runs the REAL test — all inside a `bun link`-installed scratch
 * consumer. Per REQ-AOD-07's fence, the swap target is the LINKED/INSTALLED package, NEVER
 * a relative `src/` substitution — that is `testing-story-docs.test.ts`'s own mechanism for
 * the README's testing section, deliberately NOT reused here (the fenced blocks are written
 * VERBATIM into the scratch consumer's own directory; their `@pbuilder/sdk/...` import
 * specifiers resolve through ITS `node_modules`, no text substitution at all).
 *
 * Also covers REQ-AOD-02 (install-ritual order: `bun link` before the tarball alternative,
 * no `npm install @pbuilder/sdk`) and REQ-AOD-11 (a SEPARATE scratch consumer with its own
 * `tsconfig.json` + `typescript` + `@types/bun` devDependencies, proving the generated types
 * — AND the doc's `factory.test.ts` `bun:test` import — are usable from OUTSIDE the repo:
 * runtime green alone does not prove that, types are erased at runtime).
 */
import { describe, it, expect, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT, ensureLinkedConsumer, unlinkSdk, cleanScratchDir } from "../support/scratch-consumer.ts";
import { spawnCapture } from "../support/canary.ts";

const QUICKSTART_PATH = join(PROJECT_ROOT, "docs/quickstart.md");
const MACHINE_SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-quickstart-machine-leg");
const TSC_SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-quickstart-tsc-leg");

afterAll(() => {
  cleanScratchDir(MACHINE_SCRATCH_DIR);
  cleanScratchDir(TSC_SCRATCH_DIR);
  unlinkSdk();
});

// Parses ```<lang> filename=<name> ... ``` fences — the ONLY annotation the quickstart uses
// to mark which fence is which physical file. `schema.json` cannot carry a `// FILE:`-style
// leading comment and stay valid JSON, so the fence info-string carries the filename instead.
function extractFencedFiles(markdown: string): Map<string, string> {
  const files = new Map<string, string>();
  const pattern = /```\S+\s+filename=(\S+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const filename = match[1];
    const body = match[2];
    if (filename !== undefined && body !== undefined) files.set(filename, body);
  }
  return files;
}

// Extracts the ```sh (no filename=) codegen-invocation block shown in the quickstart.
function extractCodegenCommand(markdown: string): string {
  const match = /```sh\n(pbuilder-codegen[^\n]*)\n```/.exec(markdown);
  if (match?.[1] === undefined) {
    throw new Error("quickstart.md: no ```sh pbuilder-codegen invocation block found");
  }
  return match[1].trim();
}

// The machine leg's "swap" is DIRECTORY-based, not textual: fenced blocks are written
// UNCHANGED into the scratch consumer, so `@pbuilder/sdk/...` specifiers resolve through
// ITS OWN node_modules — never a text substitution to a relative `src/` path (REQ-AOD-07.2).
function writeQuickstartFileVerbatim(scratchDir: string, filename: string, content: string): void {
  writeFileSync(join(scratchDir, filename), content);
}

describe("REQ-AOD-02 — install ritual: bun link first, tarball as alternative", () => {
  const doc = readFileSync(QUICKSTART_PATH, "utf-8");

  it("REQ-AOD-02.1: the bun link ritual appears before the tarball-install alternative", () => {
    const linkIndex = doc.indexOf("bun run link:sdk");
    const tarballIndex = doc.search(/tarball/i);
    expect(linkIndex).toBeGreaterThan(-1);
    expect(tarballIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeLessThan(tarballIndex);
  });

  it("REQ-AOD-02.2: no npm install @pbuilder/sdk (or equivalent live-registry install) instruction is present", () => {
    expect(doc).not.toMatch(/npm install\s+@pbuilder\/sdk/);
  });
});

describe("walkthrough outcome-gap fix (G-2, REQ-AOD-01/07/11) — consumer tsconfig taught before the factory step", () => {
  const doc = readFileSync(QUICKSTART_PATH, "utf-8");

  it("the doc shows a tsconfig.json fenced block, with modern moduleResolution and allowImportingTsExtensions, before the factory step", () => {
    const files = extractFencedFiles(doc);
    expect(files.has("tsconfig.json")).toBe(true);

    const tsconfigContent = files.get("tsconfig.json") ?? "";
    const parsed = JSON.parse(tsconfigContent) as {
      compilerOptions?: { moduleResolution?: string; allowImportingTsExtensions?: boolean; types?: string[] };
    };
    const moduleResolution = parsed.compilerOptions?.moduleResolution ?? "";
    // Legacy (node10) resolution — TypeScript's default absent an explicit setting — cannot
    // read a package's `exports` map, the ONLY route to the SDK's five subpaths.
    expect(["bundler", "Bundler", "NodeNext", "nodenext"]).toContain(moduleResolution);
    expect(parsed.compilerOptions?.allowImportingTsExtensions).toBe(true);

    // `types: ["bun"]` — empty/unset `types` hides `bun:test`'s ambient module declaration
    // even with `@types/bun` installed (empirically verified: `tsc` reports
    // `Cannot find module 'bun:test'` under `types: []` AND under an omitted `types` field;
    // only an explicit `types: ["bun"]` resolves it under NodeNext resolution).
    expect(parsed.compilerOptions?.types).toContain("bun");

    // Placement: a reader following the doc top-to-bottom must hit the config BEFORE the
    // factory step that needs it — the doc's own step 4 walkthrough failure (ts(2307)) was
    // exactly this: the factory was written before any tsconfig existed.
    const tsconfigFenceIndex = doc.indexOf("filename=tsconfig.json");
    const factoryFenceIndex = doc.indexOf("filename=factory.ts");
    expect(tsconfigFenceIndex).toBeGreaterThan(-1);
    expect(factoryFenceIndex).toBeGreaterThan(-1);
    expect(tsconfigFenceIndex).toBeLessThan(factoryFenceIndex);
  });

  it("the doc instructs installing @types/bun before the schema/factory/test steps (bun:test ambient types)", () => {
    // Finding #4: factory.test.ts (step 6) imports from "bun:test"; without `@types/bun`
    // installed AND named in `types`, the consumer sees `Cannot find module 'bun:test'`.
    const step2Start = doc.indexOf("## 2. Configure your consumer");
    const step3Start = doc.indexOf("## 3. Define your schema");
    expect(step2Start).toBeGreaterThan(-1);
    expect(step3Start).toBeGreaterThan(step2Start);
    const step2 = doc.slice(step2Start, step3Start);

    expect(step2).toMatch(/bun add -d[^\n]*@types\/bun/);
  });

  it("the doc establishes the consumer workspace (new folder, no separate bun init) before the schema step", () => {
    // The owner's exact stumble: "The guide doesn't say where I need to create the
    // schema.json. Is it a new folder? ... do I need to init with a package.json and a
    // tsconfig?" — step 1 must answer this BEFORE the schema step, not leave "your own
    // package" undefined.
    const step1Start = doc.indexOf("## 1. Install");
    const step1End = doc.indexOf("## 2. Configure your consumer");
    expect(step1Start).toBeGreaterThan(-1);
    expect(step1End).toBeGreaterThan(step1Start);
    const step1 = doc.slice(step1Start, step1End);

    expect(step1).toContain("mkdir");
    expect(step1).toMatch(/no separate `?bun init`? is needed/i);
    for (const filename of ["schema.json", "tsconfig.json", "factory.ts", "factory.test.ts"]) {
      expect(step1).toContain(filename);
    }
  });

  it("Finding #5: prose (not just the fence info-string) names each generated file immediately before its code block", () => {
    // The `filename=` info-string is machine-consumable metadata ONLY — standard markdown
    // renderers (GitHub, editor previews) never display it, so a human reader relying on it
    // alone never learns what to name the file. The prose must name it too, right at the
    // block, not just somewhere earlier in the doc.
    const filenames = ["tsconfig.json", "schema.json", "factory.ts", "factory.test.ts"];
    for (const filename of filenames) {
      const fenceIndex = doc.indexOf(`filename=${filename}`);
      expect(fenceIndex).toBeGreaterThan(-1);

      const precedingProse = doc.slice(Math.max(0, fenceIndex - 200), fenceIndex);
      expect(precedingProse).toContain(`\`${filename}\``);
    }
  });

  it("the shown codegen invocation resolves via PATH alone in a fresh consumer shell (no explicit .bin path)", async () => {
    await ensureLinkedConsumer(MACHINE_SCRATCH_DIR);
    const files = extractFencedFiles(doc);
    for (const [filename, content] of files) {
      writeQuickstartFileVerbatim(MACHINE_SCRATCH_DIR, filename, content);
    }

    const shownCommand = extractCodegenCommand(doc);
    const [bin, ...args] = shownCommand.split(/\s+/);
    // No explicit node_modules/.bin path here, unlike the REQ-AOD-01.1 leg below — this
    // proves the LITERAL command a reader types resolves, relying only on `bun link:sdk`'s
    // (step 1) global bin registration being on PATH, same as this suite's own bare `bun`
    // invocations already rely on.
    const result = spawnCapture(bin ?? "pbuilder-codegen", args, { cwd: MACHINE_SCRATCH_DIR });
    expect(result.status).toEqual(0);
    expect(result.stdout).toContain("pbuilder-codegen: wrote schema.generated.ts");
  });
});

describe("REQ-AOD-01/07 — quickstart machine leg (schema -> codegen -> typed factory -> passing test)", () => {
  it("REQ-AOD-01.1/REQ-AOD-01.2/REQ-AOD-01.3/REQ-AOD-07.1: the quickstart's fenced blocks run green against the bun-link-installed package", async () => {
    await ensureLinkedConsumer(MACHINE_SCRATCH_DIR);

    const doc = readFileSync(QUICKSTART_PATH, "utf-8");
    const files = extractFencedFiles(doc);

    expect(files.has("schema.json")).toBe(true);
    expect(files.has("factory.ts")).toBe(true);
    expect(files.has("factory.test.ts")).toBe(true);

    for (const [filename, content] of files) {
      writeQuickstartFileVerbatim(MACHINE_SCRATCH_DIR, filename, content);
    }

    // REQ-AOD-01.1: the shown codegen invocation matches the bin's real contract — ONE
    // positional argument, NO flags (bin/pbuilder-codegen.ts:171-174).
    const shownCommand = extractCodegenCommand(doc);
    expect(shownCommand).toMatch(/^pbuilder-codegen\s+\S+$/);
    expect(shownCommand).not.toMatch(/\s--?\w/);

    const codegenArg = shownCommand.split(/\s+/)[1] ?? ".";
    const binPath = join(MACHINE_SCRATCH_DIR, "node_modules", ".bin", "pbuilder-codegen");
    const codegenResult = spawnCapture(binPath, [codegenArg], { cwd: MACHINE_SCRATCH_DIR });
    expect(codegenResult.status).toEqual(0);
    expect(codegenResult.stdout).toContain("pbuilder-codegen: wrote schema.generated.ts");

    // REQ-AOD-01.2: factory.ts consumes the GENERATED type as a BARE exported function —
    // no defineFactory call, zero defineFactory tokens anywhere in the example.
    const factoryTs = files.get("factory.ts") ?? "";
    expect(factoryTs).toMatch(/import\s+type\s+\{\s*Input\s*\}\s+from\s+["']\.\/schema\.generated\.ts["']/);
    expect(factoryTs).toMatch(/export const run\s*=\s*\(input:\s*Input\)/);
    expect(factoryTs).not.toContain("defineFactory");

    // REQ-AOD-01.3/REQ-AOD-07.1: the test example runs green, unmodified beyond the fences
    // themselves, against the bun-link-installed package's own node_modules.
    const testResult = spawnCapture("bun", ["test", "factory.test.ts"], { cwd: MACHINE_SCRATCH_DIR });
    expect(testResult.status).toEqual(0);
  });

  // RED-PROOF (REQ-AOD-07.2): the machine leg's actual file writer never substitutes a
  // relative src/ import — proven by scanning its OWN source, not asserted alone.
  it("[red-proof] REQ-AOD-07.2: the machine leg's file writer never substitutes a relative src/ import", () => {
    const writerSource = writeQuickstartFileVerbatim.toString();
    expect(writerSource).not.toContain("src/testing");
    expect(writerSource).not.toContain("src/commons");
    expect(writerSource).not.toContain(".replace(");
  });
});

describe("REQ-AOD-11 — consumer-side tsc leg for the quickstart's typed factory", () => {
  let tscScratchReady: Promise<void> | undefined;

  function ensureTscScratchReady(): Promise<void> {
    if (tscScratchReady !== undefined) return tscScratchReady;

    tscScratchReady = (async () => {
      await ensureLinkedConsumer(MACHINE_SCRATCH_DIR); // ensures the producer is bun-linked

      cleanScratchDir(TSC_SCRATCH_DIR);
      mkdirSync(TSC_SCRATCH_DIR, { recursive: true });

      const rootDevDependencies = (
        JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
          devDependencies: Record<string, string>;
        }
      ).devDependencies;
      const typescriptVersion = rootDevDependencies.typescript;
      const typesBunVersion = rootDevDependencies["@types/bun"];

      writeFileSync(
        join(TSC_SCRATCH_DIR, "package.json"),
        JSON.stringify(
          {
            name: "quickstart-tsc-scratch",
            version: "0.0.0",
            private: true,
            type: "module",
            // `@types/bun` mirrors the doc's own step 2 install instruction — the tsc leg
            // typechecks factory.test.ts's `bun:test` import too (Finding #4), not just
            // factory.ts.
            devDependencies: { typescript: typescriptVersion, "@types/bun": typesBunVersion },
          },
          null,
          2
        )
      );
      const installResult = spawnSync("bun", ["install"], { cwd: TSC_SCRATCH_DIR, encoding: "utf-8" });
      if (installResult.status !== 0) {
        throw new Error(
          `quickstart tsc-leg scratch install failed:\n${installResult.stdout}\n${installResult.stderr}`
        );
      }
      const linkResult = spawnSync("bun", ["link", "@pbuilder/sdk"], { cwd: TSC_SCRATCH_DIR, encoding: "utf-8" });
      if (linkResult.status !== 0) {
        throw new Error(`quickstart tsc-leg bun link failed:\n${linkResult.stdout}\n${linkResult.stderr}`);
      }

      const doc = readFileSync(QUICKSTART_PATH, "utf-8");
      const files = extractFencedFiles(doc);
      // tsconfig.json comes from the DOC ITSELF, not a harness-owned duplicate — this leg
      // is the proof that the doc's own copy-pasteable config is what makes `tsc` pass, not
      // a config the harness silently provisions on the reader's behalf (the walkthrough
      // outcome-gap this fix addresses — see the "walkthrough outcome-gap fix" describe
      // block above, G-2).
      const tsconfigContent = files.get("tsconfig.json");
      if (tsconfigContent === undefined) {
        throw new Error("quickstart.md: no ```json filename=tsconfig.json fenced block found");
      }
      writeFileSync(join(TSC_SCRATCH_DIR, "tsconfig.json"), tsconfigContent);
      writeFileSync(join(TSC_SCRATCH_DIR, "schema.json"), files.get("schema.json") ?? "");
      writeFileSync(join(TSC_SCRATCH_DIR, "factory.ts"), files.get("factory.ts") ?? "");
      // factory.test.ts too (Finding #4): its `bun:test` import is a SEPARATE ambient-types
      // failure mode from factory.ts's module-resolution one, and stayed machine-invisible
      // as long as only factory.ts was typechecked here.
      writeFileSync(join(TSC_SCRATCH_DIR, "factory.test.ts"), files.get("factory.test.ts") ?? "");

      const binPath = join(TSC_SCRATCH_DIR, "node_modules", ".bin", "pbuilder-codegen");
      const codegenResult = spawnSync(binPath, ["."], { cwd: TSC_SCRATCH_DIR, encoding: "utf-8" });
      if (codegenResult.status !== 0) {
        throw new Error(`quickstart tsc-leg codegen failed:\n${codegenResult.stdout}\n${codegenResult.stderr}`);
      }
    })();

    return tscScratchReady;
  }

  function runTsc(): { status: number | null; output: string } {
    const tscBinPath = join(TSC_SCRATCH_DIR, "node_modules", ".bin", "tsc");
    expect(existsSync(tscBinPath)).toBe(true);
    const result = spawnSync(tscBinPath, ["--noEmit"], { cwd: TSC_SCRATCH_DIR, encoding: "utf-8" });
    return { status: result.status, output: result.stdout + result.stderr };
  }

  it("REQ-AOD-11.1: tsc --noEmit passes inside a scratch consumer with the quickstart's factory.ts AND factory.test.ts copied in verbatim", async () => {
    await ensureTscScratchReady();
    const { status, output } = runTsc();
    expect(status).toEqual(0);
    expect(output.trim()).toEqual("");
  });

  it("[red-proof] REQ-AOD-11.2: a non-existent generated field reference fails tsc, naming the missing field", async () => {
    await ensureTscScratchReady();

    const originalFactory = readFileSync(join(TSC_SCRATCH_DIR, "factory.ts"), "utf-8");
    const brokenFactory = originalFactory.replace("input.serviceName", "input.doesNotExist");
    expect(brokenFactory).not.toEqual(originalFactory); // guards against a silent no-op replace

    writeFileSync(join(TSC_SCRATCH_DIR, "factory.ts"), brokenFactory);
    try {
      const { status, output } = runTsc();
      expect(status).not.toEqual(0);
      expect(output).toContain("doesNotExist");
    } finally {
      writeFileSync(join(TSC_SCRATCH_DIR, "factory.ts"), originalFactory);
    }
  });
});
