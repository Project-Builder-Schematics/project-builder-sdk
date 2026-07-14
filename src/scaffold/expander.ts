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
import { BATCH_CAP_BYTES, serializedBatchSize } from "../core/wire.ts";
import { walkFolder } from "./walk.ts";
import { runFilenamePipeline, isIncluded, detectDestinationCollisions, translateTokens } from "./filename-pipeline.ts";
import { classifyTransport } from "./classify-transport.ts";
import { validateDestinationLexical, validateSourceRootContainment, resolveRealCeiling } from "./containment.ts";

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
 * every emitted directive (REQ-FSC-06). The destination lexical guard (REQ-PRC-09) applies
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
  const { packageDir, packageRoot } = requirePackageAnchors(noResolutionAnchorMessage());

  // The ceiling's realpath is a RUN invariant (not one of the pinned per-candidate
  // validation steps) — resolve it once for both the root check below and the whole
  // entry loop.
  const realCeiling = resolveRealCeiling(packageRoot);

  // SEC (owner-ratified final-verify remediation): the walk ROOT itself must be
  // containment-checked BEFORE `walkFolder` ever enumerates it — otherwise an escaping
  // `from` (e.g. `../secrets`) would readdirSync/lstatSync the whole out-of-ceiling
  // subtree (bounded by `walk.ts`'s 10k-entry cap) before any per-entry containment
  // check had a chance to fire. Reuses the SAME lexical + realpath ceiling machinery the
  // per-entry loop below already uses via `classifyTransport` → `validateSourceContainment`
  // — no parallel check forked for this directory case.
  validateSourceRootContainment({ packageDir, packageRoot, relPath: args.from, realCeiling });

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
    // destPath computed BEFORE classify (reordered from the source-only call this
    // replaces): REQ-CCL-02's budget is evaluated against the PROSPECTIVE `create`
    // directive this source would emit, so classifyTransport needs the same
    // pathTemplate/options/force this loop will put on that directive below.
    const destPath = posix.join(toPrefix, result.destRelPath);
    const verdict = classifyTransport({
      packageDir,
      packageRoot,
      relPath: sourceRelPath,
      isTemplateMarked: result.isTemplateMarked,
      realCeiling,
      destPath,
      options: args.options ?? {},
      force: args.force,
    });

    validateDestinationLexical(destPath);

    // S-003: a by-reference verdict emits a real `copyIn` directive — `from` is the
    // package-relative source path (REQ-BRC-07), never the resolved absolute path;
    // containment already validated this source inside `classifyTransport`
    // (`validateSourceContainment` runs BEFORE the stat/sniff/budget gates, REQ-PRC-08),
    // so no second containment check is needed here.
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
    // would push its serialized batch over the cap, flush the existing group first — never
    // preemptively when the pending buffer is empty (an over-cap SINGLE directive still
    // flushes as its own group and rejects at the fake's `emit`, unchanged REQ-04.2).
    const directiveSize = Buffer.byteLength(JSON.stringify(directive), "utf8");
    if (pendingCount > 0 && pendingSize + directiveSize + 1 > BATCH_CAP_BYTES) {
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
