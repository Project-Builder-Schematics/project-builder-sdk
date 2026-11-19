// The React dialect's match-count reject tails (REQ-RXD-04), built on the shared echo bound
// (ARCH-2, ADR-0071).

import { elementNameEcho } from "../../../../domain/services/reject-tail.ts";

// ARCH-3 (council; corrected V8 — judgment-day Round 2, Judge B): `setJsxProp`'s match-count
// rejects (REQ-RXD-04) echo a POST-VALIDATION argument value (`elementName`) rather than
// refusing to — deliberate UX (naming which element wasn't found / matched), sanctioned by
// design §4.4. `elementName` is grammar-constrained (no quotes, no newlines — never an
// injection vector), but the grammar has no LENGTH ceiling, so the echo routes through
// `elementNameEcho` (reject-tail.ts's wide, marked 100-char bound) — NOT `boundedFragment`'s 16-char
// hostile-value cap — keeping every react reject message bounded without mangling ordinary
// names.

// Target prop NAMES are grammar-validated like `elementName`; their values are never echoed.
function withProps(propNames: readonly string[]): string {
  return propNames.length === 0 ? "" : ` with props ${propNames.map((name) => `\`${elementNameEcho(name)}\``).join(", ")}`;
}

/** A JSX op's zero-match reject tail (REQ-RXD-04.4) — names the missing element, bounded. */
export function zeroMatchTail(elementName: string, propNames: readonly string[] = []): string {
  return (
    `no element named \`${elementNameEcho(elementName)}\`${withProps(propNames)} was found — use \`.modify()\` to inspect ` +
    "the file and edit it directly."
  );
}

/** A JSX op's multi-match reject tail (REQ-RXD-04.5) — names the element + count, bounded. */
export function multiMatchTail(opName: string, elementName: string, matchCount: number, propNames: readonly string[] = []): string {
  return (
    `\`${elementNameEcho(elementName)}\`${withProps(propNames)} matched ${matchCount} elements — ${opName} requires ` +
    "exactly one match; use `.modify()` to disambiguate."
  );
}
