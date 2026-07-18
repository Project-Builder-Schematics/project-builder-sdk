/**
 * SEAM-04 + SEAM-03 cross-boundary (REQ-10, REQ-11, REQ-12, REQ-13, REQ-AEC-04.1).
 * Fake unmocked on BOTH sides: a real ContractFake throws a real EmitRejection;
 * Session's attribution wrap translates it to an AuthoringError — imported from
 * `./commons`, proving REQ-AEC-04.1's public `instanceof` — and defineFactory propagates
 * the AuthoringError AND discards (committed tree empty). No mock on emit/attribution/commit.
 *
 * The whole-object no-engine-text guarantee (REQ-11.1, formerly asserted here with a
 * message/stack `.not.toContain` scan incl. a dead `"OpMove"` check that no rejection
 * path ever throws) moves to FIT-11's generalized leak scan (authoring-error-contract
 * REQ-AEC-05, landing alongside S-003) — this file keeps the cross-boundary shape and
 * discard proof. Origin-contrast (REQ-AEC-02.3, S-001) and full every-verb/multi-flush
 * coverage (REQ-14/15, S-002) extend this file in later slices — sequenced here, no
 * logical coupling to this scenario.
 */
import { describe, it, expect } from "bun:test";
import { currentContext } from "../../src/core/context.ts";
import { AuthoringError } from "../../src/commons/index.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, replaceContent, find, rename, move, copy } from "../../src/commons/index.ts";
import type { AuthoringReason, AuthoringVerb } from "../../src/commons/index.ts";
import { rejectedRun } from "../support/rejection-capture.ts";

describe("SEAM-04 — error attribution (forced rejection, cross-boundary)", () => {
  it("REQ-10.1 / REQ-11.2 / REQ-12.1 / REQ-12.2 / REQ-13.1 / REQ-AEC-04.1 — forced collision rejects with a public AuthoringError{verb,path,reason}, discard fires", async () => {
    const fake = new ContractFake({ seed: { "src/existing.ts": "old" } });

    const caught = await rejectedRun(fake, () => {
      // Collides with the seed and no force → ContractFake throws a real EmitRejection.
      create("src/existing.ts", { template: "new", options: {} });
    });

    // REQ-AEC-04.1 — instanceof works across the public ./commons boundary.
    expect(caught).toBeInstanceOf(AuthoringError);
    const authoringError = caught as AuthoringError;
    // REQ-10.1 / REQ-11.1 / REQ-12.1 — author vocabulary verb + path, attributed via
    // the structured rejection's failedIndex (single-directive batch: index 0).
    expect(authoringError.verb).toEqual("create");
    expect(authoringError.path).toEqual("src/existing.ts");
    expect(authoringError.reason).toEqual("path-collision");
    expect(authoringError.appliedCount).toEqual(0);
    // REQ-12.2 / REQ-13.1 — discard fired; committed AND staging trees are empty.
    expect(fake.committedTree().size).toEqual(0);
    expect(fake.stagingTree().size).toEqual(0);
  });

  it("REQ-12.1 — a 3-directive batch failing at index 2 attributes verb+path to the TRUE offender, not instructions[0]", async () => {
    // Mixed verbs by construction: index 0/1 are `create`, the offender at index 2 is a
    // `modify` of a non-existent path — an `instructions[0]` mutant yields wrong verb AND
    // wrong path, not just wrong path. Mutation-guarded: reverting authoring-error.ts to
    // `batch.instructions[0]` makes every attribution toEqual below fail.
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("a.ts", { template: "A", options: {} });
      create("b.ts", { template: "B", options: {} });
      replaceContent("missing.ts", "patched"); // no such target → rejects at index 2
    });

    expect(caught).toBeInstanceOf(AuthoringError);
    const authoringError = caught as AuthoringError;
    // The true offender per the structured rejection's failedIndex — source-side
    // primaryPath (design §4.3): modify.path.
    expect(authoringError.verb).toEqual("modify");
    expect(authoringError.path).toEqual("missing.ts");
    expect(authoringError.reason).toEqual("path-not-found");
    // Non-zero applied boundary: both creates before the offender applied (toEqual, not truthy).
    expect(authoringError.appliedCount).toEqual(2);
  });

  it("REQ-AEC-02.3 — an engine rejection and an outside-run misuse are distinguishable by origin, in one assertion", async () => {
    const fake = new ContractFake({ seed: { "src/existing.ts": "old" } });

    const engineCaught = await rejectedRun(fake, () => {
      create("src/existing.ts", { template: "new", options: {} });
    });

    let misuseCaught: unknown;
    try {
      currentContext();
    } catch (err) {
      misuseCaught = err;
    }

    expect(engineCaught).toBeInstanceOf(AuthoringError);
    expect(misuseCaught).toBeInstanceOf(AuthoringError);
    const engineError = engineCaught as AuthoringError;
    const misuseError = misuseCaught as AuthoringError;

    expect(engineError.origin).toEqual("write-rejected");
    expect(misuseError.origin).toEqual("authoring-rejected");
    expect(engineError.origin).not.toEqual(misuseError.origin);
  });
});

