// SEAM-04 (ADR-02, ADR-0020, ADR-0021, ADR-0022, ADR-0023): author-vocabulary error
// attribution. `toAuthoringError` translates a port-internal `EmitRejection` (or any
// other rejection value) into the author's own vocabulary: a closed `reason` (★D2), a
// derived `origin` (2.4), the actual offending directive's verb + primary path, and the
// applied-boundary count. Classification reads `EmitRejection.code` ONLY — never message
// text (REQ-ERM-01 ban) — and a non-EmitRejection rejection degrades to `reason:"unknown"`
// without crashing (REQ-ERM-03). The message is a FRESH string built from the closed
// reason/verb/path; the raw engine text is discarded and never chained via `.cause`, so
// the no-engine-text guarantee (REQ-AEC-05, FIT-11) holds for the WHOLE error object, not
// only `.message`.

import type { Batch, Directive } from "./wire.ts";
import { EmitRejection, type EmitRejectionCode } from "./emit-rejection.ts";

/**
 * The author-vocabulary verb of the operation whose rejection produced this
 * `AuthoringError` — `"remove"`, never the wire op `"delete"` (REQ-10.2).
 * `undefined` for batch-level rejections (`unrepresentable-content`,
 * `changes-too-large`, `unknown`), which have no single offending directive.
 *
 * `schematic-local-files` S-003 (A1): extended from six to seven — `copyIn` added,
 * forced by the `Directive["op"]` union gaining the `copyIn` wire op (ADR-0043); a
 * `copyIn` collision attributes `verb: "copyIn"` (the author never called `copy`).
 *
 * @example
 * if (err instanceof AuthoringError && err.verb !== undefined) {
 *   console.error(`${err.verb} was rejected at ${err.path}`);
 * }
 */
export type AuthoringVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy" | "copyIn";

/**
 * The closed, author-vocabulary cause of an `AuthoringError` (★D2, ADR-0020). Exactly
 * twelve values — adding a thirteenth is a MAJOR change: authors are expected to write
 * exhaustive `switch(reason)` blocks, and TypeScript's exhaustiveness check breaks such
 * a switch on a new member even though nothing breaks at runtime. (V2 → V3 amendment,
 * 2026-07-10, coordinated with `stage-4-typed-options`: extended from six to eight —
 * `invalid-input` and `reserved-name` added, REQ-AEC-07/08. `schematic-local-files`
 * S-002, REQ-AEC-10: extended from eight to twelve — `source-not-found`,
 * `source-outside-package`, `source-not-regular-file`, `source-unreadable` added, all
 * four covering the SDK's own pre-emit read/stat of a package-local source for
 * `scaffold`/`copyIn`/`create({templateFile})`.)
 *
 * @example
 * switch (err.reason) {
 *   case "path-collision":
 *     console.error(`${err.verb} collided at ${err.path}`);
 *     break;
 *   case "path-not-found":
 *   case "unrepresentable-content":
 *   case "changes-too-large":
 *   case "outside-run":
 *   case "unknown":
 *   case "invalid-input":
 *   case "reserved-name":
 *   case "source-not-found":
 *   case "source-outside-package":
 *   case "source-not-regular-file":
 *   case "source-unreadable":
 *     console.error(err.message);
 *     break;
 * }
 */
export type AuthoringReason =
  | "path-collision"
  | "path-not-found"
  | "unrepresentable-content"
  | "changes-too-large"
  | "outside-run"
  | "unknown"
  | "invalid-input"
  | "reserved-name"
  | "source-not-found"
  | "source-outside-package"
  | "source-not-regular-file"
  | "source-unreadable";

/**
 * Distinguishes an engine-refused write from an SDK-side misuse (2.4, ADR-0021) —
 * DERIVED from `reason`, never producer-set.
 *
 * @example
 * if (err.origin === "write-rejected") console.error("the engine refused the write");
 * else console.error("the schematic itself was used incorrectly");
 */
export type AuthoringOrigin = "write-rejected" | "authoring-rejected";

