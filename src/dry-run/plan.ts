// SEAM-02 (REQ-04): pure author-vocabulary plan renderer.
// AST-blind + core-blind by construction (REQ-05): the ONLY import is a type-only
// import from wire.ts — erased at compile time, zero runtime dependency on src/core/*.
//
// Wire→author verb mapping (frozen, six rows — identity for five ops, one translation):
//   create  → create
//   modify  → modify
//   delete  → remove
//   rename  → rename
//   move    → move
//   copy    → copy
//
// This internal `dryRunPlan(snapshot)` renderer is surfaced to authors as the zero-arg
// `dryRun()` accessor in src/commons — renderer edits here are publicly visible under
// that name.
import type { Directive } from "../core/wire.ts";

/**
 * Author-facing verb vocabulary for a dry-run plan entry.
 *
 * Frozen at exactly these six members — adding a member is a MAJOR event (ADR-0025).
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
 *     default: {
 *       const exhaustive: never = verb;
 *       return exhaustive;
 *     }
 *   }
 * }
 */
export type DryRunVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy";

/**
 * One entry of a rendered dry-run plan: the author verb and the primary path the
 * operation targets. Carries no content or byte preview.
 *
 * `kind` is present ONLY on content-materializing entries (REQ-DRE-05, additive field —
 * the existing `{verb, path}` shape is unchanged): `"rendered"` for `create` (every
 * `create` IS a render request, whether the template came from an inline string or a
 * `templateFile` — indistinguishable in kind, REQ-DRE-05.3), `"copied"` for a
 * by-reference entry. Derived purely from the wire op — total, deterministic — and
 * ABSENT for `modify`/`remove`/`rename`/`move`/`copy`, none of which render or classify
 * (tagging a plain `remove` "rendered" would be a lie).
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

// Frozen six-row wire→author verb map — delete→remove, identity elsewhere. EXPORTED
// for the D3 consistency test (test-only reach, §4.6b): NOT re-exported by
// src/dry-run/index.ts or ./commons. The Record<Directive["op"], DryRunVerb> annotation
// itself compile-enforces totality over wire ops and value-membership in DryRunVerb;
// Object.freeze makes the "frozen" claim literal at runtime.
export const WIRE_TO_AUTHOR_VERB: Readonly<Record<Directive["op"], DryRunVerb>> =
  Object.freeze({
    create: "create",
    modify: "modify",
    delete: "remove",
    rename: "rename",
    move: "move",
    copy: "copy",
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
    }
  });
}
