/**
 * S-003 — REQ-RXD-08: the JSX adversarial corpus (required capability, not optional). The
 * kit's own 6 mandatory samples (injected automatically by `testDialect`/`testOpPack`) are
 * JSX-blind and prove nothing about this dialect's actual syntax surface — this file's
 * 20-sample corpus is what does.
 *
 * Per ADR-0012 (mirrored from `test/conformance/typescript-conformance.test.ts`): the fixture
 * dialect below is assembled from the SAME real production building blocks
 * `src/dialects/react/index.ts` composes internally (`defineDialect`/`defineOpPack`/`withOps`
 * over the real `ast.ts` parse/print pair and the real `ops.ts` ops) — `index.ts` itself only
 * exports `find`, so conformance re-assembles the same real `Dialect`/`OpPack` objects rather
 * than importing a mock.
 */
import { describe, it, expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print } from "../../src/dialects/react/ast.ts";
import { setJsxProp, addImport } from "../../src/dialects/react/ops.ts";
import { testDialect, testOpPack, type DialectFixture, type OpPackFixture } from "../../src/conformance/index.ts";
import { golden } from "../support/golden.ts";

const REACT_GOLDEN_DIR = new URL("../dialects/react/golden/", import.meta.url).pathname;

function reactGolden(name: string): string {
  return golden(name, REACT_GOLDEN_DIR);
}

type ReactOps = {
  setJsxProp: (ast: SourceFile, elementName: string, propName: string, value?: string) => void;
  addImport: (ast: SourceFile, name: string, from: string) => void;
};

const reactOpsPack = defineOpPack<SourceFile, ReactOps>({ setJsxProp, addImport });
const baseReactDialect = defineDialect({ extensions: [".tsx"], ast: { parse, print }, ops: {} });
const realReactDialect = withOps(baseReactDialect, reactOpsPack);

// The 20-sample corpus (slices.md S-003 Contracts enumeration). #20 (angle-bracket-cast
// divergence) is DELIBERATELY excluded from this round-trip array — it is a parse-REJECT
// sample, not a round-trip sample (REQ-RXD-03.5's own contract), and is asserted separately
// below.

// 1. Fragments with nested children.
const FRAGMENTS = "const el = (\n  <>\n    <span>Hello</span>\n    <span>World</span>\n  </>\n);\n";

// 2. Self-closing tag.
const SELF_CLOSING = "const el = <Input />;\n";

// 3. Expression containers.
const EXPRESSION_CONTAINERS =
  "const el = (\n" +
  "  <div>\n" +
  "    {count}\n" +
  "    {items.map((item) => (\n" +
  "      <li key={item.id}>{item.name}</li>\n" +
  "    ))}\n" +
  "  </div>\n" +
  ");\n";

// 4. Spread props.
const SPREAD_PROPS = "const el = <Button {...rest} />;\n";

// 5. Namespaced attribute.
const NAMESPACED_ATTRIBUTE = 'const el = <use xlink:href="#id" />;\n';

// 6. HTML entities in JSX text.
const HTML_ENTITIES = "const el = <p>Value&nbsp;is&amp;here</p>;\n";

// 7. Comments-inside-JSX, explicit {/* x */} form.
const JSX_COMMENT = "const el = (\n  <div>\n    {/* explanatory comment */}\n    <span>ok</span>\n  </div>\n);\n";

// 8. Logical-AND conditional rendering.
const LOGICAL_AND = "const el = <div>{cond && <X />}</div>;\n";

// 9. Ternary rendering.
const TERNARY = "const el = <div>{cond ? <A /> : <B />}</div>;\n";

// 10. Parenthesised JSX return.
const PARENTHESISED_RETURN = "function Component() {\n  return (\n    <div />\n  );\n}\n";

// 11. Template-literal JSX-lookalike — must NOT be JSX-ified.
const TEMPLATE_LITERAL_LOOKALIKE = "const s = `<div>${x}</div>`;\n";

// 12. String-child JSX-lookalike.
const STRING_CHILD_LOOKALIKE = 'const el = <p>{"<script>"}</p>;\n';

// 13. Whitespace fidelity — `<br />` AND `<br/>`, the pre-`/>` space survives (or doesn't).
const WHITESPACE_FIDELITY = "const el = (\n  <div>\n    <br />\n    <br/>\n  </div>\n);\n";

// 14. TSX-only trailing-comma generic-arrow form.
const GENERIC_ARROW = "const id = <T,>(a: T) => a;\n";

