/**
 * S-002.2 — dryRunPlan: all-six-ops mapping, primary-path extraction, write-only-chain equality.
 * Unit: ops → DryRunEntry; Integration: snapshot from real Session equals buffered directives.
 *
 * Primary path per op (from design §4.4 + wire.ts):
 *   create  → create.pathTemplate
 *   modify  → modify.path
 *   delete  → delete.path
 *   rename  → rename.path
 *   move    → move.path
 *   copy    → copy.from
 *
 * verb = wire op tag (create/modify/delete/rename/move/copy); "remove" is the AUTHOR verb,
 * "delete" is the WIRE op tag — dryRunPlan uses the wire tag per design §4.4.
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

    expect(result).toEqual([{ verb: "create", path: "src/foo.ts" }] satisfies DryRunEntry[]);
  });

  it("REQ-04.2 — all six ops map correctly with their primary path", () => {
    const directives: Directive[] = [
      { op: "create", create: { pathTemplate: "src/a.ts", template: "t", options: {} } },
      { op: "modify", modify: { path: "src/b.ts", content: "c" } },
      { op: "delete", delete: { path: "src/c.ts" } },
      { op: "rename", rename: { path: "src/d.ts", newName: "d2.ts" } },
      { op: "move", move: { path: "src/e.ts", toDir: "lib" } },
      { op: "copy", copy: { from: "src/f.ts", to: "src/g.ts" } },
    ];

    const result = dryRunPlan(directives);

    expect(result).toEqual([
      { verb: "create", path: "src/a.ts" },
      { verb: "modify", path: "src/b.ts" },
      { verb: "delete", path: "src/c.ts" },
      { verb: "rename", path: "src/d.ts" },
      { verb: "move",   path: "src/e.ts" },
      { verb: "copy",   path: "src/f.ts" },
    ] satisfies DryRunEntry[]);
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
      { verb: "create", path: "src/x.ts" },
      { verb: "modify", path: "src/y.ts" },
    ] satisfies DryRunEntry[]);
  });
});
