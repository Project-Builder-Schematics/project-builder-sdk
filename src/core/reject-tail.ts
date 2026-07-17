// S-001: the no-echo tail chokepoint (design §4.4, ADR-02). Every react validator/targeting
// reject routes its message through here — default ZERO echo of the rejected VALUE (argument
// NAMES may appear freely; the hostile value itself never does). `boundedFragment` exists for
// the rare diagnostic that MUST echo a fixed, non-hostile literal (e.g. a denylist entry) —
// its 16-char cap is a ceiling, not a norm; most tails never call it.

/** Hard 16-char ceiling for the rare diagnostic fragment — never a norm, always a last resort. */
export function boundedFragment(s: string, cap: number = 16): string {
  return s.length > cap ? s.slice(0, cap) : s;
}

// `boundedFragment`'s 16-char cap is sized for REQ-RXD-13's hostile-VALUE diagnostics — never
// widen it, that's a different reject class with a signed cap. `setJsxProp`'s match-count
// rejects (REQ-RXD-04) echo `elementName` instead: a POST-VALIDATION, grammar-constrained
// argument (no quotes, no newlines — never an injection vector), not a hostile value, so
// reusing the 16-char cap here bought nothing but silently mangled ordinary component names
// (`NotificationPreferencesPanel` -> `NotificationPref`) into ones matching nothing in the
// author's source, with no signal anything was cut. This wider cap comfortably covers
// realistic component names; on the rare name that still exceeds it, an explicit `…` marker is
// appended so a cut name is never mistaken for the element's real one.
const ELEMENT_NAME_ECHO_CAP = 100;

/** `zeroMatchTail`/`multiMatchTail`'s `elementName` echo bound — see the note above `boundedFragment`. */
export function elementNameEcho(s: string): string {
  return s.length > ELEMENT_NAME_ECHO_CAP ? `${s.slice(0, ELEMENT_NAME_ECHO_CAP)}…` : s;
}

/**
 * Builds a reject tail naming `argName` + `ruleLabel` plus the standard two-remedy pair (fix
 * the name / use `.modify()`) — never the rejected VALUE (REQ-RXD-13.3's zero-echo contract).
 */
export function nameRuleTail(argName: string, ruleLabel: string): string {
  return `\`${argName}\` must ${ruleLabel} — fix the name, or use \`.modify()\` to make this edit directly.`;
}

// ARCH-3 (council): `setJsxProp`'s match-count rejects (REQ-RXD-04) are the one react reject
// class that echoes a POST-VALIDATION argument value (`elementName`) rather than refusing to —
// deliberate UX (naming which element wasn't found / matched), sanctioned by design §4.4.
// `elementName` is grammar-constrained (no quotes, no newlines — never an injection vector),
// but the grammar has no LENGTH ceiling, so the echo routes through `boundedFragment` the same
// way a hostile-value diagnostic fragment would, keeping every react reject message bounded.

/** `setJsxProp`'s zero-match reject tail (REQ-RXD-04.4) — names the missing element, bounded. */
export function zeroMatchTail(elementName: string): string {
  return (
    `no element named \`${elementNameEcho(elementName)}\` was found — use \`.modify()\` to inspect ` +
    "the file and edit it directly."
  );
}

/** `setJsxProp`'s multi-match reject tail (REQ-RXD-04.5) — names the element + count, bounded. */
export function multiMatchTail(elementName: string, matchCount: number): string {
  return (
    `\`${elementNameEcho(elementName)}\` matched ${matchCount} elements — setJsxProp requires ` +
    "exactly one match; use `.modify()` to disambiguate."
  );
}

/** `addImport`'s file-wide collision reject tail (REQ-RXD-05, V7 Step 2) — names `name` and the rule. */
export function claimedNameTail(name: string): string {
  return (
    `\`name\` "${boundedFragment(name)}" is already bound elsewhere in the file — addImport ` +
    "cannot create a second local binding under an already-claimed name; rename the existing " +
    "binding or choose a different `name`, or use `.modify()` to make this edit directly."
  );
}
