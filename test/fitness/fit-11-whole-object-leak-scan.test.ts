/**
 * REQ-AEC-05 (file: fit-11-*.test.ts — 11th fitness file; the stable REQ-ID lives in
 * `authoring-error-contract`, NOT `foundations-skeleton`'s `REQ-FIT-*` sequence, which
 * stops at `REQ-FIT-09` — spec cross-cutting note 3).
 *
 * Whole-object, VALUE-CONTENT leak scan: walks the ENTIRE `AuthoringError` object graph —
 * own enumerable AND non-enumerable properties (so `message`/`stack`, which V8 makes
 * non-enumerable own properties on Error instances, are covered), following `.cause` to a
 * bounded depth with a cycle guard — against the fake's own fragment dictionary, imported
 * from `test/support/rejection-messages.ts` (design §4.7: the SAME module the fake's throw
 * sites compose their messages from, so a fake wording change can never silently
 * false-green this scan — both sides read one module).
 *
 * Distinct from FIT-10 (static source-text port guard): this is a RUNTIME scan of actual
 * error VALUES, not source text. REPLACES the old message+stack-only scan (with its dead
 * "OpMove" assertion — that string is never thrown by any rejection path) formerly in
 * `test/skeleton/error-attribution.test.ts`.
 *
 * 3 planted-leak red-proofs [permanent-fixture]: enumerable `.cause` (REQ-AEC-05.2), a
 * non-enumerable own-property plant (REQ-AEC-05.3), and a cyclic `.cause` chain
 * (REQ-AEC-05.4) — each demonstrates the scan is not a no-op / not an `Object.keys`-only
 * traversal / does not infinite-loop on a cycle.
 */
import { describe, it, expect } from "bun:test";
import { toAuthoringError, type AuthoringError } from "../../src/core/authoring-error.ts";
import { EmitRejection } from "../../src/core/emit-rejection.ts";
import { currentContext } from "../../src/core/context.ts";
import { batchOf, createOp } from "../fake/directive-builders.ts";
import * as rejectionMessages from "../support/rejection-messages.ts";
import {
  CONTRACT_FAKE_PREFIX,
  ALREADY_EXISTS,
  USE_FORCE_TO_OVERWRITE,
  NOT_FOUND,
  EXCEEDS_SIZE_CAP,
  ROUND_TRIP_FIDELITY_CHECK,
  JSON_SERIALIZATION,
} from "../support/rejection-messages.ts";

// The dictionary FIT-11 is specified against (REQ-AEC-05): every literal string
// `test/support/contract-fake.ts` actually throws. Derived STRUCTURALLY from the shared
// module (not a hand-maintained list) so a NEW fragment constant added to
// rejection-messages.ts joins the scan automatically — completeness by construction,
// matching the design §4.7 tracked-by-construction intent.
const LEAK_DICTIONARY: readonly string[] = Object.values(rejectionMessages).filter(
  (value) => typeof value === "string"
);

// Bounds a runaway/legitimately-deep `.cause` chain independently of the cycle guard.
const MAX_CAUSE_DEPTH = 20;

/**
 * Recursively scans an error's own properties — enumerable AND non-enumerable, via
 * `Object.getOwnPropertyNames` (an `Object.keys`-only scan would miss non-enumerable
 * properties, including `message`/`stack` on native Error instances) — plus its `.cause`
 * chain (bounded depth + an object-identity cycle guard) for any dictionary fragment
 * appearing inside a string value.
 */
function scanForLeaks(value: unknown, dictionary: readonly string[]): string[] {
  const violations: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = value;
  let depth = 0;

  while (
    current !== null &&
    (typeof current === "object" || typeof current === "function") &&
    !visited.has(current) &&
    depth <= MAX_CAUSE_DEPTH
  ) {
    visited.add(current);

    for (const key of Object.getOwnPropertyNames(current)) {
      if (key === "cause") continue; // walked separately below, with its own depth/cycle guard
      const propValue = (current as Record<string, unknown>)[key];
      if (typeof propValue !== "string") continue;
      for (const fragment of dictionary) {
        if (propValue.includes(fragment)) {
          violations.push(`property "${key}" leaks fragment "${fragment}"`);
        }
      }
    }

    current = (current as { cause?: unknown }).cause;
    depth++;
  }

  return violations;
}

function directiveLevelRejection(code: "collision" | "not-found", message: string): AuthoringError {
  return toAuthoringError(
    new EmitRejection(code, message, { failedIndex: 0, appliedCount: 0 }),
    batchOf(createOp("a.ts", "x"))
  );
}

function batchLevelRejection(code: "unrepresentable" | "cap", message: string): AuthoringError {
  return toAuthoringError(new EmitRejection(code, message), batchOf());
}

function outsideRunRejection(): AuthoringError {
  try {
    currentContext();
  } catch (err) {
    return err as AuthoringError;
  }
  throw new Error("currentContext() did not throw outside a run — fixture assumption broken");
}