// ADR-0021: origin is DERIVED from reason via an exhaustive switch with a `never`
// default arm — adding a 13th reason breaks the BUILD here, forcing a deliberate origin
// assignment instead of an accidental default (mirrored by the compile-time pin in
// test/types/authoring-reason.test.ts). `unknown` maps to "write-rejected" deliberately:
// an unclassifiable rejection necessarily arrived through the emit/write seam (the only
// place toAuthoringError runs), so the write side is the honest attribution (spec
// cross-cutting note 7). `invalid-input`/`reserved-name` (V2 → V3 amendment, REQ-AEC-07/08)
// are ALWAYS "authoring-rejected" — same rationale as outside-run: an SDK-side misuse
// detection, not an engine round-trip refusal. The four `source-*` reasons
// (`schematic-local-files` S-002, REQ-AEC-10) are likewise ALWAYS "authoring-rejected" —
// every one is detected by the SDK's OWN pre-emit read/stat of a package-local source,
// never an engine round-trip refusal.
function originFor(reason: AuthoringReason): AuthoringOrigin {
  switch (reason) {
    case "path-collision":
    case "path-not-found":
    case "unrepresentable-content":
    case "changes-too-large":
    case "unknown":
      return "write-rejected";
    case "outside-run":
    case "invalid-input":
    case "reserved-name":
    case "source-not-found":
    case "source-outside-package":
    case "source-not-regular-file":
    case "source-unreadable":
      return "authoring-rejected";
    default: {
      const _exhaustive: never = reason;
      throw new Error(`originFor: unhandled reason ${String(_exhaustive)}`);
    }
  }
}

// Total mapping (emit-rejection-metadata REQ-ERM-01): every EmitRejectionCode maps to
// exactly one AuthoringReason. Classification reads `code` only, never message text.
const CODE_TO_REASON: Record<EmitRejectionCode, AuthoringReason> = {
  collision: "path-collision",
  "not-found": "path-not-found",
  unrepresentable: "unrepresentable-content",
  cap: "changes-too-large",
};

// wire op → author verb (REQ-10.2): "delete" is the WIRE name; the author vocabulary
// word is "remove". `remove` never rejects in practice (REQ-16 non-site) — this mapping
// is a translation-layer contract, proven at the unit level in authoring-error.test.ts.
function verbFor(op: Directive["op"]): AuthoringVerb {
  return op === "delete" ? "remove" : op;
}

// primaryPath (design §4.3, frozen table): the AUTHOR-DECLARED SOURCE-SIDE path for
// every verb, for BOTH failure forms (collision AND source-not-found) — never the
// computed destination. `path` is a locator ("which of my calls failed"); `reason`
// carries the why.
function primaryPath(directive: Directive): string {
  switch (directive.op) {
    case "create":
      return directive.create.pathTemplate;
    case "modify":
      return directive.modify.path;
    case "delete":
      return directive.delete.path;
    case "rename":
      return directive.rename.path;
    case "move":
      return directive.move.path;
    case "copy":
      return directive.copy.from;
    case "copyIn":
      return directive.copyIn.from;
  }
}

// REQ-AEC-06: message templates selected BY REASON, three-way — never by verb/path
// presence. `outside-run` also has verb/path undefined but must NOT get the batch
// template (the context.test.ts:12 substring pin would break).
//
// REQ-AEC-09 (V2 → V3 amendment) adds two MORE families (invalid-input's two variants,
// reserved-name) whose templates interpolate a `{field}`/`{expectedType}`/`{name}` this
// function has no locator for — `verb`/`path` cannot carry them without corrupting their
// existing typed meaning. Those two reasons therefore have NO default template here: the
// caller (the AuthoringError constructor) MUST supply an explicit `message` for them —
// see the `default` arm below, which throws rather than silently returning a wrong string.
//
// REQ-AEC-11 (`schematic-local-files` S-002, V3 neutral wording — no `"copy failed:"`
// prefix, dropped because these reasons also fire for `scaffold`/`create({templateFile})`,
// not only the copy-family verbs) adds four MORE families, one per new `source-*` reason.
// Unlike invalid-input/reserved-name, these ARE derivable from `path` alone (always
// package-relative, REQ-PRC-05) — no caller-supplied `message` needed.
function messageFor(reason: AuthoringReason, verb: AuthoringVerb | undefined, path: string | undefined): string {
  switch (reason) {
    case "path-collision":
    case "path-not-found":
      return `${verb} failed at ${path}: ${reason}`;
    case "outside-run":
      return (
        "@pbuilder/sdk: file verbs (create, find, modify, remove, rename, move, copy) " +
        "can only be used while a schematic is running — " +
        "call them inside your factory function, not at module load time."
      );
    case "unrepresentable-content":
    case "changes-too-large":
      return `changes could not be applied: ${reason}`;
    case "unknown":
      return `changes could not be applied: ${reason} — the SDK could not classify this failure`;
    case "source-not-found":
      return `source file not found: ${path} does not exist in the package`;
    case "source-outside-package":
      return `source file outside package: ${path} resolves outside the package boundary`;
    case "source-not-regular-file":
      return `source file invalid: ${path} is not a regular file`;
    case "source-unreadable":
      return `source file unreadable: ${path} could not be read`;
    case "invalid-input":
    case "reserved-name":
      throw new Error(
        `messageFor: reason "${reason}" has no default template (REQ-AEC-09) — construct AuthoringError with an explicit \`message\``
      );
    // Parity with originFor: noImplicitReturns is off, so without this arm a 13th reason
    // would fall through to an implicit `undefined` return instead of a build break.
    default: {
      const _exhaustive: never = reason;
      throw new Error(`messageFor: unhandled reason ${String(_exhaustive)}`);
    }
  }
}

