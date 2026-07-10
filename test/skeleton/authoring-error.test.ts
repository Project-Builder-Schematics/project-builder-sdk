/**
 * SEAM-04 translation unit (authoring-error-contract REQ-AEC-01/-02.2/-03.1/-06,
 * emit-rejection-metadata REQ-ERM-03, error-attribution-skeleton REQ-10). Exercises
 * `toAuthoringError` directly against constructed `EmitRejection`s and batches — no
 * `ContractFake`/`Session` involved; the cross-boundary proof lives in
 * `error-attribution.test.ts` (REQ-AEC-04.1, REQ-12).
 */
import { describe, it, expect } from "bun:test";
import { toAuthoringError, AuthoringError, type AuthoringReason, type AuthoringVerb } from "../../src/core/authoring-error.ts";
import { EmitRejection, type EmitRejectionCode } from "../../src/core/emit-rejection.ts";
import type { Batch } from "../../src/core/wire.ts";
import { batchOf, createOp, modifyOp, deleteOp, renameOp, copyOp, moveOp } from "../fake/directive-builders.ts";

function rejectAt(batch: Batch, code: EmitRejectionCode, failedIndex: number): AuthoringError {
  const rejection = new EmitRejection(code, "decoy message text — irrelevant to classification", {
    failedIndex,
    appliedCount: failedIndex,
  });
  return toAuthoringError(rejection, batch);
}

describe("REQ-AEC-01.1 — every directive-level family classifies to its exact reason value", () => {
  const cases: Array<{
    label: string;
    batch: Batch;
    code: EmitRejectionCode;
    verb: AuthoringVerb;
    path: string;
    reason: AuthoringReason;
  }> = [
    { label: "create-collision", batch: batchOf(createOp("a.ts", "x")), code: "collision", verb: "create", path: "a.ts", reason: "path-collision" },
    { label: "modify-not-found", batch: batchOf(modifyOp("a.ts", "x")), code: "not-found", verb: "modify", path: "a.ts", reason: "path-not-found" },
    { label: "rename-collision", batch: batchOf(renameOp("a.ts", "b.ts")), code: "collision", verb: "rename", path: "a.ts", reason: "path-collision" },
    { label: "rename-source-not-found", batch: batchOf(renameOp("a.ts", "b.ts")), code: "not-found", verb: "rename", path: "a.ts", reason: "path-not-found" },
    { label: "copy-collision", batch: batchOf(copyOp("a.ts", "b.ts")), code: "collision", verb: "copy", path: "a.ts", reason: "path-collision" },
    { label: "copy-source-not-found", batch: batchOf(copyOp("a.ts", "b.ts")), code: "not-found", verb: "copy", path: "a.ts", reason: "path-not-found" },
    { label: "move-collision", batch: batchOf(moveOp("a.ts", "dir")), code: "collision", verb: "move", path: "a.ts", reason: "path-collision" },
    { label: "move-source-not-found", batch: batchOf(moveOp("a.ts", "dir")), code: "not-found", verb: "move", path: "a.ts", reason: "path-not-found" },
  ];

  for (const { label, batch, code, verb, path, reason } of cases) {
    it(`${label} → reason:"${reason}", verb:"${verb}", path:"${path}"`, () => {
      const err = rejectAt(batch, code, 0);
      expect(err.reason).toEqual(reason);
      expect(err.verb).toEqual(verb);
      expect(err.path).toEqual(path);
    });
  }
});

describe("REQ-AEC-01.2 — no engine string ever appears as a reason value", () => {
  const codes: EmitRejectionCode[] = ["collision", "not-found", "unrepresentable", "cap"];
  const closedReasons = [
    "path-collision",
    "path-not-found",
    "unrepresentable-content",
    "changes-too-large",
    "outside-run",
    "unknown",
    "invalid-input",
    "reserved-name",
  ];

  for (const code of codes) {
    it(`code:"${code}" → reason is one of the eight closed values, never the raw message text`, () => {
      const rejection = new EmitRejection(code, "ContractFake: some engine-internal text");
      const err = toAuthoringError(rejection, batchOf());
      expect(closedReasons).toContain(err.reason);
      expect(err.reason).not.toEqual("ContractFake: some engine-internal text");
    });
  }
});

