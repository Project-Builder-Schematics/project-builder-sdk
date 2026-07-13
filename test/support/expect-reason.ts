// Shared AuthoringError rejection assertions (hoisted from the per-file copies the
// scaffold-family test files each hand-rolled): assert something threw an AuthoringError
// with the given closed `reason` and origin "authoring-rejected" (every reason these
// helpers are used with is an SDK-side misuse detection — origin is DERIVED from reason,
// so the origin assert can never flip independently). Returns the error so call sites can
// layer extra asserts (message text, etc.) on top.

import { expect } from "bun:test";
import { AuthoringError } from "../../src/core/authoring-error.ts";

/** Asserts an ALREADY-CAUGHT value is the expected authoring rejection. */
export function expectAuthoringReason(caught: unknown, reason: AuthoringError["reason"]): AuthoringError {
  expect(caught).toBeInstanceOf(AuthoringError);
  expect((caught as AuthoringError).reason).toEqual(reason);
  expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
  return caught as AuthoringError;
}

/** Runs `fn`, expecting it to throw the given authoring rejection synchronously. */
export function expectReason(fn: () => unknown, reason: AuthoringError["reason"]): AuthoringError {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  return expectAuthoringReason(caught, reason);
}

/** Async variant of `expectReason` for rejection-producing promises. */
export async function expectReasonAsync(
  fn: () => Promise<unknown>,
  reason: AuthoringError["reason"]
): Promise<AuthoringError> {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  return expectAuthoringReason(caught, reason);
}
