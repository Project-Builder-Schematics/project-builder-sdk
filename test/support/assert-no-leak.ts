// Shared own-property secret-leak sweep (council fix pass, QA F2): proves a caught error
// discarded a native error wholesale (a fresh Error, per the containment doc) rather than
// merely stripping one named field — every own property is swept, not just message/.cause.
import { expect } from "bun:test";

export function assertNoLeak(err: unknown, secret: string): void {
  for (const prop of Object.getOwnPropertyNames(err)) {
    const value = (err as unknown as Record<string, unknown>)[prop];
    expect(String(value)).not.toContain(secret);
  }
}
