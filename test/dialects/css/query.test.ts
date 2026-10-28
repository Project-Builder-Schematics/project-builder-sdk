import { describe, it, expect } from "bun:test";
import * as css from "../../../src/dialects/css/index.ts";
import { parse } from "../../../src/dialects/css/ast.ts";
import { expectFile } from "./harness.ts";

const TOKENS = '@import "tailwindcss";\n\n@theme {\n  --color-primary: #0b254d;\n  COLOR: red !important;\n}\n';
const THEME = { atRule: "theme" };

describe("getDeclaration (S10)", () => {
  it("returns the value and importance of a declaration", () => {
    const root = parse(TOKENS);
    expect(css.getDeclaration(root, THEME, "--color-primary")).toEqual({ value: "#0b254d", important: false });
    expect(css.getDeclaration(root, THEME, "color")).toEqual({ value: "red", important: true });
  });

  it.each([
    ["the block is missing", { selector: ":root" }, "--color-primary"],
    ["the property is missing", THEME, "--missing"],
    ["a custom property differs in case", THEME, "--Color-primary"],
  ])("returns undefined when %s", (_, target, property) => {
    expect(css.getDeclaration(parse(TOKENS), target, property)).toBeUndefined();
  });

  it.each([
    [":root {}\n:root {}\n", { selector: ":root" }, "--a", "2 blocks"],
    [".b {\n  display: block;\n  display: flex;\n}\n", { selector: ".b" }, "display", "2 times"],
    [TOKENS, {}, "--a", "`selector`, an `atRule`"],
    [TOKENS, THEME, "co lor", "property name"],
  ])("rejects what the ops reject: %p", (source, target, property, fragment) => {
    expect(() => css.getDeclaration(parse(source), target, property)).toThrow(fragment);
  });

  it("drives a decision inside .modify()", async () => {
    await expectFile(
      TOKENS,
      (h) =>
        h.modify((root) => {
          if (css.getDeclaration(root, THEME, "--color-primary")?.value === "#0b254d") {
            root.walkDecls("--color-primary", (node) => {
              node.value = "#1974f9";
            });
          }
        }),
      TOKENS.replace("#0b254d", "#1974f9")
    );
  });
});
