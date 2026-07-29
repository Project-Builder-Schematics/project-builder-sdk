// src/scaffold/expander.ts (ADR-0044): the SINGLE owner of the scaffold fan-out — drives
// `walk.ts` → `filename-pipeline.ts` → `classify-transport.ts` → emits `factory.create(...)`/
// `factory.copyIn(...)` directives via the run's session (Executor Context §18).
// `classify-transport.ts` stays a PURE per-file decision; a by-reference VERDICT is handled
// HERE, not there. S-003: the by-reference verdict now emits a real `copyIn` directive
// (`from` package-relative, REQ-BRC-07) instead of S-001/S-002's fail-loud placeholder throw.
//
// S-004 (batch-cap chunked flush, REQ-04/05): the expander maintains a serialized-size
// accumulator over the CURRENT `session` pending buffer and calls `session.flush()`
// BETWEEN groups when the next directive would push the pending batch's serialized form
// over `BATCH_CAP_BYTES` — the SDK never rejects on aggregate size (ADR-0018 amendment);
// an over-cap SINGLE group still rejects at the fake's `emit` unchanged (REQ-04.2).
//
// `scaffold(): void` is a PINNED synchronous author surface (design §Data Model, T2), yet
// `Session.flush()` is `async` and `session.ts` is READ-ONLY for this change (design §A4)
// — no synchronous flush variant may be added. The bridge is the EXISTING `DialectRegistry`
// (`context.ts`, ADR-0037), documented as generic over "anything with a `settle()`": a
// mid-run `session.flush()` call is fired here WITHOUT awaiting (its synchronous prefix —
// draining `#pending`, building the batch, and the fake's entirely-synchronous `#apply`
// loop — still runs to completion before `flush()`'s own `await` suspends it, so the
// `#tree` mutation for this group happens in-order, synchronously, before the next group
// starts buffering) and REGISTERED as a dialect handle. `defineFactory` already awaits
// `ctx.dialects.drain()` BEFORE its own run-end `session.flush()` (which covers the final,
// still-pending group) and BEFORE `commit()` — so a later-chunk rejection surfaces through
// `drain()`, routes to `defineFactory`'s existing catch, and `discard()` clears the SAME
// underlying `#tree` every chunk staged into: run-level all-or-nothing (REQ-05) holds with
// NO new atomicity mechanism, exactly as the design promises.

import { posix, join } from "node:path";
import { currentContext, requirePackageAnchors } from "../core/context.ts";
import { invalidInput } from "../core/authoring-error.ts";
import { forceEntry } from "../core/directive-factory.ts";
import type { JsonValue } from "../core/wire.ts";
import { EMIT_BATCH_BUDGET_BYTES, serializedBatchSize } from "../core/wire.ts";
import { walkFolder } from "./walk.ts";
import { runFilenamePipeline, isIncluded, detectDestinationCollisions, translateTokens } from "./filename-pipeline.ts";
import { classifyTransport } from "./classify-transport.ts";
import { validateDestinationLexical, validateSourceLexical } from "./path-guards.ts";

/**
 * Argument shape for the `scaffold` author verb (REQ-FSC-01). `from`/`to` are mandatory;
 * every other field defaults per REQ-FSC-01: `options` → `{}`, `include` → match
 * everything, `exclude` → match nothing, `rename` → no remap, `force` → `false`.
 */
export interface ScaffoldArgs {
  from: string;
  to: string;
  options?: JsonValue;
  include?: string[];
  exclude?: string[];
  rename?: Record<string, string>;
  force?: boolean;
}

function noResolutionAnchorMessage(): string {
  return (
    "invalid input: scaffold has no package directory to resolve package-local files against — " +
    "pass `packageDir` to the call that runs this factory"
  );
}

function missingArgMessage(field: "from" | "to"): string {
  return `invalid input: scaffold requires "${field}"`;
}

function filtersEliminatedEverythingMessage(include: string[] | undefined, exclude: string[] | undefined): string {
  return (
    `invalid input: scaffold filters eliminated every entry — ` +
    `include: ${JSON.stringify(include ?? [])}, exclude: ${JSON.stringify(exclude ?? [])}`
  );
}

// judgment-day round 3 fix (F1): a non-array (or an array with a non-string element)
// used to reach `isIncluded`'s `.some((p) => globToRegex(p).test(relPath))` and either
// throw a raw TypeError (non-array) or silently compile a non-string element into an
// always-empty-matching `/^$/` regex (an element that never rejects, never matches) —
// screened here, at entry, before either filter ever reaches `isIncluded`. No-echo: names
// the OPTION, never echoes the (possibly huge or malformed) value itself.
function filterOptionShapeMessage(option: "include" | "exclude"): string {
  return `invalid input: scaffold "${option}" must be an array of strings`;
}

function validateFilterOptionShape(option: "include" | "exclude", value: string[] | undefined): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw invalidInput(filterOptionShapeMessage(option));
  }
}

