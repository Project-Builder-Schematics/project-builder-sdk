/**
 * S-002.2 — dryRunPlan: all-ops mapping, primary-path extraction, write-only-chain equality.
 * Unit: ops → DryRunEntry; Integration: snapshot from real Session equals buffered directives.
 *
 * Wire→author verb mapping (frozen, seven rows — identity for six ops, one translation):
 *   create  → create
 *   modify  → modify
 *   delete  → remove
 *   rename  → rename
 *   move    → move
 *   copy    → copy
 *   copyIn  → copyIn
 *
 * Primary path per op (from wire.ts):
 *   create  → create.pathTemplate
 *   modify  → modify.path
 *   delete  → delete.path
 *   rename  → rename.path
 *   move    → move.path
 *   copy    → copy.from
 *   copyIn  → copyIn.from
 *
 * verb = author vocabulary (create/modify/remove/rename/move/copy/copyIn) — dryRunPlan
 * never emits the wire op tag "delete"; the frozen map above renders it as "remove".
 *
 * S-003 (REQ-DRE-05/06): `copyIn` is ALWAYS tagged `kind: "copied"` — never classified,
 * never rendered (REQ-FEH-03) — and renders under author verb `"copyIn"` regardless of
 * whether it was emitted via a direct `copyIn()` call or a `scaffold` by-reference entry
 * (REQ-DRE-06, wire-encoding agnostic).
 */
import { describe, it, expect } from "bun:test";
import { dryRunPlan } from "../../src/dry-run/index.ts";
import type { DryRunEntry } from "../../src/dry-run/index.ts";
import { Session } from "../../src/core/session.ts";
import { DirectiveFactory } from "../../src/core/directive-factory.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Directive } from "../../src/core/wire.ts";

function makeNoopClient(): EngineClient {
  return {
    async emit() {},
    async read() { return ""; },
    async commit() {},
    async discard() {},
  };
}

describe("dryRunPlan — unit: op mapping (REQ-04.1, REQ-04.2)", () => {
  it("REQ-04.1 — create op maps to {verb:'create', path:'src/foo.ts'}", () => {
    const directive: Directive = {
      op: "create",
      create: { pathTemplate: "src/foo.ts", template: "t", options: {} },
    };

    const result = dryRunPlan([directive]);

    expect(result).toEqual([
      { verb: "create", path: "src/foo.ts", kind: "rendered" },
    ] satisfies DryRunEntry[]);
  });

  it("REQ-04.2 — all seven ops map correctly with their primary path", () => {
    const directives: Directive[] = [
      { op: "create", create: { pathTemplate: "src/a.ts", template: "t", options: {} } },
      { op: "modify", modify: { path: "src/b.ts", content: "c" } },
      { op: "delete", delete: { path: "src/c.ts" } },
      { op: "rename", rename: { path: "src/d.ts", newName: "d2.ts" } },
      { op: "move", move: { path: "src/e.ts", toDir: "lib" } },
      { op: "copy", copy: { from: "src/f.ts", to: "src/g.ts" } },
      { op: "copyIn", copyIn: { from: "src/h.ts", to: "src/i.ts" } },
    ];

    const result = dryRunPlan(directives);

    expect(result).toEqual([
      { verb: "create", path: "src/a.ts", kind: "rendered" },
      { verb: "modify", path: "src/b.ts" },
      { verb: "remove", path: "src/c.ts" },
      { verb: "rename", path: "src/d.ts" },
      { verb: "move",   path: "src/e.ts" },
      { verb: "copy",   path: "src/f.ts" },
      { verb: "copyIn", path: "src/h.ts", kind: "copied" },
    ] satisfies DryRunEntry[]);
  });

  it("REQ-DRE-05.2 — a copyIn entry is always tagged 'copied', never 'rendered'", () => {
    const directive: Directive = { op: "copyIn", copyIn: { from: "assets/logo.svg", to: "dest/logo.svg" } };

    const result = dryRunPlan([directive]);

    expect(result).toEqual([
      { verb: "copyIn", path: "assets/logo.svg", kind: "copied" },
    ] satisfies DryRunEntry[]);
  });

  it("REQ-DRE-05.1 — a mixed batch shows both 'rendered' and 'copied' tags", () => {
    const directives: Directive[] = [
      { op: "create", create: { pathTemplate: "out/text.ts", template: "export const x = 1;", options: {} } },
      { op: "copyIn", copyIn: { from: "files/binary.png", to: "out/binary.png" } },
    ];

    const result = dryRunPlan(directives);

    expect(result).toEqual([
      { verb: "create", path: "out/text.ts", kind: "rendered" },
      { verb: "copyIn", path: "files/binary.png", kind: "copied" },
    ] satisfies DryRunEntry[]);
  });

  it("REQ-04.4 — delete op never emits the wire tag [decoy]", () => {
    const directive: Directive = { op: "delete", delete: { path: "src/gone.ts" } };

    const result = dryRunPlan([directive]);
    const verb: string = result[0]?.verb ?? "";

    expect(verb).toBe("remove");
    expect(verb).not.toBe("delete");
  });
});

describe("dryRunPlan — integration: snapshot from real Session (REQ-04.3)", () => {
  it("REQ-04.3 — plan equals buffered directives for a write-only chain", () => {
    const session = new Session(makeNoopClient());
    const factory = new DirectiveFactory();

    session.buffer(factory.create({ pathTemplate: "src/x.ts", template: "content-x", options: {} }));
    session.buffer(factory.modify({ path: "src/y.ts", content: "content-y" }));

    const snapshot = session.pendingSnapshot();
    const plan = dryRunPlan(snapshot);

    expect(plan).toEqual([
      { verb: "create", path: "src/x.ts", kind: "rendered" },
      { verb: "modify", path: "src/y.ts" },
    ] satisfies DryRunEntry[]);
  });
});
