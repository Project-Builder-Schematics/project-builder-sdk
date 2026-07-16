// S-001: the no-echo tail chokepoint (design §4.4, ADR-02). Every react validator/targeting
// reject routes its message through here — default ZERO echo of the rejected VALUE (argument
// NAMES may appear freely; the hostile value itself never does). `boundedFragment` exists for
// the rare diagnostic that MUST echo a fixed, non-hostile literal (e.g. a denylist entry) —
// its 16-char cap is a ceiling, not a norm; most tails never call it.

/** Hard 16-char ceiling for the rare diagnostic fragment — never a norm, always a last resort. */
export function boundedFragment(s: string, cap: number = 16): string {
  return s.length > cap ? s.slice(0, cap) : s;
}

/**
 * Builds a reject tail naming `argName` + `ruleLabel` plus the standard two-remedy pair (fix
 * the name / use `.modify()`) — never the rejected VALUE (REQ-RXD-13.3's zero-echo contract).
 */
export function nameRuleTail(argName: string, ruleLabel: string): string {
  return `\`${argName}\` must ${ruleLabel} — fix the name, or use \`.modify()\` to make this edit directly.`;
}
