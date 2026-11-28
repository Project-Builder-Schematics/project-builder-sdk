// KIT-05: Ambient SessionContext via AsyncLocalStorage.
// defineFactory returns a runner that builds the context and runs fn inside the ALS.
// The EngineClient is injected by the caller (test passes the fake) — no module global.

import { fileURLToPath } from "node:url";
import type { EngineClient } from "../../../domain/ports/engine-client.ts";
import { PackageReadFailure, type PackageFiles } from "../../../domain/ports/package-files.ts";
import { DirectiveFactory } from "../../../domain/services/directive-factory.ts";
import { Session } from "../../../domain/aggregates/session/session.ts";
import { invalidInput } from "../../../domain/valueobjects/authoring-error.ts";
import { currentRun, getSessionAls } from "../../../domain/services/run-context.ts";
import { schemaPathFor } from "../../../domain/services/schema/schema-files.ts";
import { parseSchema, SchemaParseFailure, formatLocator } from "../../../domain/services/schema/schema-parse.ts";
import { checkResult, validateInput } from "../../../domain/services/schema/schema-validate.ts";
import {
  rejectionFor,
  rejectionForReservedName,
  rejectionForResult,
  rejectionForScopeInput,
} from "../../../domain/services/schema/input-rejection.ts";
import { handedOnFindings, scopeOf, type InScope } from "../../../domain/services/evaluation.ts";
import { SCOPE_INPUTS, SOURCED_FINDINGS } from "../../../domain/valueobjects/findings.ts";
import type { ResultSchema, Schema } from "../../../domain/valueobjects/schema-model.ts";

// ADR-0037: the run-boundary join registry. A dialect handle self-registers here at its
// first op; `defineFactory` drains it (awaits every registered `settle()`) BEFORE
// `session.flush()`, so an unawaited dialect chain still completes and commits, and an
// unawaited THROWING chain rejects the run contained instead of leaking an
// `unhandledRejection`. Kept generic over "anything with a settle()" — this module has no
// knowledge of dialect-handle.ts internals; the handle reaches the run through run-context.ts.
export interface DialectRegistry {
  register(handle: { readonly settle: () => Promise<void> }): void;
  drain(): Promise<void>;
}

class DialectRegistryImpl implements DialectRegistry {
  #handles: Array<{ readonly settle: () => Promise<void> }> = [];

  register(handle: { readonly settle: () => Promise<void> }): void {
    this.#handles.push(handle);
  }

  // Promise.allSettled (never a bare Promise.all): every handle's settle() is awaited
  // regardless of others rejecting, so no settlement is left dangling unobserved; the
  // FIRST rejection (author-chain order) is re-thrown into defineFactory's existing catch.
  async drain(): Promise<void> {
    const handles = this.#handles;
    this.#handles = [];
    const results = await Promise.allSettled(handles.map((h) => h.settle()));
    const firstRejection = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (firstRejection !== undefined) {
      throw firstRejection.reason;
    }
  }
}

export interface SessionContext {
  session: Session;
  factory: DirectiveFactory;
  dialects: DialectRegistry;
  // F2 poison flag (ADR-0037 amendment): Session-scoped, first-wins, set by dialect-handle.ts's
  // step wrapper on the FIRST rejection and consulted at every subsequent step/read() entry
  // so a chained op on a DIFFERENT handle is never attempted as a fresh operation
  // (REQ-DG-07.3) — not merely left uncommitted. Never serialized, never crosses the wire.
  // Plain field, no reverse import: context.ts still imports NOTHING from
  // dialect-handle.ts (F2 fitness-guarded) — dialect-handle.ts reaches this via
  // currentContext().
  sessionFailure?: { reason: unknown };
  // ADR-0077 §C: `packageDir` is the SOLE run anchor — seeded ONCE, eagerly, at the
  // pre-`als.run` chokepoint below, never re-derived per scaffold/copyIn call within the
  // same run. Absent for the bare `defineFactory(fn)` untyped opt-out (byte-for-byte
  // unchanged behavior). There is no containment ceiling anchor anymore (the ancestor-
  // marker walk and `package-root-containment` are retired) — a single-field shape,
  // never a differently-shaped regrowth (REQ-FTG-06 guards this statically and at
  // runtime, REQ-MFB-01.3).
  packageAnchors?: { packageDir: string };
  // The package-files adapter the run was given with `packageDir`, kept beside the anchor
  // (never inside it) for the package-local reads of scaffold, copyIn and templateFile.
  packageFiles?: PackageFiles;
  // A-16: the author-defined dialects the running schematic's library declares (CA-5).
  declaredDialects?: ReadonlySet<string>;
}