// 15. `<Menu.Item/>` member-expression element.
const MEMBER_EXPRESSION_ELEMENT = "const el = <Menu.Item/>;\n";

// 16. Multi-line-attribute element (round-trip-only sample, distinct from the mutation-target
// fixture reused below from the S-001 golden).
const MULTILINE_ATTRIBUTES =
  "const el = (\n  <Input\n    type=\"text\"\n    value={value}\n    onChange={onChange}\n  />\n);\n";

// 17. CRLF + JSX.
const CRLF_JSX = "const el = (\r\n  <div>\r\n    hi\r\n  </div>\r\n);\r\n";

// 18. BOM + JSX.
const BOM_JSX = "﻿const el = <div>hi</div>;\n";

// 19. 4 MiB TSX sample (spike-measured ~200ms round-trip — acceptable).
const LARGE_TSX_SAMPLE = `/*${"a".repeat(4 * 1024 * 1024)}*/\nconst el = <div />;\n`;

// 20. Angle-bracket-cast divergence probe — a REJECT sample, exercised separately below, never
// inside the round-trip `samples` array.
const DIVERGENCE_PROBE = "const x = <string>y;\n";

const CORPUS_SAMPLES: string[] = [
  FRAGMENTS,
  SELF_CLOSING,
  EXPRESSION_CONTAINERS,
  SPREAD_PROPS,
  NAMESPACED_ATTRIBUTE,
  HTML_ENTITIES,
  JSX_COMMENT,
  LOGICAL_AND,
  TERNARY,
  PARENTHESISED_RETURN,
  TEMPLATE_LITERAL_LOOKALIKE,
  STRING_CHILD_LOOKALIKE,
  WHITESPACE_FIDELITY,
  GENERIC_ARROW,
  MEMBER_EXPRESSION_ELEMENT,
  MULTILINE_ATTRIBUTES,
  CRLF_JSX,
  BOM_JSX,
  LARGE_TSX_SAMPLE,
];

describe("REQ-RXD-08.1 — 20-sample JSX adversarial corpus round-trips byte-exact via testDialect", () => {
  it("all 19 round-trip corpus classes plus the 6 kit-mandatory samples round-trip byte-exact", async () => {
    expect(CORPUS_SAMPLES.length).toBe(19);
    const fixture: DialectFixture = { dialect: realReactDialect, samples: CORPUS_SAMPLES };
    await expect(testDialect(fixture)).resolves.toBeUndefined();
  });

  it("corpus class #20 (angle-bracket-cast divergence probe) REJECTS instead of round-tripping — completing the 20-class enumeration", () => {
    expect(() => realReactDialect.ast.parse(DIVERGENCE_PROBE)).toThrow();
  });
});

describe("REQ-RXD-08.2 — setJsxProp op-pack fidelity proven under real mutation across the corpus", () => {
  it("Menu.Item and multi-line-attribute insertion targets, plus a heterogeneous coalescing chain, all byte-exact against committed fixtures", async () => {
    const fixture: OpPackFixture = {
      opPack: reactOpsPack,
      baseDialect: realReactDialect,
      exercises: [
        {
          // <Menu.Item/> as an INSERTION target — member-expression targeting AND mutation
          // fidelity, proven through the conformance kit's own coalescing pipeline.
          seed: "const el = <Menu.Item />;\n",
          chain: [{ op: "setJsxProp", args: ["Menu.Item", "disabled"] }],
          expect: reactGolden("setprop-boolean-namespaced.txt"),
        },
        {
          // The multi-line-attribute element as an INSERTION target (reuses the S-001 golden
          // pair — the same fixture, proven again through a distinct execution path).
          seed: reactGolden("setprop-multiline-before.txt"),
          chain: [{ op: "setJsxProp", args: ["Button", "disabled", "{isBusy}"] }],
          expect: reactGolden("setprop-multiline-after.txt"),
        },
        {
          // Heterogeneous multi-op chain (>=2 ops, testOpPack's own mandatory-exercise rule) —
          // also satisfies REQ-RXD-07's "addImport+setJsxProp chain" coalescing proof per the
          // slice's own Contracts note.
          seed: "const el = <Button />;\n",
          chain: [
            { op: "setJsxProp", args: ["Button", "onClick", "{handleClick}"] },
            { op: "addImport", args: ["handleClick", "./handlers"] },
          ],
          expect: reactGolden("coalesce-setprop-addimport.txt"),
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
