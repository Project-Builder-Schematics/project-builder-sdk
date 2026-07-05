/**
 * KIT-03: DirectiveFactory.create — pure, ADR-0028 shapes, template unrendered.
 */
import { describe, it, expect } from "bun:test";
import { DirectiveFactory } from "../../src/core/directive-factory.ts";

describe("DirectiveFactory.create", () => {
  it("returns a directive with op:create and the exact provided fields", () => {
    const factory = new DirectiveFactory();
    const directive = factory.create({
      pathTemplate: "src/{= name =}.ts",
      template: "export const {= name =} = 1;",
      options: { name: "foo" },
    });

    expect(directive).toEqual({
      op: "create",
      create: {
        pathTemplate: "src/{= name =}.ts",
        template: "export const {= name =} = 1;",
        options: { name: "foo" },
      },
    });
  });

  it("passes template bytes through unrendered — DSL syntax is preserved verbatim", () => {
    const factory = new DirectiveFactory();
    const template = "<% for (const m of methods) { %>{= m.name =}()<% } %>";
    const directive = factory.create({
      pathTemplate: "out.ts",
      template,
      options: { methods: [{ name: "load" }] },
    });

    expect(directive.op).toEqual("create");
    if (directive.op === "create") {
      expect(directive.create.template).toEqual(template);
    }
  });

  it("includes force when provided", () => {
    const factory = new DirectiveFactory();
    const directive = factory.create({
      pathTemplate: "a.ts",
      template: "",
      options: {},
      force: true,
    });

    if (directive.op === "create") {
      expect(directive.create.force).toEqual(true);
    }
  });

  it("omits force key when not provided", () => {
    const factory = new DirectiveFactory();
    const directive = factory.create({ pathTemplate: "a.ts", template: "", options: {} });

    if (directive.op === "create") {
      expect("force" in directive.create).toEqual(false);
    }
  });
});

describe("DirectiveFactory.move (REQ-KIT-03.1 — force threading)", () => {
  it("threads force:true from MoveArgs to the wire directive", () => {
    const factory = new DirectiveFactory();
    const directive = factory.move({ path: "src/foo.ts", toDir: "lib", force: true });

    expect(directive).toEqual({
      op: "move",
      move: { path: "src/foo.ts", toDir: "lib", force: true },
    });
  });

  it("omits force key when not provided (REQ-KIT-03.3)", () => {
    const factory = new DirectiveFactory();
    const directive = factory.move({ path: "src/foo.ts", toDir: "lib" });

    if (directive.op === "move") {
      expect("force" in directive.move).toEqual(false);
    }
  });
});