/**
 * Thrown when an author's schematic run is rejected — by the engine (a refused write)
 * or by the SDK itself (a misuse detected before any engine round-trip). Catch it,
 * `switch` on `.reason`, and recover.
 *
 * @example
 * import { AuthoringError } from "@pbuilder/sdk/commons";
 *
 * try {
 *   await run(options, { client });
 * } catch (err) {
 *   if (err instanceof AuthoringError) {
 *     switch (err.reason) {
 *       case "path-collision":
 *         console.error(`${err.verb} collided at ${err.path}`);
 *         break;
 *       default:
 *         console.error(err.message);
 *     }
 *   }
 * }
 */
export class AuthoringError extends Error {
  readonly verb: AuthoringVerb | undefined;
  readonly path: string | undefined;
  readonly reason: AuthoringReason;
  readonly origin: AuthoringOrigin;
  /**
   * Counts directives applied within the failing flush before the offender — a
   * diagnostic for locating progress, NOT a persistence promise (a rejected run
   * discards everything, ADR-0015).
   */
  readonly appliedCount: number;

  constructor(fields: {
    verb: AuthoringVerb | undefined;
    path: string | undefined;
    reason: AuthoringReason;
    appliedCount: number;
    /**
     * Overrides the derived message. REQUIRED for `reason: "invalid-input"` /
     * `"reserved-name"` (REQ-AEC-09) — their templates interpolate caller-known data
     * (`{field}`, `{expectedType}`, `{name}`) `messageFor` cannot derive from `verb`/`path`
     * alone. Optional for every other reason, which derive their message from `reason` +
     * `verb` + `path` as before.
     */
    message?: string;
  }) {
    super(fields.message ?? messageFor(fields.reason, fields.verb, fields.path));
    this.name = "AuthoringError";
    this.verb = fields.verb;
    this.path = fields.path;
    this.reason = fields.reason;
    this.origin = originFor(fields.reason);
    this.appliedCount = fields.appliedCount;
  }
}

// Translates a raw emit() rejection (ideally an EmitRejection, ADR-0022) plus the
// flushed batch into a public AuthoringError. Any rejection that does not carry the
// EmitRejection shape (string/number/undefined/a metadata-less Error) degrades to
// reason:"unknown" without crashing (REQ-ERM-03) — never reads message text to classify
// (REQ-ERM-01 ban).
export function toAuthoringError(raw: unknown, batch: Batch): AuthoringError {
  if (raw instanceof EmitRejection) {
    // REQ-ERM-01 totality: an absent/unrecognized code (a buggy or future engine client
    // is not compile-checked at the throw site) degrades to "unknown" — the map lookup
    // alone would yield undefined and crash originFor downstream.
    const reason = CODE_TO_REASON[raw.code] ?? "unknown";
    const offender = raw.failedIndex !== undefined ? batch.instructions[raw.failedIndex] : undefined;
    return new AuthoringError({
      verb: offender ? verbFor(offender.op) : undefined,
      path: offender ? primaryPath(offender) : undefined,
      reason,
      appliedCount: raw.appliedCount,
    });
  }

  return new AuthoringError({
    verb: undefined,
    path: undefined,
    reason: "unknown",
    appliedCount: 0,
  });
}
