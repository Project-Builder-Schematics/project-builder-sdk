// [red-proof] RPT-01.1 no-parallel-map scan (S-001 fix pass): a renderer-shaped module
// carrying exactly the hand-rolled op->kind lookup table the scan exists to catch — the
// drift REQ-RPT-01 bans (kind must derive via dryRunPlan's frozen mechanism, never a
// second map that can diverge from it). Never imported/executed — scanned as text only.
// Excluded from tsconfig (test/fixtures/red/**, repo FIT-21 idiom).

const WIRE_TO_KIND = {
  create: "rendered",
  copyIn: "copied",
} as const;

export function decoyRenderEntry(op: keyof typeof WIRE_TO_KIND, path: string): string {
  return `- ${op} ${path} (${WIRE_TO_KIND[op]})`;
}
