/**
 * GIR-01 / KIT-03: Golden-IR — each DirectiveFactory op deep-equals a hand-written fixture.
 * Exact keys, no extras. `create` proves template is byte-identical (unrendered DSL survives verbatim).
 * `remove` asserts op:"delete" (author verb ≠ wire op — ADR-0013 vocabulary).
 * `copy` is shape-only; no apply logic.
 */
import { describe, it, expect } from "bun:test";
import { DirectiveFactory } from "../../src/core/directive-factory.ts";
import {
  GOLDEN_CREATE,
  GOLDEN_MODIFY,
  GOLDEN_DELETE,
  GOLDEN_RENAME,
  GOLDEN_MOVE,
  GOLDEN_MOVE_FORCE,
  GOLDEN_COPY,
} from "./fixtures.ts";

const factory = new DirectiveFactory();

describe("DirectiveFactory golden-IR", () => {
  it("create — exact keys, template byte-identical (DSL syntax unrendered)", () => {
    const directive = factory.create({
      pathTemplate: GOLDEN_CREATE.create.pathTemplate,
      template: GOLDEN_CREATE.create.template,
      options: GOLDEN_CREATE.create.options,
    });
    expect(directive).toEqual(GOLDEN_CREATE);
  });

  it("modify — exact keys { op:\"modify\", modify:{ path, content } }", () => {
    const directive = factory.modify({
      path: GOLDEN_MODIFY.modify.path,
      content: GOLDEN_MODIFY.modify.content,
    });
    expect(directive).toEqual(GOLDEN_MODIFY);
  });

  it("remove — author verb maps to wire op:\"delete\" (ADR-0013 vocabulary)", () => {
    const directive = factory.remove({ path: GOLDEN_DELETE.delete.path });
    expect(directive).toEqual(GOLDEN_DELETE);
  });

  it("rename — exact keys { op:\"rename\", rename:{ path, newName } }", () => {
    const directive = factory.rename({
      path: GOLDEN_RENAME.rename.path,
      newName: GOLDEN_RENAME.rename.newName,
    });
    expect(directive).toEqual(GOLDEN_RENAME);
  });

  it("move — exact keys { op:\"move\", move:{ path, toDir } }", () => {
    const directive = factory.move({
      path: GOLDEN_MOVE.move.path,
      toDir: GOLDEN_MOVE.move.toDir,
    });
    expect(directive).toEqual(GOLDEN_MOVE);
  });

  it("move with force — exact keys { op:\"move\", move:{ path, toDir, force } } (ADR-0017 closure — new fixture)", () => {
    const directive = factory.move({
      path: GOLDEN_MOVE_FORCE.move.path,
      toDir: GOLDEN_MOVE_FORCE.move.toDir,
      force: true,
    });
    expect(directive).toEqual(GOLDEN_MOVE_FORCE);
  });

  it("copy — shape-only { op:\"copy\", copy:{ from, to } } (apply deferred to vNext)", () => {
    const directive = factory.copy({
      from: GOLDEN_COPY.copy.from,
      to: GOLDEN_COPY.copy.to,
    });
    expect(directive).toEqual(GOLDEN_COPY);
  });
});

describe("DirectiveFactory optional force key — triangulation", () => {
  it("rename includes force:true when provided", () => {
    const directive = factory.rename({ path: "src/a.ts", newName: "b.ts", force: true });
    expect(directive).toEqual({ op: "rename", rename: { path: "src/a.ts", newName: "b.ts", force: true } });
  });

  it("rename omits force key when not provided", () => {
    const directive = factory.rename({ path: "src/a.ts", newName: "b.ts" });
    if (directive.op === "rename") {
      expect("force" in directive.rename).toEqual(false);
    }
  });

  it("copy includes force:true when provided", () => {
    const directive = factory.copy({ from: "a/icon.png", to: "b/icon.png", force: true });
    expect(directive).toEqual({ op: "copy", copy: { from: "a/icon.png", to: "b/icon.png", force: true } });
  });

  it("copy omits force key when not provided", () => {
    const directive = factory.copy({ from: "a/icon.png", to: "b/icon.png" });
    if (directive.op === "copy") {
      expect("force" in directive.copy).toEqual(false);
    }
  });
});