describe("REQ-AEC-01.3 / REQ-AEC-01.4 — unrepresentable-content covers both fake sites independently", () => {
  it("REQ-AEC-01.3 — stringify-throw site (code:unrepresentable) → reason:unrepresentable-content", () => {
    const err = toAuthoringError(new EmitRejection("unrepresentable", "stringify failed"), batchOf());
    expect(err.reason).toEqual("unrepresentable-content");
  });

  it("REQ-AEC-01.4 — round-trip-drop site (code:unrepresentable) → reason:unrepresentable-content", () => {
    const err = toAuthoringError(new EmitRejection("unrepresentable", "round-trip dropped a value"), batchOf());
    expect(err.reason).toEqual("unrepresentable-content");
  });
});

describe("REQ-AEC-01.5 — cap-exceeded classifies as changes-too-large", () => {
  it("code:cap → reason:changes-too-large", () => {
    const err = toAuthoringError(new EmitRejection("cap", "batch too big"), batchOf());
    expect(err.reason).toEqual("changes-too-large");
  });
});

describe("REQ-AEC-02.2 — an engine rejection is always write-rejected", () => {
  const codes: EmitRejectionCode[] = ["collision", "not-found", "unrepresentable", "cap"];
  for (const code of codes) {
    it(`code:"${code}" → origin:write-rejected`, () => {
      const err = toAuthoringError(new EmitRejection(code, "x"), batchOf());
      expect(err.origin).toEqual("write-rejected");
    });
  }
});

describe("REQ-AEC-03.1 — appliedCount is present and numeric", () => {
  it("a directive-level rejection at index 2 carries appliedCount:2 (typeof number)", () => {
    const err = rejectAt(batchOf(createOp("a.ts", "x"), createOp("b.ts", "y"), createOp("c.ts", "z")), "collision", 2);
    expect(typeof err.appliedCount).toEqual("number");
    expect(err.appliedCount).toEqual(2);
  });
});

describe('REQ-AEC-06.1 — directive-level message names verb, path, and reason', () => {
  it('create-collision on "src/existing.ts" → "create failed at src/existing.ts: path-collision"', () => {
    const err = rejectAt(batchOf(createOp("src/existing.ts", "x")), "collision", 0);
    expect(err.message).toEqual("create failed at src/existing.ts: path-collision");
  });
});

describe('REQ-AEC-06.2 — batch-level message never prints "undefined"', () => {
  it('cap-exceeded → "changes could not be applied: changes-too-large"', () => {
    const err = toAuthoringError(new EmitRejection("cap", "x"), batchOf());
    expect(err.message).toEqual("changes could not be applied: changes-too-large");
    expect(err.message).not.toContain("undefined");
  });
});

describe("REQ-AEC-06.3 — unknown message states the SDK could not classify", () => {
  it("a degraded (reason:unknown) rejection's message follows the batch template and states could-not-classify", () => {
    const err = toAuthoringError("a bare string rejection", batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.message).toEqual("changes could not be applied: unknown — the SDK could not classify this failure");
  });
});

describe("REQ-AEC-07.1 / REQ-AEC-08.1 — the two V2 → V3 amendment reasons classify to origin:authoring-rejected", () => {
  // invalid-input/reserved-name are never produced via toAuthoringError(EmitRejection) —
  // they are SDK-side (schema-validation / reserved-lifecycle-name), constructed directly
  // by input-rejection.ts (S-006). Constructed here directly against the public API.
  it('reason:"invalid-input" → origin:"authoring-rejected"', () => {
    const err = new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: "invalid input: port must be number",
    });
    expect(err.reason).toEqual("invalid-input");
    expect(err.origin).toEqual("authoring-rejected");
  });

  it('reason:"reserved-name" → origin:"authoring-rejected"', () => {
    const err = new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "reserved-name",
      appliedCount: 0,
      message: "reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module",
    });
    expect(err.reason).toEqual("reserved-name");
    expect(err.origin).toEqual("authoring-rejected");
  });
});

