// S-000: kit-internal shared structural-equality helper (row-146, ADR-0012 amendment clause
// 4). Sibling of ./dialect-error.ts — same kit-internal-shared-in-core pattern, one decision
// covers both, no separate ADR. Not re-exported from src/core/index.ts, no barrel/subpath:
// no public symbol. src/conformance/index.ts and src/testing/contract-fake.ts each carry
// their OWN duplicated copy today (FIT-17 forbids ./conformance -> ./testing); extracting
// both onto this shared module is S-005's task, not this one's.

// Index-signature object type, deliberately not spelled as the generic-utility alias FIT-07
// (ADR-0008) textually scans src/core/** for (a stored-collection-shaped type applied to a
// string key) — this is generic recursive KEY comparison, never a path-keyed content store,
// but avoiding that exact spelling sidesteps the false positive without changing runtime
// behavior at all.
type KeyedObject = { [key: string]: unknown };

function isKeyedObject(value: unknown): value is KeyedObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Object.is-based structural equality (not `===`): callers that round-trip a value through
// JSON.stringify/JSON.parse need to detect the cases `===` gets wrong (NaN, -0 vs 0) and the
// cases JSON silently drops (a key holding undefined) rather than tolerates.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (isKeyedObject(a) && isKeyedObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in b && deepEqual(a[key], b[key]));
  }
  return false;
}
