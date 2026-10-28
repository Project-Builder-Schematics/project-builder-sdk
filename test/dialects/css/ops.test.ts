import { describe, it, expect } from "bun:test";
import { apply, expectFile, expectReject } from "./harness.ts";

const HEADER = '@import "tailwindcss";\n@custom-variant dark (&:where(.dark, .dark *));\n\n';
const TOKENS = `${HEADER}@theme {\n  --color-primary: #0b254d;\n  --radius: 4px;\n}\n`;
const THEME = { atRule: "theme" };
const ROOT = { selector: ":root" };

describe("setDeclaration — upsert in place (S3, S4)", () => {
  it("updates an existing value and leaves every other byte alone", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration(THEME, "--color-primary", "#1974f9"),
      `${HEADER}@theme {\n  --color-primary: #1974f9;\n  --radius: 4px;\n}\n`
    );
  });

  it("appends a new declaration last in its block", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration(THEME, "--color-accent", "#ff0"),
      `${HEADER}@theme {\n  --color-primary: #0b254d;\n  --radius: 4px;\n  --color-accent: #ff0;\n}\n`
    );
  });

  it("re-running with the same value emits nothing", async () => {
    await expectFile(TOKENS, (h) => h.setDeclaration(THEME, "--radius", "4px"), TOKENS);
  });

  it("coalesces a chain of edits into one modify", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration(THEME, "--radius", "8px").setDeclaration(THEME, "--color-accent", "#ff0"),
      `${HEADER}@theme {\n  --color-primary: #0b254d;\n  --radius: 8px;\n  --color-accent: #ff0;\n}\n`
    );
  });

  it("sets a regular property, matching its name case-insensitively", async () => {
    await expectFile(".btn {\n  COLOR: blue;\n}\n", (h) => h.setDeclaration({ selector: ".btn" }, "color", "red"), ".btn {\n  COLOR: red;\n}\n");
  });

  it("matches custom property names case-sensitively", async () => {
    await expectFile(":root {\n  --Color: blue;\n}\n", (h) => h.setDeclaration(ROOT, "--color", "red"), ":root {\n  --Color: blue;\n  --color: red;\n}\n");
  });

  it("keeps the compact style of a one-line block", async () => {
    await expectFile("a{color:red}", (h) => h.setDeclaration({ selector: "a" }, "--y", "1"), "a{color:red;--y:1}");
  });

  it("accepts a value whose `;` sits inside a string", async () => {
    await expectFile(".q {\n  color: red;\n}\n", (h) => h.setDeclaration({ selector: ".q" }, "content", '";"'), '.q {\n  color: red;\n  content: ";";\n}\n');
  });

  it("matches selector and params after trimming", async () => {
    await expectFile(
      "@media (min-width: 1px) {\n  :root {\n    --a: 1;\n  }\n}\n",
      (h) => h.setDeclaration({ atRule: "MEDIA", params: " (min-width: 1px) ", selector: " :root " }, "--a", "2"),
      "@media (min-width: 1px) {\n  :root {\n    --a: 2;\n  }\n}\n"
    );
  });
});

describe("setDeclaration — missing blocks (S5, S6)", () => {
  it("creates a missing selector block at the end of the file, after the hand-written header", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration({ selector: "html[data-theme='nylon']" }, "--color-primary", "#1974f9"),
      `${TOKENS}\nhtml[data-theme='nylon'] {\n  --color-primary: #1974f9;\n}\n`
    );
  });

  it("creates a missing at-rule with its rule inside", async () => {
    await expectFile(
      ":root {\n  --a: 1;\n}\n",
      (h) => h.setDeclaration({ atRule: "media", params: "(prefers-color-scheme: dark)", selector: ":root" }, "--a", "2"),
      ":root {\n  --a: 1;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --a: 2;\n  }\n}\n"
    );
  });

  it("creates a rule inside an existing at-rule", async () => {
    await expectFile(
      "@layer base {\n  a {\n    color: red;\n  }\n}\n",
      (h) => h.setDeclaration({ atRule: "layer", params: "base", selector: ":root" }, "--a", "1"),
      "@layer base {\n  a {\n    color: red;\n  }\n\n  :root {\n    --a: 1;\n  }\n}\n"
    );
  });

  it("creates the first block of an empty file", async () => {
    await expectFile("", (h) => h.setDeclaration(THEME, "--a", "1"), "@theme {\n  --a: 1;\n}\n");
  });

  it("follows the file's CRLF newlines and tab indentation", async () => {
    await expectFile(
      "a {\r\n\tcolor: red;\r\n}\r\n",
      (h) => h.setDeclaration(ROOT, "--a", "1"),
      "a {\r\n\tcolor: red;\r\n}\r\n\r\n:root {\r\n\t--a: 1;\r\n}\r\n"
    );
  });

  it("fills an existing empty block", async () => {
    await expectFile(":root {}\n", (h) => h.setDeclaration(ROOT, "--a", "1"), ":root {\n  --a: 1;\n}\n");
  });

  it("ignores an at-rule statement without a body", async () => {
    await expectFile(
      "@layer theme;\n",
      (h) => h.setDeclaration({ atRule: "layer", params: "theme" }, "--a", "1"),
      "@layer theme;\n\n@layer theme {\n  --a: 1;\n}\n"
    );
  });
});