describe("REQ-AEC-09 — invalid-input/reserved-name have no default message template; an explicit message is required", () => {
  it('an explicit message for reason:"invalid-input" is used verbatim (byte-unchanged from the caller)', () => {
    const err = new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: "invalid input: mode must be one of: dev, prod",
    });
    expect(err.message).toEqual("invalid input: mode must be one of: dev, prod");
  });

  it('constructing reason:"invalid-input" with no message throws — no default template exists for this reason', () => {
    expect(
      () =>
        new AuthoringError({
          verb: undefined,
          path: undefined,
          reason: "invalid-input",
          appliedCount: 0,
        })
    ).toThrow();
  });

  it('constructing reason:"reserved-name" with no message throws — no default template exists for this reason', () => {
    expect(
      () =>
        new AuthoringError({
          verb: undefined,
          path: undefined,
          reason: "reserved-name",
          appliedCount: 0,
        })
    ).toThrow();
  });
});

describe("REQ-ERM-03 — non-Error / malformed rejection degrades to reason:unknown without crashing", () => {
  it("REQ-ERM-03.1 — a bare string rejection degrades gracefully", () => {
    const err = toAuthoringError("boom", batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.origin).toEqual("write-rejected");
    expect(err.verb).toBeUndefined();
    expect(err.path).toBeUndefined();
    expect(err.appliedCount).toEqual(0);
  });

  it("REQ-ERM-03.2 — a metadata-less Error degrades and leaks none of its own message text", () => {
    const err = toAuthoringError(new Error("boom"), batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.appliedCount).toEqual(0);
    expect(err.message).not.toContain("boom");
  });

  it("REQ-ERM-03.3 — throw undefined degrades gracefully (no TypeError reading code off undefined)", () => {
    const err = toAuthoringError(undefined, batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.appliedCount).toEqual(0);
  });

  it("REQ-ERM-03.4 — throw 42 degrades gracefully", () => {
    const err = toAuthoringError(42, batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.appliedCount).toEqual(0);
  });

  // REQ-ERM-01 code→reason map totality: "absent/unrecognized code → unknown". An
  // EmitRejection whose `code` is off the closed union (a buggy/future engine client is
  // not compile-checked at the throw site) must degrade like any malformed rejection —
  // never crash inside the translation.
  it("REQ-ERM-01 — an EmitRejection with an unrecognized (off-union) code degrades to unknown, not a crash", () => {
    const rogue = new EmitRejection("quota-exceeded" as EmitRejectionCode, "engine grew a new code");
    const err = toAuthoringError(rogue, batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.origin).toEqual("write-rejected");
    expect(err.message).toEqual("changes could not be applied: unknown — the SDK could not classify this failure");
  });

  it("REQ-ERM-01 — an EmitRejection with an ABSENT code degrades to unknown, not a crash", () => {
    const codeless = new EmitRejection(undefined as unknown as EmitRejectionCode, "no code at all");
    const err = toAuthoringError(codeless, batchOf());
    expect(err.reason).toEqual("unknown");
    expect(err.origin).toEqual("write-rejected");
    expect(err.message).toEqual("changes could not be applied: unknown — the SDK could not classify this failure");
  });
});

describe("REQ-10.1 — AuthoringError carries verb and path", () => {
  it('a failed create on "src/foo.ts" → verb:"create", path:"src/foo.ts"', () => {
    const err = rejectAt(batchOf(createOp("src/foo.ts", "x")), "collision", 0);
    expect(err.verb).toEqual("create");
    expect(err.path).toEqual("src/foo.ts");
  });
});

describe('REQ-10.2 — the wire op "delete" translates to author verb "remove"', () => {
  it("a directive with wire op delete derives author verb remove, never delete — translation-layer verb-map proof (remove never rejects live, REQ-16 non-site)", () => {
    const err = rejectAt(batchOf(deleteOp("a.ts")), "collision", 0);
    expect(err.verb).toEqual("remove");
  });
});
