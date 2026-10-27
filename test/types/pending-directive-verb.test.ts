// Type-level tests for REQ-DRE-02 (narrowing) — PendingDirective.verb is AuthoringVerb (not
// string), and an exhaustive switch over its members compiles with a `never`
// default arm. Strategy mirrors typed-create.test.ts: a never-invoked arrow whose body
// exercises the typed narrowing; tsc evaluates it under `bun run typecheck`, runtime
// never runs it. Imports from src/commons/index.ts (the PUBLIC re-export surface, not
// render.ts's defining site) — the pin is that the types survive re-export (§4.6b(3)).
// Suite demands: this file runs GREEN under `bun test` (runtime no-ops); its RED
// manifests at `bun run typecheck` and can only be authored once AuthoringVerb exists.
//
// `schematic-local-files` S-003 (ADR-0025 amendment): AuthoringVerb grew from six to seven
// members — `copyIn` added; the exhaustive switch below extended to match (a real
// compile break if a member were ever missed, mirroring authoring-reason.test.ts's
// never-arm pin for AuthoringReason).

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { PendingDirective, AuthoringVerb } from "../../src/commons/index.ts";

describe("PendingDirective.verb narrowing — type surface (REQ-DRE-02)", () => {
  test("REQ-DRE-02 — PendingDirective.verb is exactly AuthoringVerb, not string", () => {
    const _narrowingProof = () => {
      expectTypeOf<PendingDirective["verb"]>().toEqualTypeOf<AuthoringVerb>();
    };
    void _narrowingProof;
  });

  test("REQ-DRE-02 — exhaustive switch over all seven AuthoringVerb members compiles", () => {
    const _exhaustiveProof = (entry: PendingDirective): string => {
      switch (entry.verb) {
        case "create": return "create";
        case "modify": return "modify";
        case "remove": return "remove";
        case "rename": return "rename";
        case "move": return "move";
        case "copy": return "copy";
        case "copyIn": return "copyIn";
        default: {
          const exhaustive: never = entry.verb;
          return exhaustive;
        }
      }
    };
    void _exhaustiveProof;
  });
});
