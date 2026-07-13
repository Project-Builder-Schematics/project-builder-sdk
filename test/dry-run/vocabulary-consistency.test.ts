/**
 * D3 consistency test (design §4.6b): the frozen `WIRE_TO_AUTHOR_VERB` map is exactly
 * the seven ratified rows, and `DryRunVerb` is exactly the ratified seven-member set —
 * both anchored to ONE shared literal declared here, so a future drift in either half is
 * caught. Hybrid: runtime half on the exported map, compile-time half on the type.
 *
 * `schematic-local-files` S-003 (ADR-0025 amendment, REQ-DRE-06.1): grew from six to
 * seven rows — `copyIn: "copyIn"` added, 1:1 with the new `copyIn` wire op (ADR-0043).
 */
import { describe, it, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import { WIRE_TO_AUTHOR_VERB } from "../../src/dry-run/plan.ts";
import type { DryRunVerb } from "../../src/dry-run/plan.ts";

const RATIFIED_AUTHOR_VERBS = ["create", "modify", "remove", "rename", "move", "copy", "copyIn"] as const;

describe("dry-run vocabulary — D3 map/type consistency", () => {
  it("WIRE_TO_AUTHOR_VERB is exactly the seven frozen rows (delete→remove, identity elsewhere)", () => {
    expect(WIRE_TO_AUTHOR_VERB).toEqual({
      create: "create",
      modify: "modify",
      delete: "remove",
      rename: "rename",
      move: "move",
      copy: "copy",
      copyIn: "copyIn",
    });
  });

  it("DryRunVerb equals the ratified author-verb set (compile-time)", () => {
    const _verbSetProof = () => {
      expectTypeOf<DryRunVerb>().toEqualTypeOf<(typeof RATIFIED_AUTHOR_VERBS)[number]>();
    };
    void _verbSetProof;
  });

  it("WIRE_TO_AUTHOR_VERB's values equal the ratified literal (set equality bridge)", () => {
    expect([...Object.values(WIRE_TO_AUTHOR_VERB)].sort()).toEqual([...RATIFIED_AUTHOR_VERBS].sort());
  });

  it("REQ-DRE-06.1: a by-reference directive present in the snapshot renders under author verb 'copyIn'", () => {
    expect(WIRE_TO_AUTHOR_VERB.copyIn).toEqual("copyIn");
  });
});