describe("REQ-14.2 — every directive-level verb + failure form attributes correctly, cross-boundary", () => {
  const cases: Array<{
    label: string;
    seed: Record<string, string>;
    run: () => void | Promise<void>;
    expected: { verb: AuthoringVerb; path: string; reason: AuthoringReason; message?: string };
  }> = [
    {
      label: "create-collision: verb create, path is the pathTemplate",
      seed: { "a.ts": "old" },
      run: () => {
        create("a.ts", { template: "new", options: {} });
      },
      expected: { verb: "create", path: "a.ts", reason: "path-collision" },
    },
    {
      label: "modify-not-found: verb modify, path is the missing target",
      seed: {},
      run: () => {
        replaceContent("missing.ts", "patched");
      },
      expected: { verb: "modify", path: "missing.ts", reason: "path-not-found" },
    },
    {
      // rename("a.ts", "b.ts") collides at destination "b.ts"; primaryPath (design §4.3)
      // attributes to the source "a.ts", never the computed dirname(path)/newName target.
      label: "rename-collision: verb rename, path is the SOURCE — not the computed destination",
      seed: { "a.ts": "A", "b.ts": "B" },
      run: () => {
        rename("a.ts", "b.ts");
      },
      expected: { verb: "rename", path: "a.ts", reason: "path-collision" },
    },
    {
      label: "rename-source-not-found: verb rename, path is the missing source",
      seed: {},
      run: () => {
        rename("missing.ts", "renamed.ts");
      },
      expected: { verb: "rename", path: "missing.ts", reason: "path-not-found" },
    },
    {
      // move("src/a.ts", "lib") collides at destination "lib/a.ts"; primaryPath attributes
      // to the source "src/a.ts", never the computed toDir/basename target.
      label: "move-collision: verb move, path is the SOURCE — not the computed destination",
      seed: { "src/a.ts": "A", "lib/a.ts": "B" },
      run: () => {
        move("src/a.ts", "lib");
      },
      expected: { verb: "move", path: "src/a.ts", reason: "path-collision" },
    },
    {
      label: "move-source-not-found: verb move, path is the missing source",
      seed: {},
      run: () => {
        move("missing.ts", "lib");
      },
      expected: { verb: "move", path: "missing.ts", reason: "path-not-found" },
    },
    {
      // The design §4.3 worked example: copy("a.ts","b.ts") collides at "b.ts", attribution
      // names "a.ts" — the exact case the spec calls out.
      label: "copy-collision: verb copy, path is the SOURCE (from) — not the destination (to)",
      seed: { "a.ts": "A", "b.ts": "B" },
      run: () => {
        copy("a.ts", "b.ts");
      },
      expected: {
        verb: "copy",
        path: "a.ts",
        reason: "path-collision",
        message: "copy failed at a.ts: path-collision",
      },
    },
    {
      label: "copy-source-not-found: verb copy, path is the missing source (from)",
      seed: {},
      run: () => {
        copy("missing.ts", "dest.ts");
      },
      expected: { verb: "copy", path: "missing.ts", reason: "path-not-found" },
    },
  ];

  for (const c of cases) {
    it(c.label, async () => {
      const fake = new ContractFake({ seed: c.seed });
      const caught = await rejectedRun(fake, c.run);
      expect(caught).toBeInstanceOf(AuthoringError);
      const err = caught as AuthoringError;
      expect(err.verb).toEqual(c.expected.verb);
      expect(err.path).toEqual(c.expected.path);
      expect(err.reason).toEqual(c.expected.reason);
      if (c.expected.message !== undefined) {
        expect(err.message).toEqual(c.expected.message);
      }
    });
  }
});

