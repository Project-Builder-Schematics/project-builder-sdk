// The no-echo tail chokepoint (design §4.4, ADR-02), shared by the dialects. Every name or
// targeting reject routes its message through here — default ZERO echo of the rejected VALUE (argument
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

/** The `elementName` echo bound for match-count rejects — see the note above `boundedFragment`. */
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
