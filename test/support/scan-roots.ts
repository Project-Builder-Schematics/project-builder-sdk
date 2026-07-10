// Shared always-on walk allowlist (design §4.6a) — the ONLY roots FIT-12 (parity) and
// FIT-16 (reserved-name structural scan) walk automatically: the reference schematic.
// Deliberately-red fixtures live under `test/fixtures/red/**` and are NEVER walked; their
// red-proofs invoke the relevant check FUNCTION directly against a fixture path instead.

export const ALWAYS_ON_SCAN_ROOTS = ["test/fixtures/typed-factory"] as const;
