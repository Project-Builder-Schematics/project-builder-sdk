// SEAM-02 (REQ-04): pure author-vocabulary plan renderer.
// AST-blind + core-blind by construction (REQ-05): the ONLY import is a type-only
// import from wire.ts — erased at compile time, zero runtime dependency on src/core/*.
//
// Wire→author verb mapping (frozen, seven rows — identity for six ops, one translation):
//   create  → create
//   modify  → modify
//   delete  → remove
//   rename  → rename
//   move    → move
//   copy    → copy
//   copyIn  → copyIn
//
// This internal `dryRunPlan(snapshot)` renderer is surfaced to authors as the zero-arg
// `dryRun()` accessor in src/commons — renderer edits here are publicly visible under
// that name.
import type { Directive } from "../core/wire.ts";

/**
 * Author-facing verb vocabulary for a dry-run plan entry.
 *
 * Frozen at exactly these seven members — adding a member is a MAJOR event (ADR-0025).
 * `schematic-local-files` S-003 (ADR-0025 amendment): grew from six to seven — `copyIn`
 * added, 1:1 with the `copyIn` wire op (ADR-0043).
 *
 * @example
 * function label(verb: DryRunVerb): string {
 *   switch (verb) {
 *     case "create": return "creates";
 *     case "modify": return "modifies";
 *     case "remove": return "removes";
 *     case "rename": return "renames";
 *     case "move": return "moves";
 *     case "copy": return "copies";
 *     case "copyIn": return "copies in";
 *     default: {
 *       const exhaustive: never = verb;
 *       return exhaustive;
 *     }
 *   }
 * }
 */
export type DryRunVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy" | "copyIn";

/**
 * One entry of a rendered dry-run plan: the author verb and the primary path the
 * operation targets. Carries no content or byte preview.
 *
 * `kind` is present ONLY on the package-local-READ verbs whose transport is CLASSIFIED
 * (REQ-DRE-05, additive field — the existing `{verb, path}` shape is unchanged):
 * `"rendered"` for `create` (every `create` IS a render request, whether the template
 * came from an inline string or a `templateFile` — indistinguishable in kind,
 * REQ-DRE-05.3), `"copied"` for a `copyIn` entry (REQ-DRE-05.2) — including a `scaffold`
 * entry that classified by-reference and surfaces under author verb `"copyIn"` even
 * though the author never called `copyIn` directly (REQ-DRE-06). Derived purely from the
 * wire op — total, deterministic — and ABSENT for `modify`/`remove`/`rename`/`move`/
 * `copy`: the tree→tree `copy` verb predates this axis and materializes content too, but
 * it is never package-local-read/classified, so it carries no `kind` (tagging a plain
 * `remove` "rendered" would be a lie, but `copy`'s absence is a scope boundary, not a lie
 * about its own behavior).
 *
 * @example
 * const plan = dryRun(); // from "@pbuilder/sdk/commons"
 * for (const entry of plan) {
 *   console.log(entry.verb, entry.path, entry.kind);
 * }
 */
export interface DryRunEntry {
  verb: DryRunVerb;
  path: string;
  kind?: "rendered" | "copied";
}

// Frozen seven-row wire→author verb map — delete→remove, identity elsewhere (including
// copyIn→copyIn). EXPORTED for the D3 consistency test (test-only reach, §4.6b): NOT
// re-exported by src/dry-run/index.ts or ./commons. The Record<Directive["op"], DryRunVerb>
// annotation itself compile-enforces totality over wire ops and value-membership in
// DryRunVerb; Object.freeze makes the "frozen" claim literal at runtime.
export const WIRE_TO_AUTHOR_VERB: Readonly<Record<Directive["op"], DryRunVerb>> =
  Object.freeze({
    create: "create",
    modify: "modify",
    delete: "remove",
    rename: "rename",
    move: "move",
    copy: "copy",
    copyIn: "copyIn",
  });

/**
 * Renders a directive snapshot as an author-vocabulary plan.
 *
 * Each entry carries the author verb (per the frozen `WIRE_TO_AUTHOR_VERB` table above)
 * and the primary source path of the operation:
 *   create  → create.pathTemplate
 *   modify  → modify.path
 *   delete  → delete.path   (rendered as author verb "remove")
 *   rename  → rename.path
 *   move    → move.path
 *   copy    → copy.from     (primary source path)
 *   copyIn  → copyIn.from   (primary source path, REQ-BRC-07 package-relative)
 */
export function dryRunPlan(snapshot: readonly Directive[]): DryRunEntry[] {
  return snapshot.map((d): DryRunEntry => {
    const verb = WIRE_TO_AUTHOR_VERB[d.op];
    switch (d.op) {
      // "rendered" — every `create` IS a render request, inline `template` or
      // `templateFile` alike (REQ-DRE-05.3's indistinguishability).
      case "create": return { verb, path: d.create.pathTemplate, kind: "rendered" };
      case "modify": return { verb, path: d.modify.path };
      case "delete": return { verb, path: d.delete.path };
      case "rename": return { verb, path: d.rename.path };
      case "move":   return { verb, path: d.move.path };
      case "copy":   return { verb, path: d.copy.from };
      // "copied" — a copyIn NEVER renders (REQ-FEH-03); DRE-05.2's always-copied pin.
      case "copyIn": return { verb, path: d.copyIn.from, kind: "copied" };
    }
  });
}
