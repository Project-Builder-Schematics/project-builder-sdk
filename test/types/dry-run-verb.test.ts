// Type-level tests for REQ-DRE-02 (narrowing) — DryRunEntry.verb is DryRunVerb (not
// string), and an exhaustive switch over its six members compiles with a `never`
// default arm. Strategy mirrors typed-create.test.ts: a never-invoked arrow whose body
// exercises the typed narrowing; tsc evaluates it under `bun run typecheck`, runtime
// never runs it. Imports from src/commons/index.ts (the PUBLIC re-export surface, not
// plan.ts's defining site) — the pin is that the types survive re-export (§4.6b(3)).
// Suite demands: this file runs GREEN under `bun test` (runtime no-ops); its RED
// manifests at `bun run typecheck` and can only be authored once DryRunVerb exists.

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { DryRunEntry, DryRunVerb } from "../../src/commons/index.ts";

describe("DryRunEntry.verb narrowing — type surface (REQ-DRE-02)", () => {
  test("REQ-DRE-02 — DryRunEntry.verb is exactly DryRunVerb, not string", () => {
    const _narrowingProof = () => {
      expectTypeOf<DryRunEntry["verb"]>().toEqualTypeOf<DryRunVerb>();
    };
    void _narrowingProof;
  });

  test("REQ-DRE-02 — exhaustive switch over all six DryRunVerb members compiles", () => {
    const _exhaustiveProof = (entry: DryRunEntry): string => {
      switch (entry.verb) {
        case "create": return "create";
        case "modify": return "modify";
        case "remove": return "remove";
        case "rename": return "rename";
        case "move": return "move";
        case "copy": return "copy";
        default: {
          const exhaustive: never = entry.verb;
          return exhaustive;
        }
      }
    };
    void _exhaustiveProof;
  });
});