// ADR-04 (stdio-engine-client, REQ-RUN-06): a non-enumerable, non-configurable brand
// stamped on defineFactory's returned wrapper — arity-independent double-wrap detection
// (RUN-06.2 rejected V1's arity-sniffing: an author's bare `(o, unused) => {}` factory must
// never be misclassified). The symbol stays module-private; only the checker is exported,
// so a caller asks "is this already wrapped" without being able to forge the brand via a
// guessed string key.
const DEFINE_FACTORY_BRAND: unique symbol = Symbol("pbuilder.defineFactory.wrapped");

export function isDefineFactoryWrapped(value: unknown): boolean {
  return typeof value === "function" && Reflect.get(value, DEFINE_FACTORY_BRAND) === true;
}

export function currentContext(): SessionContext {
  return currentRun<SessionContext>();
}

// The one gate every package-local read verb (`scaffold`/`copyIn`/`create({templateFile})`)
// passes through: returns the run's sole anchor and the adapter that reads under it, or
// throws the verb's own no-resolution-anchor `invalid-input` when the run opted out of
// `packageDir`.
export function requirePackageAnchors(missingAnchorMessage: string): { packageDir: string; files: PackageFiles } {
  const { packageAnchors, packageFiles } = currentContext();
  if (packageAnchors === undefined) {
    throw invalidInput(missingAnchorMessage);
  }
  // defineFactory sets both together; an anchor without its adapter is an SDK defect, so it
  // must not read as the author forgetting `packageDir`.
  if (packageFiles === undefined) {
    throw new Error("[pbuilder] internal error: the run has a package directory but no package-files adapter");
  }
  return { packageDir: packageAnchors.packageDir, files: packageFiles };
}

// packageDir accepts a directory URL (import.meta.dir is a Bun string; import.meta.url
// is a file URL some authors may pass instead) — never a file URL pointing at a file.
function resolvePackageDir(packageDir: string | URL): string {
  return typeof packageDir === "string" ? packageDir : fileURLToPath(packageDir);
}

// The package folder a run reads, with the port that reads it. Every runtime warning and
// error names the folder relative to the working directory, never absolute.
type PackageRun = { files: PackageFiles; dir: string };

function relativeDir({ files, dir }: PackageRun): string {
  return files.relativeToCwd(dir);
}

// RBV-05.1 runtime literal (slices load-bearing literals, design §4.4): ONE literal covers
// both present-but-unparseable AND invalid-shape schemas, `<problem>` distinguishing them;
// also reused (with no locator) for non-ENOENT read failures (constraint 4) — same
// "could not be read" vocabulary, since both are "the run boundary could not establish
// what this factory's schema contract is" failures.
function malformedSchemaMessage(
  pkg: PackageRun,
  problem: string,
  line: number | undefined,
  column: number | undefined
): string {
  return `[pbuilder] factory at ${relativeDir(pkg)}: schema.json could not be read: ${problem} ${formatLocator(line, column)}`;
}

function noSchemaWarning(pkg: PackageRun): string {
  return `[pbuilder] factory at ${relativeDir(pkg)}: no schema.json found — running WITHOUT schema-derived input validation`;
}

