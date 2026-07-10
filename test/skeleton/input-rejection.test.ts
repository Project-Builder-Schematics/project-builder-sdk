/**
 * input-rejection.ts unit coverage — finding -> thrown rejection (design §4.2, constraint 1).
 * S-006 (post stage-2-error-attribution archive + coordinated amendment): both functions
 * construct `AuthoringError{origin:"authoring-rejected", reason:"invalid-input"|"reserved-name"}`
 * via authoring-error.ts's public API. Message literal is the REQ-AEC-09 template row,
 * UNCHANGED (the single source of truth, slices Load-bearing literals) — only the thrown
 * value's shape upgrades from plain `Error`.
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

  it("throws an AuthoringError{origin:authoring-rejected, reason:invalid-input} (S-006)", () => {
    const finding: ValidationFinding = { kind: "missing", field: "port", expectedType: "number" };

    const rejection = rejectionFor(finding);

    expect(rejection).toBeInstanceOf(AuthoringError);
    expect(rejection.origin).toEqual("authoring-rejected");
    expect(rejection.reason).toEqual("invalid-input");
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

  it("a 'disallowed-key' rejection is also an AuthoringError{origin:authoring-rejected, reason:invalid-input} (S-006)", () => {
    const finding: ValidationFinding = { kind: "disallowed-key", field: "extra" };

    const rejection = rejectionFor(finding);

    expect(rejection).toBeInstanceOf(AuthoringError);
    expect(rejection.origin).toEqual("authoring-rejected");
    expect(rejection.reason).toEqual("invalid-input");
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

  it("throws an AuthoringError{origin:authoring-rejected, reason:reserved-name} (S-006)", () => {
    const rejection = rejectionForReservedName("pre-execute");

    expect(rejection).toBeInstanceOf(AuthoringError);
    expect(rejection.origin).toEqual("authoring-rejected");
    expect(rejection.reason).toEqual("reserved-name");
  });
});
