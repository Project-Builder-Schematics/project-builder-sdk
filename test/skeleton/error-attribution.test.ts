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
import { defineFactory, currentContext } from "../../src/core/context.ts";
import { AuthoringError } from "../../src/commons/index.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, modify } from "../../src/commons/index.ts";

describe("SEAM-04 — error attribution (forced rejection, cross-boundary)", () => {
  it("REQ-10.1 / REQ-11.2 / REQ-12.1 / REQ-12.2 / REQ-13.1 / REQ-AEC-04.1 — forced collision rejects with a public AuthoringError{verb,path,reason}, discard fires", async () => {
    const fake = new ContractFake({ seed: { "src/existing.ts": "old" } });

    const run = defineFactory<void>(() => {
      // Collides with the seed and no force → ContractFake throws a real EmitRejection.
      create("src/existing.ts", { template: "new", options: {} });
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

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

    const run = defineFactory<void>(() => {
      create("a.ts", { template: "A", options: {} });
      create("b.ts", { template: "B", options: {} });
      modify("missing.ts", "patched"); // no such target → rejects at index 2
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

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

    const run = defineFactory<void>(() => {
      create("src/existing.ts", { template: "new", options: {} });
    });

    let engineCaught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      engineCaught = err;
    }

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