function emptySchemaWarning(pkg: PackageRun): string {
  return `[pbuilder] factory at ${relativeDir(pkg)}: schema.json declares zero properties — no input validation performed`;
}

// Pre-`als.run` schema-conformance check (ADR-0029, REQ-RBV-01/03/05): validates BEFORE
// SessionContext is built, so a rejection throws with nothing buffered — all-or-nothing holds
// trivially and the rejection never reaches the emit seam. Bare `defineFactory(fn)` (no
// `options`) skips this entirely — the untyped opt-out (REQ-TFO-02) stays byte-for-byte
// unchanged. Read-path posture (SEC-3, constraint 4): ONLY ENOENT maps to the opt-out;
// every other read/parse failure fails closed as a plain Error — deliberately NOT an
// AuthoringError: the closed reason enum (authoring-error-contract V3) has no member for
// a corrupt/unreadable schema file, only for author-input rejections (invalid-input /
// reserved-name). A parsed-but-empty schema (zero declared properties) is distinct from no
// schema at all (REQ-RBV-05.2) — it warns and skips validation, it does not opt out.
function validateAtRunBoundary(pkg: PackageRun, input: unknown, imposed: readonly string[]): Schema | undefined {
  let raw: string | undefined;
  try {
    raw = pkg.files.readText(schemaPathFor(pkg.dir));
  } catch (err) {
    if (err instanceof PackageReadFailure) {
      throw new Error(malformedSchemaMessage(pkg, err.problem, undefined, undefined));
    }
    throw err;
  }
  if (raw === undefined) {
    console.warn(noSchemaWarning(pkg));
    return undefined;
  }

  let schema: Schema;
  try {
    schema = parseSchema(raw);
  } catch (err) {
    if (err instanceof SchemaParseFailure) {
      throw new Error(malformedSchemaMessage(pkg, err.problem, err.line, err.column));
    }
    throw err;
  }

  if (schema.properties.length === 0) {
    console.warn(emptySchemaWarning(pkg));
    return schema;
  }

  const findings = validateInput(schema, input, imposed);
  const [firstFinding] = findings;
  if (firstFinding !== undefined) {
    throw rejectionFor(firstFinding);
  }
  return schema;
}

// Reserved-lifecycle-name enforcement (S-004, ADR-0028, REQ-RLN-01/02): resolves
// reserved-name status from the factory package's OWN MODULE STRUCTURE only — never from
// resolved run-time inputs (that is REQ-RBV-01.5's territory) or from `schema.json` field
// names (REQ-RLN-01.4). Non-ENOENT scan failures fail closed, same read-path posture as
// `validateAtRunBoundary` (constraint 4).
function checkReservedNames(pkg: PackageRun): void {
  let reserved: string | undefined;
  try {
    reserved = pkg.files.findReservedSibling(pkg.dir);
  } catch (err) {
    if (!(err instanceof PackageReadFailure)) throw err;
    throw new Error(
      `[pbuilder] factory at ${relativeDir(pkg)}: could not scan for reserved lifecycle names: ${err.problem}`
    );
  }
  if (reserved !== undefined) {
    throw rejectionForReservedName(reserved);
  }
}

// A-14 / A-121 / A-124: the Result as it leaves the factory. An evaluation's Findings are checked
// again once sourced and narrowed, since the `source` it adds counts towards the ceiling (E-40).
function handOn(declared: ResultSchema | undefined, returned: unknown, source: string | undefined, inScope: InScope | undefined): unknown {
  const checked = checkResult(declared, returned);
  if ("problem" in checked) throw rejectionForResult(checked.problem);
  if (source === undefined) return checked.result;
  const handed = handedOnFindings(checked.result as { items: Array<{ [key: string]: unknown }> }, source, inScope);
  if ("problem" in handed) throw rejectionForResult(handed.problem);
  const recheck = checkResult(SOURCED_FINDINGS, handed.result);
  if ("problem" in recheck) throw rejectionForResult(recheck.problem);
  return recheck.result;
}

