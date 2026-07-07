# Delta for Dry-Run Plan Skeleton

**Spec version**: V2
**Status**: signed — V2, owner, 2026-07-06 (delta rides the signed change spec)
**Change**: `stage-3-dry-run-exposure`
**Domain**: MODIFIED (main spec: `openspec/specs/dry-run-plan-skeleton/spec.md`)

V2 — no content change to this delta from V1 council review other than two
cross-references: (1) the cross-domain end-to-end proof of the verb translation
through the public accessor now lives at `dry-run-plan-exposure` REQ-DRE-01.5
(this delta's REQ-04.4 remains the renderer-isolated decoy); (2) the possible
narrowing of `DryRunEntry.verb` from `string` to a LOCAL six-member union
(`DryRunVerb`, living in `src/dry-run/**`, never imported from stage-2's
`src/core/authoring-error.ts`) is flagged for design under
`dry-run-plan-exposure` REQ-DRE-02 — if design adopts it, the type lands in this
domain's files but requires no REQ change here (the frozen map below already
pins the six values). All REQ-IDs stable.

The renderer's shape and purity invariants are untouched. The ONLY change is a
vocabulary correction: `dryRunPlan` must render the AUTHOR verb for every op,
never a wire tag — the code today violates the main spec's own REQ-04 wording
("`verb` (author vocabulary)") by emitting the wire tag `"delete"` for the delete
op, per a "design §4.4" note that is retired by this delta. REQ-03 and REQ-05 are
UNCHANGED — not touched by this delta.

## UNCHANGED Requirements (for reference, not modified)

- **REQ-03: Read-Only Pending Buffer Snapshot** — untouched; `Session.pendingSnapshot()`
  needs no change (stage-3 wires it read-only from `./commons`, per the
  `dry-run-plan-exposure` domain).
- **REQ-05: AST Import Prohibition** — untouched; `plan.ts` gains no new import.

## MODIFIED Requirements

### REQ-04: Minimal Dry-Run Plan Renderer

A `dryRunPlan` function MUST accept a `Directive[]` snapshot and MUST return a
`DryRunEntry[]` array where each entry carries `verb` (author vocabulary) and `path`
(primary path of the operation). The renderer MUST NOT import or invoke any AST,
engine, or filesystem module.

The wire→author verb mapping is frozen as exactly these six rows — identity for five
ops, one translation for `delete`:

| Wire op (`Directive.op`) | Author verb (`DryRunEntry.verb`) |
|---|---|
| `create` | `create` |
| `modify` | `modify` |
| `delete` | `remove` |
| `rename` | `rename` |
| `move` | `move` |
| `copy` | `copy` |

(Previously: the `delete` op rendered the wire tag `verb: "delete"`, justified by a
"design §4.4" note cited in `src/dry-run/plan.ts`'s header comment and
`test/dry-run/plan.test.ts:13-14`'s doc comment. No such exception exists in this
main spec's own REQ-04 wording, which has always required "author vocabulary" — the
code was violating its own signed spec. This delta corrects the code to the spec: the
"§4.4 wire-tag" rationale is RETIRED. `plan.ts`'s header comment and `plan.test.ts`'s
doc comment MUST be updated to state the table above, not cite a design section that
never authorized a wire-tag exception.)

#### Scenario REQ-04.1: Renderer maps a create directive to author vocabulary

- GIVEN a directives array containing `{ op: "create", create: { pathTemplate: "src/foo.ts", template: "…", options: {} } }`
- WHEN `dryRunPlan` is called with that array
- THEN the result contains `{ verb: "create", path: "src/foo.ts" }`

#### Scenario REQ-04.2: Renderer maps all six commons directive ops to author vocabulary

- GIVEN a directives array with one entry of each op kind (`create`, `modify`,
  `delete`, `rename`, `move`, `copy`)
- WHEN `dryRunPlan` is called
- THEN the result contains six entries whose `verb` is EXACTLY `create`, `modify`,
  `remove`, `rename`, `move`, `copy` respectively (per the table above) — `remove`
  for the `delete` op, never `delete`
- AND `path` is the primary path of each directive (`pathTemplate` for create,
  `path` for modify/delete/rename/move, `from` for copy)

#### Scenario REQ-04.3: Renderer output equals buffered directives for a write-only chain

- GIVEN a write-only factory that calls `create<S>` once (no `.read()` call)
- WHEN the pending snapshot is captured immediately before flush
- AND `dryRunPlan` is called on the snapshot
- THEN the plan contains exactly one entry for the create verb (FIT-01 green: no AST imported)

#### Scenario REQ-04.4: Renderer never emits the wire tag for the delete op [decoy]

- GIVEN a directives array containing only a single `{ op: "delete", delete: { path: "src/gone.ts" } }` directive
- WHEN `dryRunPlan` is called
- THEN the resulting entry's `verb` is EXACTLY `"remove"`
- AND is NOT `"delete"` — a dedicated negative assertion so a future edit to the
  verb mapping cannot silently reintroduce the wire tag on this one op while
  REQ-04.2's aggregate check happens to still read as "six entries returned"

## REQ-ID Stability (V2 vs main spec)

- Preserved: REQ-03, REQ-05 (unchanged), REQ-04 (modified content, ID stable).
- Newly added: none — REQ-04.4 is a new SCENARIO under the existing REQ-04, not a
  new REQ-ID. V2 adds no further scenarios to this delta.
- Marked REMOVED: none.