// Owner ruling 17 (2026-07-29, judgment-day round 3): `from` resolving to the package root
// itself — `""`, `"."`, or `"./"` — used to enumerate the ENTIRE `packageDir`, never
// rejected: none of these three literals contain a `..` segment or an absolute form, so
// `validateSourceLexical` let them straight through to `walkFolder`. `scaffold` mirrors A
// FOLDER into `to`; the package root is not a folder an author names on purpose to mirror
// wholesale, and doing so silently is a strictly worse surprise than the analogous
// symlinked-root rejection (ruling 16) — same posture, same reason. Also closes a related
// theoretical: `resolve("")`/`resolve(".")`/`resolve("./")` all equal `packageDir` itself,
// so the (unresolved) question of whether `packageDir` being a symlink should exempt the
// walk-root symlink check never arises for these three forms — they never reach the walk
// at all.
const DEGENERATE_FROM_VALUES: ReadonlySet<string> = new Set(["", ".", "./"]);

function degenerateFromMessage(from: string): string {
  return (
    `invalid input: scaffold "from" (${JSON.stringify(from)}) refers to the package directory ` +
    `itself — scaffold never implicitly mirrors the whole package; point "from" at a real subfolder`
  );
}

function validateNonDegenerateFrom(from: string): void {
  if (DEGENERATE_FROM_VALUES.has(from)) {
    throw invalidInput(degenerateFromMessage(from));
  }
}

// REQ-04's serialized-size heuristic (S-004): tracks what the PENDING batch would
// serialize to via `serializedBatchSize`'s envelope shape — the EXACT same measurement the
// fake applies at emit time — a lowering heuristic, not a second size authority (ADR-0018
// amendment); the fake's own `emit` cap check remains the sole judge (ADR-0019).
const EMPTY_BATCH_SIZE = serializedBatchSize([]);

/**
 * Walks a package-local folder and mirrors it into the target tree (REQ-FSC-01..09):
 * every source-relative path enumerates (REQ-FSC-09), passes include/exclude filtering
 * (REQ-FSC-03), runs the rename→token→`.template`-strip pipeline (REQ-FSC-05), and is
 * checked for intra-scaffold destination collisions (REQ-FSC-08) BEFORE any file is
 * classified. Each surviving source classifies by-value or by-reference
 * (`content-classification`); by-value sources emit a `create` directive through the
 * existing IR. A truly-empty `from` folder no-ops (REQ-FSC-04.1); filters eliminating
 * every entry fail loud, naming them (REQ-FSC-04.2). `force` passes through unchanged to
 * every emitted directive (REQ-FSC-06). The destination lexical guard (`ir-path-well-formedness`
 * REQ-IPF-02, re-homed from the retired `package-root-containment` REQ-PRC-09) applies
 * to the FINAL computed destination, immediately pre-emit. Aggregate size never blocks the
 * scaffold outright (REQ-04) — the expander chunks via mid-run `session.flush()` calls
 * (see the module header for the sync/async bridge); run-level atomicity (REQ-05) is free.
 */