/** What a run of a wrapped factory receives besides its input. */
export interface RunDeps {
  client: EngineClient;
  /** The role of the schematic (CA-14), as the runner received it; only `evaluation` changes the run. */
  role?: string;
  /** The qualified name `collection:schematic` of the schematic, as the runner received it. */
  name?: string;
}

/**
 * Builds a SessionContext and runs the factory inside it, flushing buffered
 * directives at run end (REQ-KIT-05) — a write-only factory still emits.
 *
 * All-or-nothing contract (ADR-01): on success the full directive batch is committed;
 * if `fn` throws (or the run-end flush rejects), the staged set is discarded and the
 * engine commits NOTHING. The original (or attributed) error propagates to the caller —
 * a thrown factory never leaves a partial set of mutations committed.
 *
 * `options.packageDir` (pass `import.meta.dir`, never `import.meta.url`) opts a factory
 * into schema-derived run-boundary validation against its adjacent `schema.json`; a bare
 * `defineFactory(fn)` call is the untyped opt-out and runs exactly as before this option
 * existed (REQ-TFO-02).
 *
 * @internal Sanctioned callers only — `src/core/**` and
 * `src/bounded-contexts/authoring/testing/**` (enforced by `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts`).
 * Author code never imports this directly; it calls `runFactoryForTest` (test-time) or the
 * future production runner instead — both wrap this SAME seam internally.
 *
 * @param fn - the authoring logic; receives the resolved, schema-validated input and returns
 * the schematic's Result, or nothing when its `schema.json` declares none (A-14). The Result
 * is checked against that declaration before the flush; the runner resolves to the committed
 * copy. A bare `defineFactory(fn)` declares no Result, so `fn` must return nothing.
 * @param options.packageFiles - the package-files adapter the two reads go through; every
 * caller passes it with `packageDir`.
 * @param options.packageDir - opts into schema-derived input validation and reserved-name
 * enforcement (both structural checks against this package's `schema.json`/sibling files).
 * Pass `import.meta.dir` (a directory) — NOT `import.meta.url` (a file URL; a common
 * misuse). Two opt-out tiers: omit `options` entirely for the untyped, unvalidated escape
 * hatch (REQ-TFO-02); pass `{ packageDir }` with no adjacent `schema.json` to opt into the
 * flow loudly-schemaless (a warning fires on every run, REQ-RBV-03).
 *
 * @remarks
 * A factory package must never declare a sibling module named `pre-execute` or
 * `post-execute` (file or directory form, case-insensitive) — these are reserved lifecycle
 * names for future SDK use and are rejected at this boundary (the `reserved-lifecycle-names`
 * domain). `add`/`remove` are NOT reserved by this check (collection-level naming, deferred
 * to a future L2 scope).
 *
 * @example
 * // 1. Generate the typed Input from schema.json:
 * //      pbuilder-codegen <package-dir>
 * import type { Input } from "./schema.generated.ts";
 *
 * // 2. Internal: wrap a bare author fn into a client-driven runner:
 * const bareFactory = (input: Input) => {
 *   create("server.config.ts", {
 *     template: "export const port = {= .port =};",
 *     options: { port: input.port },
 *   });
 * };
 *
 * const runner = defineFactory<Input>(bareFactory, { packageDir: import.meta.dir });
 * await runner(input, { client });
 *
 * The returned runner takes, besides the client, the `role` and the qualified `name` of the
 * schematic it runs, as the caller received them (CA-19). With the role `evaluation`, `fn`
 * returns its Findings, checked against the shape the role imposes, each finding's `source` is
 * set to `name`, and `fn` receives the scope inputs `include` and `exclude`; every `glob` result
 * is narrowed to the scope and so is every finding with a path (A-120 to A-124). Any other role,
 * or none, runs as a generator.
 */