describe("REQ-14.3 — batch-level rejections never fabricate a verb or path", () => {
  it("unrepresentable-content (round-trip-drop): reason set, verb/path undefined, appliedCount 0", async () => {
    const fake = new ContractFake({ seed: {} });
    const caught = await rejectedRun(fake, () => {
      // typed-options-feeder §4.2d reconcile: a function value now rejects EARLIER, at
      // scheduling time inside encodeOptions (a plain Error naming the key, REQ-TOE-04) —
      // it never reaches this flush-time guard anymore. NaN is typeof "number", so it PASSES
      // encodeOptions unencoded (REQ-TOE-03 passthrough) and still round-trips to `null`
      // through JSON — the round-trip-drop family (contract-fake.ts's deepEqual guard) this
      // scenario pins, distinct from the BigInt stringify-throw family already covered in
      // batch-cap.test.ts. All four assertion values below are unchanged; only the trigger
      // input moved to one the new SDK-side encode does not shadow.
      create("a.ts", { template: "A", options: { ratio: 0 / 0 } });
    });
    expect(caught).toBeInstanceOf(AuthoringError);
    const err = caught as AuthoringError;
    expect(err.reason).toEqual("unrepresentable-content");
    expect(err.verb).toBeUndefined();
    expect(err.path).toBeUndefined();
    expect(err.appliedCount).toEqual(0);
  });
});

describe("REQ-15.1 / REQ-15.2 — appliedCount is per-flush, and a later-flush failure discards the whole run", () => {
  it("a later flush's failure reports only its OWN flush's applied directives and wipes the earlier flush's staged writes", async () => {
    // Precondition (REQ-15.1): B must be seeded so `replaceContent B` APPLIES in the
    // failing flush — without it, `replaceContent B` itself would reject at index 0 and
    // appliedCount:1 would be unreachable.
    const fake = new ContractFake({ seed: { "B.ts": "seed-B" } });

    const caught = await rejectedRun(fake, async () => {
      create("A.ts", { template: "A", options: {} });
      await find("A.ts").read(); // flush #1 — A applies and succeeds, already staged
      replaceContent("B.ts", "patched-B");
      replaceContent("C.ts", "patched-C"); // C has no target → flush #2 rejects at index 1
    });

    expect(caught).toBeInstanceOf(AuthoringError);
    const err = caught as AuthoringError;
    // REQ-15.1 — only B (index 0 of the FAILING batch) counts, not A from the earlier,
    // already-succeeded flush.
    expect(err.verb).toEqual("modify");
    expect(err.path).toEqual("C.ts");
    expect(err.reason).toEqual("path-not-found");
    expect(err.appliedCount).toEqual(1);
    // REQ-15.2 — run-level discard (ADR-01) wiped A's earlier successful flush too; the
    // committed tree is empty on any failed run regardless, so staging is the proof.
    expect(fake.stagingTree().size).toEqual(0);
  });
});