export function runScaffold(args: ScaffoldArgs): void {
  if (args.from === undefined) {
    throw invalidInput(missingArgMessage("from"));
  }
  if (args.to === undefined) {
    throw invalidInput(missingArgMessage("to"));
  }

  const ctx = currentContext();
  const { session, factory } = ctx;
  const { packageDir } = requirePackageAnchors(noResolutionAnchorMessage());

  // judgment-day round 3 fix (F4): destination validated AFTER context resolution (`ctx`/
  // `packageDir` above), not before it — round 2 placed this call at the very top of the
  // function, ABOVE `currentContext()`, so an escaping `to` called OUTSIDE any run reported
  // `invalid-input` where `copyIn` (whose own version of this same guard already runs
  // AFTER its `currentContext()`/`requirePackageAnchors` calls, see `index.ts`'s
  // `runCopyIn`) reports `outside-run` — the two package-local verbs disagreed on which
  // failure wins when BOTH apply. `runScaffold` now mirrors `runCopyIn`'s exact ordering:
  // ctx → packageDir → destination guard → (new F7/F1 screens below) → source guard. The
  // existing post-rename/post-token-translation validation of the FINAL `destPath` inside
  // the loop below is unchanged — rename/token substitution can still alter the string
  // after this raw-input screen passes.
  validateDestinationLexical(args.to);

  // Owner ruling 17 (F7): a degenerate `from` (`""`, `"."`, `"./"`) rejects before it ever
  // reaches the walk — see `validateNonDegenerateFrom`'s own comment above.
  validateNonDegenerateFrom(args.from);

  // judgment-day round 3 fix (F1): include/exclude shape-screened before either ever
  // reaches `isIncluded` (see `validateFilterOptionShape`'s own comment above).
  validateFilterOptionShape("include", args.include);
  validateFilterOptionShape("exclude", args.exclude);

  // Screen call site 2 (REQ-IPF-01): the walk ROOT itself must be lexically screened
  // BEFORE `walkFolder` ever enumerates it — otherwise an escaping `from` (e.g.
  // `../secrets`) would readdirSync/lstatSync the whole tree (bounded by `walk.ts`'s
  // 10k-entry cap) before any check had a chance to fire. Check-before-walk ordering
  // preserved verbatim (design §4).
  validateSourceLexical(args.from);

  const fromAbs = join(packageDir, args.from);
  const walked = walkFolder(fromAbs, undefined, args.from);
  if (walked.length === 0) {
    return; // REQ-FSC-04.1: a truly-empty source folder is a silent no-op.
  }

  const filtered = walked.filter((entry) => isIncluded(entry.relPath, args.include, args.exclude));
  if (filtered.length === 0) {
    throw invalidInput(filtersEliminatedEverythingMessage(args.include, args.exclude));
  }

  const pipelineResults = filtered.map((entry) => runFilenamePipeline(entry.relPath, args.rename));
  detectDestinationCollisions(pipelineResults);

  const toPrefix = translateTokens(args.to);

  // Running serialized-size counter over the CURRENT pending buffer — seeded from the real
  // snapshot (directives buffered BEFORE this scaffold call count toward the first group)
  // and maintained incrementally. Byte-identical to re-serializing the whole batch per
  // append: JSON array bytes are additive — each extra element contributes exactly its own
  // `JSON.stringify` bytes plus one comma when it is not the first.
  const seedPending = session.pendingSnapshot();
  let pendingCount = seedPending.length;
  let pendingSize = serializedBatchSize(seedPending);

  for (const result of pipelineResults) {
    const sourceRelPath = posix.join(args.from, result.sourceRelPath);

    // judgment-day round 3 fix (F2): `posix.join(toPrefix, result.destRelPath)` NORMALIZES
    // away any `..` segment in `result.destRelPath` BEFORE the post-join
    // `validateDestinationLexical(destPath)` below ever runs — a `rename` value like
    // `"../evil.ts"` joined against a one-segment `to` (e.g. `"out"`) collapses to
    // `"evil.ts"`, which contains no literal `..` and sails through the post-join guard
    // even though it never lands under `to` at all (REQ-FSC-02's mirror-under-`to`
    // invariant, violated silently). Validating the PRE-join `result.destRelPath` catches
    // every literal `..` segment a rename rule can introduce, regardless of whether `to`'s
    // own depth happens to "cancel" it out after joining — the post-join guard below stays
    // as a second, independent check (e.g. for a `to` prefix itself carrying a stray
    // segment after token translation).
    validateDestinationLexical(result.destRelPath);

    // destPath computed BEFORE classify (reordered from the source-only call this
    // replaces): REQ-CCL-02's budget is evaluated against the PROSPECTIVE `create`
    // directive this source would emit, so classifyTransport needs the same
    // pathTemplate/options/force this loop will put on that directive below.
    const destPath = posix.join(toPrefix, result.destRelPath);
    const verdict = classifyTransport({
      packageDir,
      relPath: sourceRelPath,
      isTemplateMarked: result.isTemplateMarked,
      destPath,
      options: args.options ?? {},
      force: args.force,
    });

    validateDestinationLexical(destPath);

    // S-003: a by-reference verdict emits a real `copyIn` directive — `from` is the
    // package-relative source path (REQ-BRC-07), never the resolved absolute path;
    // hygiene already validated this source inside `classifyTransport`
    // (`statSourceForRead` runs BEFORE the stat/sniff/budget gates), so no second
    // hygiene check is needed here. Per-entry sources are SDK-computed from an
    // already-screened root and are NOT re-lexically-screened (design §4 carve-out).
    const directive =
      verdict.verdict === "by-value"
        ? factory.create({
            pathTemplate: destPath,
            template: verdict.content,
            options: args.options ?? {},
            ...forceEntry(args.force),
          })
        : factory.copyIn({
            from: sourceRelPath,
            to: destPath,
            ...forceEntry(args.force),
          });

    // REQ-04: if adding this directive to the CURRENTLY pending (not-yet-flushed) group
    // would push its serialized batch over the emit budget (`EMIT_BATCH_BUDGET_BYTES` —
    // the SAME boundary the emit authority enforces, spec V4 REQ-WPS-04.1), flush the
    // existing group first — never preemptively when the pending buffer is empty (an
    // over-budget SINGLE directive still flushes as its own group and rejects at the
    // fake's `emit`, unchanged REQ-04.2).
    const directiveSize = Buffer.byteLength(JSON.stringify(directive), "utf8");
    if (pendingCount > 0 && pendingSize + directiveSize + 1 > EMIT_BATCH_BUDGET_BYTES) {
      const flushPromise = session.flush();
      ctx.dialects.register({ settle: () => flushPromise });
      pendingCount = 0;
      pendingSize = EMPTY_BATCH_SIZE;
    }

    session.buffer(directive);
    pendingCount += 1;
    pendingSize += directiveSize + (pendingCount > 1 ? 1 : 0);
  }
}