describe("setDeclaration — anchors (S6)", () => {
  it("inserts after an anchor", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration(THEME, "--color-accent", "#ff0", { after: "--color-primary" }),
      `${HEADER}@theme {\n  --color-primary: #0b254d;\n  --color-accent: #ff0;\n  --radius: 4px;\n}\n`
    );
  });

  it("inserts before an anchor", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration(THEME, "--color-accent", "#ff0", { before: "--color-primary" }),
      `${HEADER}@theme {\n  --color-accent: #ff0;\n  --color-primary: #0b254d;\n  --radius: 4px;\n}\n`
    );
  });

  it("updates an existing declaration in place and ignores the anchor", async () => {
    await expectFile(
      TOKENS,
      (h) => h.setDeclaration(THEME, "--color-primary", "#000", { after: "--missing" }),
      `${HEADER}@theme {\n  --color-primary: #000;\n  --radius: 4px;\n}\n`
    );
  });

  it("fails on a missing anchor", async () => {
    await expectReject(TOKENS, (h) => h.setDeclaration(THEME, "--color-accent", "#ff0", { after: "--missing" }), "`--missing`");
  });

  it("fails on an anchor when the block does not exist yet", async () => {
    await expectReject(TOKENS, (h) => h.setDeclaration(ROOT, "--a", "1", { before: "--b" }), "`--b`");
  });

  it("fails when both anchors are given", async () => {
    await expectReject(TOKENS, (h) => h.setDeclaration(THEME, "--x", "1", { before: "--radius", after: "--radius" }), "not both");
  });
});

describe("setDeclaration — important (S7)", () => {
  it("adds and keeps !important through the option", async () => {
    const seed = ".a {\n  color: blue;\n}\n";
    const expected = ".a {\n  color: red !important;\n}\n";
    await expectFile(seed, (h) => h.setDeclaration({ selector: ".a" }, "color", "red", { important: true }), expected);
    await expectFile(expected, (h) => h.setDeclaration({ selector: ".a" }, "color", "red", { important: true }), expected);
  });

  it("drops !important when the option is omitted", async () => {
    await expectFile(".a {\n  color: red !important;\n}\n", (h) => h.setDeclaration({ selector: ".a" }, "color", "red"), ".a {\n  color: red;\n}\n");
  });

  it("rejects !important inside the value", async () => {
    await expectReject(TOKENS, (h) => h.setDeclaration(THEME, "--a", "1 !important"), "`important` option");
  });
});

describe("setDeclaration — fails closed (S8)", () => {
  it.each([
    ["a second declaration", "red; background: url(x)"],
    ["a closing brace", "red}"],
    ["a comment", "red /* x */"],
    ["an empty value", "  "],
  ])("rejects a value carrying %s", async (_, value) => {
    await expectReject(TOKENS, (h) => h.setDeclaration(THEME, "color", value), "single declaration value");
  });

  it.each(["color red", "--", "1abc", "co:lor", ""])("rejects the property name %p", async (property) => {
    await expectReject(TOKENS, (h) => h.setDeclaration(THEME, property, "1"), "property name");
  });

  it.each([
    [{}, "`selector`, an `atRule`"],
    [{ params: "x" }, "`params` needs an `atRule`"],
    [{ selector: "a{}b" }, "not a single selector"],
    [{ atRule: "@media" }, "not an at-rule name"],
    [{ atRule: "media", params: "x{}" }, "not at-rule params"],
  ])("rejects the target %p", async (target, fragment) => {
    await expectReject(TOKENS, (h) => h.setDeclaration(target, "--a", "1"), fragment);
  });

  it("rejects a target matching more than one block", async () => {
    await expectReject(":root {\n  --a: 1;\n}\n:root {\n  --b: 2;\n}\n", (h) => h.setDeclaration(ROOT, "--a", "3"), "2 blocks");
  });

  it("rejects a property declared more than once in the block", async () => {
    await expectReject(".box {\n  display: -webkit-box;\n  display: flex;\n}\n", (h) => h.setDeclaration({ selector: ".box" }, "display", "grid"), "2 times");
  });

  it("rejects invalid CSS", async () => {
    const outcome = await apply("a {", (h) => h.setDeclaration({ selector: "a" }, "color", "red"));
    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.modifies).toBe(0);
  });
});

describe("removeDeclaration (S4, S8)", () => {
  it("removes a declaration and leaves the rest alone", async () => {
    await expectFile(TOKENS, (h) => h.removeDeclaration(THEME, "--radius"), `${HEADER}@theme {\n  --color-primary: #0b254d;\n}\n`);
  });

  it("matches a regular property case-insensitively", async () => {
    await expectFile(".a {\n  Color: red;\n  margin: 0;\n}\n", (h) => h.removeDeclaration({ selector: ".a" }, "color"), ".a {\n  margin: 0;\n}\n");
  });

  it.each([
    ["the block is missing", ROOT, "--radius"],
    ["the property is missing", THEME, "--missing"],
  ])("is a no-op when %s", async (_, target, property) => {
    await expectFile(TOKENS, (h) => h.removeDeclaration(target, property), TOKENS);
  });

  it("rejects a property declared more than once", async () => {
    await expectReject(".box {\n  display: -webkit-box;\n  display: flex;\n}\n", (h) => h.removeDeclaration({ selector: ".box" }, "display"), "2 times");
  });

  it("rejects an invalid property name", async () => {
    await expectReject(TOKENS, (h) => h.removeDeclaration(THEME, "co lor"), "property name");
  });
});
