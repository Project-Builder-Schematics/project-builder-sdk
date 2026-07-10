/**
 * input-rejection.ts unit coverage — finding -> thrown rejection (design §4.2, constraint 1).
 * INTERIM (S-000..S-005): a plain `Error`, never `AuthoringError` — the origin/reason
 * upgrade is S-006-only (Option A, ADR-0029). Message literal is the REQ-AEC-09 template
 * row, the single source of truth (slices Load-bearing literals).
 */
import { describe, it, expect } from "bun:test";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { rejectionFor } from "../../src/core/schema/input-rejection.ts";
import type { ValidationFinding } from "../../src/core/schema/schema-validate.ts";

describe("rejectionFor", () => {
  it("renders a 'missing' finding as the pinned REQ-AEC-09 input-level template literal", () => {
    const finding: ValidationFinding = { kind: "missing", field: "port", expectedType: "number" };

    const rejection = rejectionFor(finding);

    expect(rejection.message).toEqual("invalid input: port must be number");
  });

  it("throws a plain Error, never an AuthoringError, interim (constraint 1)", () => {
    const finding: ValidationFinding = { kind: "missing", field: "port", expectedType: "number" };

    const rejection = rejectionFor(finding);

    expect(rejection).toBeInstanceOf(Error);
    expect(rejection).not.toBeInstanceOf(AuthoringError);
  });
});
