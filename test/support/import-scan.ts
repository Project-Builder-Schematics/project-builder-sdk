// Shared with FIT-15 (bin -> core direction) and FIT-21 (context.ts no dialect-handle
// import) — both resolve relative import specifiers against the importing file's own
// directory and flag any that resolve INTO a forbidden target, a textual substring check
// (`"bin/"` / `"dialect-handle"`) would false-positive on legitimate identifiers/paths
// merely containing that text, so this resolves paths for real.

import { resolve } from "node:path";

export const IMPORT_SPECIFIER_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

/**
 * Resolves every relative import specifier in `source` (as if it lived in `fromDir`) and
 * returns those resolving into `target` — covers both a directory target (FIT-15's `bin/`,
 * matched by exact equality or any path nested under it) and a single-file target (FIT-21's
 * `dialect-handle.ts`, matched by exact equality or its extensionless form, since import
 * specifiers omit the `.ts` extension).
 */
export function specifiersResolvingInto(source: string, fromDir: string, target: string): string[] {
  const offenders: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    const specifier = match[1]!;
    if (!specifier.startsWith(".")) continue; // bare/package specifiers can never reach it
    const resolved = resolve(fromDir, specifier);
    if (resolved === target || resolved === target.replace(/\.ts$/, "") || resolved.startsWith(`${target}/`)) {
      offenders.push(specifier);
    }
  }
  return offenders;
}
