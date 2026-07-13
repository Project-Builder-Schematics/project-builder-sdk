// R-A (owner micro-unfreeze): wraps `runFactoryForTest` — the normative run-level
// recording harness, and the ONLY primitive exposing the terminal outcome (tree+error)
// GCC-09 rejection records and matrix row M-21 need. Never touches `makeSpyClient` /
// spy-client.ts (ITC-04). The module's value-add is NORMALIZATION (ITC-01): it builds the
// record downstream corpus/report code asserts against — never a bare pass-through of
// `emitted`.
import type { Batch, Directive } from "../../src/core/wire.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import {
  embedTemplate,
  type BatchGroupingEntry,
  type CapturedRecord,
  type NormativeDirective,
} from "./corpus-format.ts";

export interface CaptureResult {
  record: CapturedRecord;
  /** `emitted.flatMap(b => b.instructions)`, emission order — the report renderer's input
   * (R-D); the normalized `record` never feeds the renderer. */
  rawDirectives: readonly Directive[];
  tree: ReadonlyMap<string, string>;
  emitted: Batch[];
  error: AuthoringError | undefined;
}

// ITC-05 (zombie tripwire): exactly two named branches — `create` and `copyIn`, this
// family's own verbs. No branch is keyed on rename/move/delete/modify/copy; any other
// wire op reaching here is out of this capture module's scope and throws loudly rather
// than silently misrepresenting it in a corpus record.
function normalizeDirective(d: Directive): NormativeDirective {
  if (d.op === "create") {
    return {
      op: "create",
      pathTemplate: d.create.pathTemplate,
      template: embedTemplate(d.create.template),
      options: d.create.options,
      force: d.create.force ?? false,
    };
  }
  if (d.op === "copyIn") {
    return { op: "copyIn", from: d.copyIn.from, to: d.copyIn.to, force: d.copyIn.force ?? false };
  }
  throw new Error(
    `ir-transcript: directive op "${d.op}" is outside this capture module's scope (create/copyIn only, ITC-05)`
  );
}

function batchGrouping(emitted: readonly Batch[]): BatchGroupingEntry[] {
  return emitted.map((b) => ({ directiveCount: b.instructions.length, protocolVersion: b.protocolVersion }));
}

/**
 * Wraps `runFactoryForTest` (R-A) and normalizes its raw `Batch[]` into the record shape
 * `corpus-format.ts`'s `buildRecord` assembles into a full `TranscriptRecord`. THE single
 * capture path (FIT-25) — the corpus writer, report renderer, and e2e file all import
 * this module, never a second one.
 *
 * A thrown value that is not an `AuthoringError` is a factory bug, not a scenario this
 * module normalizes — it propagates unchanged rather than being mis-recorded as a
 * rejection.
 */
export async function captureRun<O>(
  run: Parameters<typeof runFactoryForTest<O>>[0],
  input: O,
  seed?: Record<string, string>
): Promise<CaptureResult> {
  const result = await runFactoryForTest(run, input, seed);
  const rawDirectives = result.emitted.flatMap((b) => b.instructions);
  const grouping = batchGrouping(result.emitted);

  if (result.error === undefined) {
    return {
      record: {
        normative: { outcome: "committed", directives: rawDirectives.map(normalizeDirective) },
        informative: { batchGrouping: grouping },
      },
      rawDirectives,
      tree: result.tree,
      emitted: result.emitted,
      error: undefined,
    };
  }

  if (result.error instanceof AuthoringError) {
    return {
      record: {
        normative: {
          outcome: "rejected",
          directives: [],
          // R-F: verbatim pass-through — upstream already mints package-relative paths;
          // never relativized here. Absent verb/path serialize as null.
          rejection: {
            reason: result.error.reason,
            verb: result.error.verb ?? null,
            path: result.error.path ?? null,
          },
        },
        informative: { batchGrouping: grouping },
      },
      rawDirectives,
      tree: result.tree,
      emitted: result.emitted,
      error: result.error,
    };
  }

  throw result.error;
}
