// Type-level test for batch-cap-contract REQ-02.1: `modify.content` / `create.template`
// are pinned as exactly `string` — no binary/base64 union exists in the v1 wire contract
// (ADR-0019 carries the text-only rationale). Strategy mirrors typed-create.test.ts (#2
// prove+freeze precedent): a never-invoked arrow whose body exercises the typed field;
// tsc evaluates it under `bun run typecheck`/`bunx tsc --noEmit`, runtime never runs it.
// This is a characterization pin, not new behavior — `wire.ts` already declares `string`
// for both fields today.

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { Directive } from "../../src/core/wire.ts";

describe("wire content fields — string pin (batch-cap-contract REQ-02.1)", () => {
  test("REQ-02.1 — modify.content is exactly string", () => {
    const _proof = (d: Extract<Directive, { op: "modify" }>) => {
      expectTypeOf(d.modify.content).toEqualTypeOf<string>();
    };
    void _proof;
  });

  test("REQ-02.1 — create.template is exactly string", () => {
    const _proof = (d: Extract<Directive, { op: "create" }>) => {
      expectTypeOf(d.create.template).toEqualTypeOf<string>();
    };
    void _proof;
  });
});
