/**
 * input-rejection.ts unit coverage — finding -> thrown rejection (design §4.2, constraint 1).
 * INTERIM (S-000..S-005): a plain `Error`, never `AuthoringError` — the origin/reason
 * upgrade is S-006-only (Option A, ADR-0029). Message literal is the REQ-AEC-09 template
 * row, the single source of truth (slices Load-bearing literals).
 */
import { describe, it, expect } from "bun:test";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { rejectionFor, rejectionForReservedName } from "../../src/core/schema/input-rejection.ts";
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

  it("renders a 'wrong-type' finding with the SAME template as 'missing' (S-003)", () => {
    const finding: ValidationFinding = { kind: "wrong-type", field: "port", expectedType: "number" };

    expect(rejectionFor(finding).message).toEqual("invalid input: port must be number");
  });

  it("renders a 'wrong-type' enum finding with the 'one of: ...' expectedType rendering", () => {
    const finding: ValidationFinding = { kind: "wrong-type", field: "mode", expectedType: "one of: dev, prod" };

    expect(rejectionFor(finding).message).toEqual("invalid input: mode must be one of: dev, prod");
  });

  it("renders a 'disallowed-key' finding as the pinned reserved-or-disallowed-key template, naming the key never a type", () => {
    const finding: ValidationFinding = { kind: "disallowed-key", field: "extra" };

    expect(rejectionFor(finding).message).toEqual("invalid input: extra is a reserved or disallowed key");
  });

  it("a 'disallowed-key' rejection is a plain Error, never an AuthoringError, interim (constraint 1)", () => {
    const finding: ValidationFinding = { kind: "disallowed-key", field: "extra" };

    const rejection = rejectionFor(finding);

    expect(rejection).toBeInstanceOf(Error);
    expect(rejection).not.toBeInstanceOf(AuthoringError);
  });
});

describe("rejectionForReservedName (S-004, REQ-RLN-02.1)", () => {
  it("renders the pinned reserved-lifecycle-name template literal, naming the reserved token", () => {
    expect(rejectionForReservedName("pre-execute").message).toEqual(
      "reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module"
    );
  });

  it("is distinguishable in kind from an RBV-01 rejection by message literal alone (constraint 1/RLN-02.1)", () => {
    const rlnMessage = rejectionForReservedName("post-execute").message;

    expect(rlnMessage.startsWith("reserved lifecycle name:")).toBe(true);
    expect(rlnMessage.startsWith("invalid input:")).toBe(false);
  });

  it("throws a plain Error, never an AuthoringError, interim (constraint 1)", () => {
    const rejection = rejectionForReservedName("pre-execute");

    expect(rejection).toBeInstanceOf(Error);
    expect(rejection).not.toBeInstanceOf(AuthoringError);
  });
});