export function defineFactory<O, R = void>(
  fn: (o: O) => R | Promise<R>,
  options?: ({ packageDir: string | URL; packageFiles: PackageFiles } | { packageDir?: undefined; packageFiles?: undefined }) & {
    declaredDialects?: readonly string[];
  }
): (o: O, deps: RunDeps) => Promise<R> {
  const wrapped = async (o: O, { client, role, name }: RunDeps): Promise<R> => {
    if (role === "evaluation" && name === undefined) {
      throw new Error("defineFactory: an evaluation factory needs the qualified name collection:schematic of the schematic");
    }
    const source = role === "evaluation" ? name : undefined;
    let packageAnchors: SessionContext["packageAnchors"];
    let packageFiles: SessionContext["packageFiles"];
    let schema: Schema | undefined;
    let inScope: InScope | undefined;
    if (source !== undefined) {
      const scope = scopeOf(o);
      if ("problem" in scope) throw rejectionForScopeInput(scope.problem);
      inScope = scope.inScope;
    }
    if (options?.packageDir !== undefined) {
      const pkg: PackageRun = { files: options.packageFiles, dir: resolvePackageDir(options.packageDir) };
      // REQ-RBV-06: exactly TWO reads, in this order — reserved-name check, then schema
      // validation. No third (containment-ceiling) read exists (ADR-0077 §C).
      checkReservedNames(pkg);
      schema = validateAtRunBoundary(pkg, o, source === undefined ? [] : SCOPE_INPUTS);
      packageAnchors = { packageDir: pkg.dir };
      packageFiles = pkg.files;
    }
    const ctx: SessionContext = {
      session: new Session(client, inScope),
      factory: new DirectiveFactory(),
      dialects: new DialectRegistryImpl(),
      packageAnchors,
      packageFiles,
      declaredDialects: new Set(options?.declaredDialects),
    };
    // ADR-01: no `finally` — success (commit) and failure (discard) are distinct paths.
    // The final flush is INSIDE the try, so a flush-time emit rejection (already an
    // AuthoringError via Session.flush) skips commit() and routes to discard + re-throw.
    //
    // ADR-0037: the dialect-handle drain runs BETWEEN `als.run` and `session.flush()` — an
    // unawaited dialect chain (forgotten `await`) still completes and commits; a drain
    // rejection (an unawaited chain that threw) routes through the SAME catch below as a
    // flush rejection already does.
    //
    // A-14: the Result is checked after the drain and before the final flush, so an invalid
    // one takes the discard path below and nothing is written. A bare factory, or one with no `result` in its schema,
    // declares none and must return nothing; the commit then carries no Result.
    try {
      const returned = await getSessionAls<SessionContext>().run(ctx, () => fn(o));
      await ctx.dialects.drain();
      const result = handOn(source === undefined ? schema?.result : SOURCED_FINDINGS, returned, source, inScope);
      await ctx.session.flush();
      await ctx.session.commit(result);
      return result as R;
    } catch (thrown) {
      // A thrown `undefined` or `null` would read as success to anyone testing the error.
      const err = thrown ?? new Error(`the factory threw ${String(thrown)}`);
      // REQ-10: double-fault preservation. A discard() rejection (E2) must never replace
      // or swallow the factory's original error (E1) — attach it as cause and re-throw E1.
      try {
        await ctx.session.discard();
      } catch (discardErr) {
        // Never clobber a pre-existing cause chain on E1, and never let a frozen/sealed
        // E1 throw on assignment replace E1 itself — either way E1 must survive unchanged.
        if (err instanceof Error && err.cause === undefined) {
          try {
            err.cause = discardErr;
          } catch {
            // E1 rejected the assignment (frozen/sealed) — propagate E1 unchanged.
          }
        }
      }
      throw err;
    }
  };
  Object.defineProperty(wrapped, DEFINE_FACTORY_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return wrapped;
}
