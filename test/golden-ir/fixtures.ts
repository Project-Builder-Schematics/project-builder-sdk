/**
 * Hand-written golden-IR fixtures (GIR-01).
 * Each fixture is the EXACT ADR-0028 directive shape a DirectiveFactory method must return.
 * Never auto-recorded. Exact keys enforced by toEqual in the test (no extra keys allowed).
 *
 * `create` template contains real DSL syntax: loops + interpolation that MUST survive byte-identical —
 * the factory must NOT render, parse, or transform these strings in any way.
 */
import type { Directive } from "../../src/core/wire.ts";

export const GOLDEN_CREATE: Extract<Directive, { op: "create" }> = {
  op: "create",
  create: {
    pathTemplate: "src/{= name | dasherize =}/{= name | dasherize =}.component.ts",
    template: "<% for (const m of methods) { %>\nexport function {= m.name =}() {}\n<% } %>",
    options: { name: "userProfile", methods: [{ name: "load" }, { name: "save" }] },
  },
};

export const GOLDEN_MODIFY: Extract<Directive, { op: "modify" }> = {
  op: "modify",
  modify: {
    path: "src/app/app.module.ts",
    content: "import { NgModule } from '@angular/core';\n@NgModule({})\nexport class AppModule {}",
  },
};

// `remove` author verb lowers to wire op `delete` (ADR-0028 vocabulary — they differ).
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

// `copy` is shape-only — no apply logic in the SDK (deferred to vNext per ADR-0028).
export const GOLDEN_COPY: Extract<Directive, { op: "copy" }> = {
  op: "copy",
  copy: {
    from: "assets/favicon.ico",
    to: "src/favicon.ico",
  },
};
