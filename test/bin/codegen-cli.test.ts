/**
 * pbuilder-codegen CLI e2e (S-001, design §4.6): TFO-03.1/.2 (static package.json checks),
 * TFO-04.1-.6 (error/success path discipline), TFO-05.1-.3 (write containment +
 * symlink-escape), FPS-01.1 (schema.json discovery), FPS-05.1 (usage output), and the
 * TFO-01/SEC-1 hostile-schema emitter-inertness red-proof.
 *
 * Spawns the BUILT artifact (`dist/bin/pbuilder-codegen.js`) via explicit `bun <path>`
 * (ADR-0027 Gap 9: Bun is the guaranteed CI runtime, `node` is not) — never relying on the
 * shebang/exec bit. Self-building via an unconditional `beforeAll` (FIT-04 precedent,
 * slices constraint 10) so a bare `bun test` on a fresh checkout stays green without an
 * external build-then-test protocol.
 */
import { describe, it, expect, beforeAll, afterEach } from "bun:test";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { spawnCapture, seedSchema } from "../support/canary.ts";
import { USAGE, SUCCESS_LINE, GENERATED_FILENAME } from "../../bin/pbuilder-codegen.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_BIN = join(PROJECT_ROOT, "dist/bin/pbuilder-codegen.js");

beforeAll(() => {
  const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `codegen-cli: bun run build failed — cannot spawn the bin without a fresh build.\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
});

function runBin(args: string[], cwd: string = PROJECT_ROOT) {
  return spawnCapture("bun", [DIST_BIN, ...args], { cwd });
}

const tempDirs: string[] = [];

function scratchDir(): string {
  const dir = mkdtempSync(join(PROJECT_ROOT, ".tmp-codegen-cli-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const VALID_SCHEMA = { properties: { port: { type: "number", label: "Server port", required: true } } };

describe("pbuilder-codegen CLI — usage discipline (FPS-05.1)", () => {
  it("no arguments: usage on STDERR, non-zero exit, STDOUT empty", () => {
    const result = runBin([]);

    expect(result.status).not.toEqual(0);
    expect(result.stdout).toEqual("");
    expect(result.stderr).toContain("pbuilder-codegen <package-dir>");
  });

  it("unrecognized flag: usage on STDERR, non-zero exit", () => {
    const result = runBin(["--nonsense"]);

    expect(result.status).not.toEqual(0);
    expect(result.stderr).toContain("pbuilder-codegen <package-dir>");
  });

  it("--help: usage on STDOUT, exit 0", () => {
    const result = runBin(["--help"]);

    expect(result.status).toEqual(0);
    expect(result.stdout).toContain("pbuilder-codegen <package-dir>");
  });

  it("usage text names the tool's purpose and the literal invocation form (TW-m5)", () => {
    expect(USAGE).toContain("pbuilder-codegen <package-dir>");
    expect(USAGE.toLowerCase()).toContain("schema");
  });
});

describe("pbuilder-codegen CLI — bin invocation discipline (TFO-03.1/.2)", () => {
  const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
    scripts: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  it("no postinstall (or equivalent lifecycle) script invokes the bin", () => {
    expect(pkgJson.scripts.postinstall).toBeUndefined();
  });

  it("zero-runtime-deps preserved — package.json#dependencies stays absent or empty", () => {
    expect(Object.keys(pkgJson.dependencies ?? {})).toEqual([]);
  });
});

describe("pbuilder-codegen CLI — success + discovery (FPS-01.1, TFO-04.2)", () => {
  it("discovers schema.json without a path argument and prints the fixed success line", () => {
    const dir = scratchDir();
    seedSchema(dir, VALID_SCHEMA);

    const result = runBin([dir]);

    expect(result.status).toEqual(0);
    expect(result.stdout).toEqual(`${SUCCESS_LINE}\n`);
    expect(result.stderr).toEqual("");
    expect(existsSync(join(dir, GENERATED_FILENAME))).toBe(true);
  });
});

describe("pbuilder-codegen CLI — malformed schema.json (TFO-04.1, .3, .4, .6)", () => {
  it("invalid JSON: non-zero exit, STDERR-only, names the file + problem, writes nothing", () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    Bun.write(join(dir, "schema.json"), "{ not valid json");

    const result = runBin([dir]);

    expect(result.status).not.toEqual(0);
    expect(result.stdout).toEqual("");
    expect(result.stderr).toContain(join(dir, "schema.json"));
    expect(result.stderr).toContain("invalid JSON");
    expect(existsSync(join(dir, GENERATED_FILENAME))).toBe(false);
  });

  it("parse failure carries a concrete (line, column) locator for a structural syntax error " +
     "(ADR-0032: the hand-rolled scanner, not the dead V8-only engine-message extraction)", () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    const malformed = readFileSync(
      join(PROJECT_ROOT, "test/fixtures/red/schema/malformed-syntax/schema.json"),
      "utf-8",
    );
    Bun.write(join(dir, "schema.json"), malformed);

    const result = runBin([dir]);

    expect(result.stderr).toContain("(line 4, column 15)");
  });

  it("parse failure falls back to (position unknown) for the bounded in-string-escape class " +
     "(ADR-0032: the scanner consumes strings structurally, deliberately not validating " +
     "escape internals)", () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    const badEscape = readFileSync(
      join(PROJECT_ROOT, "test/fixtures/red/schema/bad-unicode-escape/schema.json"),
      "utf-8",
    );
    Bun.write(join(dir, "schema.json"), badEscape);

    const result = runBin([dir]);

    expect(result.stderr).toContain("(position unknown)");
  });

  it("error message never surfaces the raw JavaScriptCore parser text", () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    Bun.write(join(dir, "schema.json"), "{");

    const result = runBin([dir]);

    expect(result.stderr).not.toContain("JSON Parse error");
    expect(result.stderr).not.toContain("SyntaxError");
  });

  it("a deeply-nested malformed schema.json degrades to (position unknown) instead of dumping an " +
     "uncaught RangeError/internal dist/bin stack (locator stack-overflow, fail-closed message contract)", () => {
    const dir = scratchDir();
    mkdirSync(dir, { recursive: true });
    const deepNesting = readFileSync(
      join(PROJECT_ROOT, "test/fixtures/red/schema/deep-nesting/schema.json"),
      "utf-8",
    );
    Bun.write(join(dir, "schema.json"), deepNesting);

    const result = runBin([dir]);

    expect(result.status).not.toEqual(0);
    expect(result.stdout).toEqual("");
    expect(result.stderr).toEqual(`pbuilder-codegen: ${join(dir, "schema.json")}: invalid JSON (position unknown)\n`);
    expect(result.stderr).not.toContain("RangeError");
    expect(result.stderr).not.toContain("Maximum call stack");
    expect(result.stderr).not.toContain("dist/bin");
    expect(existsSync(join(dir, GENERATED_FILENAME))).toBe(false);
  });

  it("a malformed re-run does not destroy a prior valid generated output (non-destructive)", () => {
    const dir = scratchDir();
    seedSchema(dir, VALID_SCHEMA);
    const first = runBin([dir]);
    expect(first.status).toEqual(0);
    const priorContent = readFileSync(join(dir, GENERATED_FILENAME), "utf-8");

    Bun.write(join(dir, "schema.json"), "{ not valid json");
    const second = runBin([dir]);

    expect(second.status).not.toEqual(0);
    expect(readFileSync(join(dir, GENERATED_FILENAME), "utf-8")).toEqual(priorContent);
  });
});

describe("pbuilder-codegen CLI — write containment (TFO-05.1-.3, SEC-4)", () => {
  it("TFO-05.1: normal invocation writes ONLY the fixed adjacent schema.generated.ts", () => {
    const dir = scratchDir();
    seedSchema(dir, VALID_SCHEMA);
    const before = readdirSync(dir).sort();

    const result = runBin([dir]);

    expect(result.status).toEqual(0);
    const after = readdirSync(dir).sort();
    expect(after).toEqual([...before, GENERATED_FILENAME].sort());
  });

  it("TFO-05.2: a path-escaping argument (../../etc) is refused before any write", () => {
    const result = runBin(["../../etc"]);

    expect(result.status).not.toEqual(0);
    expect(existsSync(join(PROJECT_ROOT, "../../etc/schema.generated.ts"))).toBe(false);
  });

  it("TFO-05.2: a symlink whose real target escapes the project root is refused (post-realpath containment)", () => {
    const outsideTarget = mkdtempSync(join(tmpdir(), "pbuilder-codegen-escape-"));
    seedSchema(outsideTarget, VALID_SCHEMA);
    const linkParent = scratchDir();
    const link = join(linkParent, "escaped-package");
    symlinkSync(outsideTarget, link);

    try {
      const result = runBin([link]);

      expect(result.status).not.toEqual(0);
      expect(existsSync(join(outsideTarget, GENERATED_FILENAME))).toBe(false);
    } finally {
      rmSync(outsideTarget, { recursive: true, force: true });
    }
  });

  it("TFO-05.3: schema-derived path-shaped content never influences the output location", () => {
    const dir = scratchDir();
    seedSchema(dir, {
      properties: {
        port: { type: "number", label: "Server port", required: true, default: "../../escape" },
      },
    });

    const result = runBin([dir]);

    expect(result.status).toEqual(0);
    expect(existsSync(join(dir, GENERATED_FILENAME))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, "../escape"))).toBe(false);
  });
});

describe("pbuilder-codegen CLI — hostile-schema emitter inertness (TFO-01 SEC-1 row, constraint 2)", () => {
  it("a hostile label/enum-choice payload is emitted inert — no live breakout in the generated .ts", () => {
    const dir = scratchDir();
    seedSchema(dir, {
      properties: {
        mode: {
          type: "enum",
          label: '*/ import("evil"); /*',
          choices: ['"; import("evil"); //'],
          required: true,
        },
      },
    });

    const result = runBin([dir]);

    expect(result.status).toEqual(0);
    const generated = readFileSync(join(dir, GENERATED_FILENAME), "utf-8");
    // The hostile label's `*/` breakout is escaped (never a live comment-close).
    expect(generated).not.toContain('*/ import("evil"); /*');
    // The hostile enum choice reaches the output ONLY through JSON.stringify (SEC-1) —
    // never as an unescaped string that could break out of the union-literal position.
    expect(generated).toContain(JSON.stringify('"; import("evil"); //'));
  });

  it("a hostile `type` value (injection payload) is refused BEFORE any write — never reaches " +
     "the generated .ts, and the CLI fails closed with the standard template rather than an " +
     "uncaught internal stack (TFO-01/SEC-1 emit-boundary gap)", () => {
    const dir = scratchDir();
    const injection = 'string;\nexport const PWNED = eval("process.env");\ntype _junk = {\n bar: string';
    seedSchema(dir, {
      properties: {
        port: { type: injection, label: "Server port", required: true },
      },
    });

    const result = runBin([dir]);

    expect(result.status).not.toEqual(0);
    expect(result.stdout).toEqual("");
    expect(existsSync(join(dir, GENERATED_FILENAME))).toBe(false);
    expect(result.stderr).not.toContain("PWNED");
    expect(result.stderr).not.toContain("eval(");
    expect(result.stderr).not.toContain("_junk");
    expect(result.stderr).not.toContain("dist/bin");
    expect(result.stderr).not.toContain(" at ");
    expect(result.stderr.startsWith("pbuilder-codegen: ")).toBe(true);
  });

  it("the silent-widening variant (`type: \"any\"`) is rejected, never silently emitted as `any`, " +
     "and fails closed with the standard template", () => {
    const dir = scratchDir();
    seedSchema(dir, {
      properties: {
        port: { type: "any", label: "Server port", required: true },
      },
    });

    const result = runBin([dir]);

    expect(result.status).not.toEqual(0);
    expect(existsSync(join(dir, GENERATED_FILENAME))).toBe(false);
    expect(result.stderr).not.toContain("dist/bin");
    expect(result.stderr).not.toContain(" at ");
    expect(result.stderr.startsWith("pbuilder-codegen: ")).toBe(true);
  });
});
