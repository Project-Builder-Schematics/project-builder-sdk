/**
 * sdk#149, architecture A-17: every component of a path under the scaffold source folder is
 * checked as written on disk, before token translation, with the engine's rule and
 * character vocabulary (`CheckPortableName`), on every OS.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkSourceName, checkSourceNames } from "../../../../../../src/bounded-contexts/authoring/domain/services/filename-pipeline.ts";
import { runFactoryForTest } from "../../../../../../src/testing/index.ts";
import { scaffold, AuthoringError } from "../../../../../../src/commons/index.ts";
import { scratchDirFactory } from "../../../../../support/scratch-dir.ts";
import { collectOps } from "../../../../../support/spy-client.ts";
import { expectReason } from "../../../../../support/expect-reason.ts";

const scratchDir = scratchDirFactory("file-name-check-");

function message(path: string, name: string, rule: string, character?: string): string {
  const suffix = character === undefined ? "" : ` (${character})`;
  return `invalid input: scaffold file name "${path}": the name "${name}" breaks the rule "${rule}"${suffix}`;
}

function expectRejected(path: string, name: string, rule: string, character?: string): void {
  const err = expectReason(() => checkSourceName(path), "invalid-input");
  expect(err.message).toEqual(message(path, name, rule, character));
}

describe("A-17 — template syntax in a name is rejected", () => {
  it.each([
    ["{= .name =}.ts", "{= .name =}.ts"],
    ["{= .dir =}/a.ts", "{= .dir =}"],
    ["src/{= .name | dasherize =}.ts.template", "{= .name | dasherize =}.ts.template"],
    ["{= .dir | dasherize =}/a.ts", "{= .dir | dasherize =}"],
    ["a=}.ts", "a=}.ts"],
  ])("%s", (path, name) => expectRejected(path, name, "template syntax"));
});

describe("A-17 — a character Windows forbids is rejected in a file or directory name", () => {
  const characters: Array<[string, string]> = [
    ["|", "vertical bar"],
    ['"', "double quote"],
    ["<", "less-than sign"],
    [">", "greater-than sign"],
    [":", "colon"],
    ["?", "question mark"],
    ["*", "asterisk"],
    ["\\", "backslash"],
    ["\x00", "control character 0x00"],
    ["\x01", "control character 0x01"],
    ["\x09", "control character 0x09"],
    ["\x1F", "control character 0x1F"],
  ];
  it.each(characters)("file name holding %j", (ch, character) =>
    expectRejected(`src/a${ch}b.ts`, `a${ch}b.ts`, "forbidden character", character)
  );
  it.each(characters)("directory name holding %j", (ch, character) =>
    expectRejected(`a${ch}b/x.ts`, `a${ch}b`, "forbidden character", character)
  );
});

describe("A-17 — a reserved device name is rejected whatever its letter case and extension", () => {
  it.each([
    ["con", "con"],
    ["Nul.txt", "Nul.txt"],
    ["COM1.ts", "COM1.ts"],
    ["lpt9", "lpt9"],
    ["src/prn.md", "prn.md"],
    ["aux.config.json", "aux.config.json"],
    ["CON/a.ts", "CON"],
    ["src/Com9/a.ts", "Com9"],
    ["COM0.ts", "COM0.ts"],
    ["lpt0", "lpt0"],
    ["COM¹.ts", "COM¹.ts"],
    ["com².md", "com².md"],
    ["src/LPT³/a.ts", "LPT³"],
    ["NUL .txt", "NUL .txt"],
    ["con  .ts", "con  .ts"],
  ])("%s", (path, name) => expectRejected(path, name, "reserved device name"));
});

describe("A-17 — a name that ends in a dot or a space is rejected", () => {
  it.each([
    ["widget.", "widget.", "trailing dot"],
    ["src./a.ts", "src.", "trailing dot"],
    ["widget.ts ", "widget.ts ", "trailing space"],
    ["src /a.ts", "src ", "trailing space"],
  ])("%j", (path, name, rule) => expectRejected(path, name, rule));
});

describe("A-17 — allowed names pass", () => {
  it.each([
    "CONSOLE.ts",
    "com10.ts",
    "nul-check.ts",
    "aux_",
    "lpt10/a.ts",
    "a{b}.ts",
    "x=y.ts",
    "{a}/=b.ts",
    "plain/path.ts",
    "__name@dasherize__.svc.ts",
    "src/__group@dasherize__/__name@camelize@classify__.ts.template",
    "__tests__/a.test.ts",
    "CONIN$",
  ])("%s", (path) => expect(() => checkSourceName(path)).not.toThrow());
});

describe("A-17 — scaffold() checks every walked entry before include/exclude and emits nothing", () => {
  function packageWith(files: string[]): string {
    const dir = scratchDir();
    for (const f of files) {
      const abs = join(dir, "files", f);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "x", "utf-8");
    }
    return dir;
  }

  it("an excluded con.ts still rejects the call, naming its path and the rule", async () => {
    const dir = packageWith(["a.ts", "con.ts"]);
    const result = await runFactoryForTest(
      () => {
        scaffold({ from: "files", to: "out", exclude: ["con.ts"] });
      },
      undefined,
      { packageDir: dir }
    );

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("invalid-input");
    expect((result.error as AuthoringError).message).toContain(message("con.ts", "con.ts", "reserved device name"));
    expect(result.emitted).toEqual([]);
  });

  it("a directory written in the template syntax rejects the call", async () => {
    const dir = packageWith(["{= .dir =}/a.ts"]);
    const result = await runFactoryForTest(
      () => {
        scaffold({ from: "files", to: "out" });
      },
      undefined,
      { packageDir: dir }
    );

    expect((result.error as AuthoringError).message).toContain(message("{= .dir =}/a.ts", "{= .dir =}", "template syntax"));
    expect(result.emitted).toEqual([]);
  });

  it("a lone brace stays as written in the path template", async () => {
    const dir = packageWith(["a{b}.ts"]);
    const result = await runFactoryForTest(
      () => {
        scaffold({ from: "files", to: "out" });
      },
      undefined,
      { packageDir: dir }
    );

    expect(result.error).toBeUndefined();
    expect(collectOps(result.emitted, "create").map((d) => d.create.pathTemplate)).toEqual(["out/a{b}.ts"]);
  });
});

describe("A-17 — only spaces are removed from the end of a device-name stem", () => {
  it("a no-break space before the extension keeps CON from matching", () => {
    expect(() => checkSourceName("CON .ts")).not.toThrow();
  });

  it("an ideographic space before a trailing dot is judged by the trailing dot", () =>
    expectRejected("CON　.", "CON　.", "trailing dot"));
});

describe("A-17 — with several bad names, the first in byte-wise (UTF-8) order is reported, as the engine does", () => {
  it("a/b?.ts is reported before c:d.ts whatever the walk order", () => {
    const err = expectReason(() => checkSourceNames(["c:d.ts", "a/b?.ts"]), "invalid-input");
    expect(err.message).toEqual(message("a/b?.ts", "b?.ts", "forbidden character", "question mark"));
  });

  it("orders by code point, not UTF-16 code unit: U+FF01 comes before U+1F600", () => {
    const err = expectReason(() => checkSourceNames(["\u{1F600}|.ts", "\uFF01|.ts"]), "invalid-input");
    expect(err.message).toEqual(message("\uFF01|.ts", "\uFF01|.ts", "forbidden character", "vertical bar"));
  });
});
