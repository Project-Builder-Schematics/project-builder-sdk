/**
 * Hand-written golden-IR fixtures (GIR-01) + chained-program batch fixtures (GIR-02).
 * Each fixture is the EXACT ADR-0013 directive shape a DirectiveFactory method must return.
 * Never auto-recorded. Exact keys enforced by toEqual in the test (no extra keys allowed).
 *
 * `create` template contains real DSL syntax: loops + interpolation that MUST survive byte-identical —
 * the factory must NOT render, parse, or transform these strings in any way.
 */
import type { Batch, Directive } from "../../src/core/wire.ts";

export const GOLDEN_CREATE: Extract<Directive, { op: "create" }> = {
  op: "create",
  create: {
    pathTemplate: "src/{= name | dasherize =}/{= name | dasherize =}.component.ts",
    template: "<% for (const m of methods) { %>\nexport function {= m.name =}() {}\n<% } %>",
    // REQ-TOE-01.1: methods (native array) encodes to the compact JSON string at the wire
    // boundary; `name` (a string) passes through verbatim (REQ-TOE-02).
    options: { name: "userProfile", methods: '[{"name":"load"},{"name":"save"}]' },
  },
};

export const GOLDEN_MODIFY: Extract<Directive, { op: "modify" }> = {
  op: "modify",
  modify: {
    path: "src/app/app.module.ts",
    content: "import { NgModule } from '@angular/core';\n@NgModule({})\nexport class AppModule {}",
  },
};

// `remove` author verb lowers to wire op `delete` (ADR-0013 vocabulary — they differ).
export const GOLDEN_DELETE: Extract<Directive, { op: "delete" }> = {
  op: "delete",
  delete: {
    path: "src/app/old-component.ts",
  },
};

export const GOLDEN_RENAME: Extract<Directive, { op: "rename" }> = {
  op: "rename",
  rename: {
    path: "src/app/app.jsx",
    newName: "App.jsx",
  },
};

export const GOLDEN_MOVE: Extract<Directive, { op: "move" }> = {
  op: "move",
  move: {
    path: "src/App.jsx",
    toDir: "src/components",
  },
};

// New for Stage 1 (ADR-0017 closure) — `move` gains the same force-present pin rename/copy
// already had.
export const GOLDEN_MOVE_FORCE: Extract<Directive, { op: "move" }> = {
  op: "move",
  move: {
    path: "src/App.jsx",
    toDir: "src/components",
    force: true,
  },
};

// `copy` is shape-only — no apply logic in the SDK (deferred to vNext per ADR-0013).
export const GOLDEN_COPY: Extract<Directive, { op: "copy" }> = {
  op: "copy",
  copy: {
    from: "assets/favicon.ico",
    to: "src/favicon.ico",
  },
};

/**
 * REQ-GIR-02: chained-handle Batch fixtures. The SUT is the FACTORY-PRODUCED batch captured
 * (via an `emit` spy) from a REAL `defineFactory` run — compared against these hand-written
 * fixtures, never fixture-vs-itself. Envelope `force` is hard-coded `false` by `Session.flush`
 * (the author surface has no run-wide force concept yet — see `session.ts`).
 */
export const RENAME_THEN_MOVE: Batch = {
  protocolVersion: 1,
  force: false,
  instructions: [
    { op: "rename", rename: { path: "src/foo.ts", newName: "bar.ts" } },
    { op: "move", move: { path: "src/bar.ts", toDir: "lib" } },
  ],
};

export const CREATE_THEN_MODIFY: Batch = {
  protocolVersion: 1,
  force: false,
  instructions: [
    { op: "create", create: { pathTemplate: "src/gen.ts", template: "export const x = 1;", options: {} } },
    { op: "modify", modify: { path: "src/gen.ts", content: "export const x = 2;" } },
  ],
};

// REQ-GIR-03: committed golden byte-string — fixes envelope key order (protocolVersion,
// force, instructions) literally. Captured from `test/golden-ir/determinism.test.ts`'s
// rename-then-move two-directive scenario (same shape as RENAME_THEN_MOVE above).
export const GOLDEN_DETERMINISM_STRING =
  '{"protocolVersion":1,"force":false,"instructions":[{"op":"rename","rename":{"path":"src/foo.ts","newName":"bar.ts"}},{"op":"move","move":{"path":"src/bar.ts","toDir":"lib"}}]}';