describe("REQ-AEC-05 — dictionary derivation sanity", () => {
  it("the structurally-derived dictionary is non-empty and contains the known fragments (an empty dictionary would false-green every scan)", () => {
    expect(LEAK_DICTIONARY.length).toBeGreaterThanOrEqual(7);
    expect(LEAK_DICTIONARY).toContain(CONTRACT_FAKE_PREFIX);
    expect(LEAK_DICTIONARY).toContain(EXCEEDS_SIZE_CAP);
  });
});

describe("REQ-AEC-05.1 — no leak across any rejection family", () => {
  const cases: Array<{ label: string; build: () => AuthoringError }> = [
    {
      label: "path-collision",
      build: () =>
        directiveLevelRejection(
          "collision",
          `${CONTRACT_FAKE_PREFIX} create collision — "a.ts" ${ALREADY_EXISTS} (${USE_FORCE_TO_OVERWRITE})`
        ),
    },
    {
      label: "path-not-found",
      build: () => directiveLevelRejection("not-found", `${CONTRACT_FAKE_PREFIX} modify target ${NOT_FOUND}: "a.ts"`),
    },
    {
      label: "unrepresentable-content (stringify-throw)",
      build: () =>
        batchLevelRejection("unrepresentable", `${CONTRACT_FAKE_PREFIX} batch failed ${JSON_SERIALIZATION}: "boom"`),
    },
    {
      label: "unrepresentable-content (round-trip-drop)",
      build: () =>
        batchLevelRejection(
          "unrepresentable",
          `${CONTRACT_FAKE_PREFIX} batch failed ${ROUND_TRIP_FIDELITY_CHECK}: non-JSON-safe value detected`
        ),
    },
    {
      label: "changes-too-large",
      build: () =>
        batchLevelRejection("cap", `${CONTRACT_FAKE_PREFIX} batch ${EXCEEDS_SIZE_CAP} — 999 bytes serialized, cap is 500 bytes`),
    },
    { label: "outside-run", build: outsideRunRejection },
    { label: "unknown", build: () => toAuthoringError("a bare string rejection", batchOf()) },
  ];

  for (const { label, build } of cases) {
    it(`${label} — zero dictionary strings anywhere in the object graph`, () => {
      const err = build();
      expect(scanForLeaks(err, LEAK_DICTIONARY)).toEqual([]);
    });
  }
});

describe("REQ-AEC-05.2 — planted ENUMERABLE .cause leak fails red [permanent-fixture]", () => {
  it("chaining .cause = <raw value carrying engine text> is caught", () => {
    const err = directiveLevelRejection("collision", "ok") as unknown as { cause?: unknown };
    // A plain assignment creates a fresh, enumerable own property — unlike the native
    // Error constructor's `{ cause }` option, which installs it non-enumerable.
    err.cause = new Error(`${CONTRACT_FAKE_PREFIX} some engine detail ${ALREADY_EXISTS}`);

    const violations = scanForLeaks(err, LEAK_DICTIONARY);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("REQ-AEC-05.3 — planted NON-ENUMERABLE leak fails red [permanent-fixture]", () => {
  it("a dictionary string planted on a non-enumerable own property is caught (an Object.keys-only scan would miss it)", () => {
    const err = batchLevelRejection("cap", "ok");
    Object.defineProperty(err, "diagnosticDetail", {
      value: `${CONTRACT_FAKE_PREFIX} ${EXCEEDS_SIZE_CAP}`,
      enumerable: false,
      configurable: true,
    });

    // Proves WHY Object.getOwnPropertyNames is required: an Object.keys-only traversal
    // (which would still catch REQ-AEC-05.2's plain-assignment `.cause`) sees nothing here.
    expect(Object.keys(err)).not.toContain("diagnosticDetail");

    const violations = scanForLeaks(err, LEAK_DICTIONARY);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("REQ-AEC-05.4 — cyclic .cause chain terminates [permanent-fixture]", () => {
  it("a two-node .cause cycle terminates and still reports the leak on the far node", () => {
    const first = directiveLevelRejection("collision", "ok") as unknown as { cause?: unknown };
    const second = directiveLevelRejection("not-found", "ok") as unknown as { cause?: unknown };
    Object.defineProperty(second, "stack", {
      value: `${CONTRACT_FAKE_PREFIX} ${NOT_FOUND}`,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    first.cause = second;
    second.cause = first; // cycle

    const start = Date.now();
    const violations = scanForLeaks(first, LEAK_DICTIONARY);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("a self-referential .cause terminates without a false leak", () => {
    const err = batchLevelRejection("cap", "ok") as unknown as { cause?: unknown };
    err.cause = err;

    const violations = scanForLeaks(err, LEAK_DICTIONARY);
    expect(violations).toEqual([]);
  });
});
