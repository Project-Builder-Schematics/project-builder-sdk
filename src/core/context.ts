// KIT-05: Ambient RunContext via AsyncLocalStorage.
// defineFactory returns a runner that builds the context and runs fn inside the ALS.
// The EngineClient is injected by the caller (test passes the fake) — no module global.

import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, dirname, join } from "node:path";
import type { EngineClient } from "./engine-client.ts";
import { DirectiveFactory } from "./directive-factory.ts";
import { Session } from "./session.ts";
import { AuthoringError, invalidInput } from "./authoring-error.ts";
import { schemaPathFor, findReservedSibling } from "./schema/schema-discovery.ts";
import { parseSchema, SchemaParseFailure, formatLocator } from "./schema/schema-parse.ts";
import { validateInput } from "./schema/schema-validate.ts";
import { rejectionFor, rejectionForReservedName } from "./schema/input-rejection.ts";
import { isErrnoException } from "./fs-errors.ts";

// ADR-0037: the run-boundary join registry. A dialect handle self-registers here at its
// first op; `defineFactory` drains it (awaits every registered `settle()`) BEFORE
// `session.flush()`, so an unawaited dialect chain still completes and commits, and an
// unawaited THROWING chain rejects the run contained instead of leaking an
// `unhandledRejection`. Kept generic over "anything with a settle()" — this module has no
// knowledge of dialect-handle.ts internals (dialect-handle.ts imports FROM context.ts, not
// the other way around).
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

export interface RunContext {
  session: Session;
  factory: DirectiveFactory;
  dialects: DialectRegistry;
  // F2 poison flag (ADR-0037 amendment): run-scoped, first-wins, set by dialect-handle.ts's
  // step wrapper on the FIRST rejection and consulted at every subsequent step/read() entry
  // so a chained op on a DIFFERENT handle is never attempted as a fresh operation
  // (REQ-DG-07.3) — not merely left uncommitted. Never serialized, never crosses the wire.
  // Plain field, no reverse import: context.ts still imports NOTHING from
  // dialect-handle.ts (F2 fitness-guarded) — dialect-handle.ts reaches this via
  // currentContext().
  runFailure?: { reason: unknown };
  // ADR-0046: seeded ONCE, eagerly, at the pre-`als.run` chokepoint below — never
  // re-derived per scaffold/copyIn call within the same run (REQ-PRC-02). Absent for the
  // bare `defineFactory(fn)` untyped opt-out (byte-for-byte unchanged behavior); when
  // present, BOTH anchors are set (the chokepoint resolves them together or throws before
  // either exists). `packageDir` (RESOLUTION anchor) and `packageRoot` (CONTAINMENT
  // ceiling, the nearest `collection.json` ancestor of `packageDir`) are DISTINCT anchors
  // (REQ-PRC-01) — never conflate them when `src/scaffold/` consumes this context.
  packageAnchors?: { packageDir: string; packageRoot: string };
}

const als = new AsyncLocalStorage<RunContext>();

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

// REQ-AEC-02.1 (2.4): a verb called outside any defineFactory run is SDK-side misuse,
// independent of any engine round-trip — an AuthoringError{authoring-rejected,outside-run},
// not a plain Error. The prose lives in authoring-error.ts's outside-run message template
// (the third template, REQ-AEC-06); this is the one call site that reaches it.
export function currentContext(): RunContext {
  const ctx = als.getStore();
  if (ctx === undefined) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "outside-run",
      appliedCount: 0,
    });
  }
  return ctx;
}

// The one gate every package-local read verb (`scaffold`/`copyIn`/`create({templateFile})`)
// passes through: returns the run's two-anchor pair or throws the verb's own
// no-resolution-anchor `invalid-input` when the run opted out of `packageDir`.
export function requirePackageAnchors(missingAnchorMessage: string): { packageDir: string; packageRoot: string } {
  const { packageAnchors } = currentContext();
  if (packageAnchors === undefined) {
    throw invalidInput(missingAnchorMessage);
  }
  return packageAnchors;
}

// packageDir accepts a directory URL (import.meta.dir is a Bun string; import.meta.url
// is a file URL some authors may pass instead) — never a file URL pointing at a file.
function resolvePackageDir(packageDir: string | URL): string {
  return typeof packageDir === "string" ? packageDir : fileURLToPath(packageDir);
}

// `<dir>` token (all runtime warning/error literals, Executor Context pin): project-root-
// relative, never absolute — tests run from the repo root, so this is deterministic and
// leaks no absolute path.
function relativeDir(packageDir: string): string {
  return relative(process.cwd(), packageDir);
}

function missingPackageRootMessage(packageDir: string): string {
  return (
    `invalid input: no collection.json found at or above ${relativeDir(packageDir)} — ` +
    "cannot resolve the containment root for this factory's package"
  );
}

// REQ-PRC-02/REQ-PRC-03 (ADR-0046): the CONTAINMENT ceiling — the nearest `collection.json`
// ANCESTOR of `packageDir` (itself included), walked upward from `packageDir` to the
// filesystem root. `collection.json` is a PRESENCE-ONLY marker (never parsed, never read as
// JSON — charter L2 keeps the manifest out of scope). No ancestor found → fail loud
// `invalid-input` (REQ-PRC-03.1) BEFORE any source file is read; the ONLY caller is the
// pre-`als.run` chokepoint below, so this resolves exactly once per run (REQ-PRC-02.1) —
// scaffold/copyIn never re-walk it themselves, they read the already-resolved
// `RunContext.packageRoot`.
function resolvePackageRoot(packageDir: string): string {
  let dir = packageDir;
  for (;;) {
    if (existsSync(join(dir, "collection.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new AuthoringError({
        verb: undefined,
        path: undefined,
        reason: "invalid-input",
        appliedCount: 0,
        message: missingPackageRootMessage(packageDir),
      });
    }
    dir = parent;
  }
}

// Author-vocabulary description of a non-ENOENT read failure — never the raw errno
// message (no-echo). ENOENT is handled by its own opt-out branch and never reaches this.
function describeReadFailure(err: unknown): string {
  if (isErrnoException(err)) {
    if (err.code === "EACCES" || err.code === "EPERM") return "permission denied";
    if (err.code === "EISDIR") return "is a directory, not a file";
  }
  return "unreadable";
}

// RBV-05.1 runtime literal (slices load-bearing literals, design §4.4): ONE literal covers
// both present-but-unparseable AND invalid-shape schemas, `<problem>` distinguishing them;
// also reused (with no locator) for non-ENOENT read failures (constraint 4) — same
// "could not be read" vocabulary, since both are "the run boundary could not establish
// what this factory's schema contract is" failures.
function malformedSchemaMessage(
  packageDir: string,
  problem: string,
  line: number | undefined,
  column: number | undefined
): string {
  return `[pbuilder] factory at ${relativeDir(packageDir)}: schema.json could not be read: ${problem} ${formatLocator(line, column)}`;
}

function noSchemaWarning(packageDir: string): string {
  return `[pbuilder] factory at ${relativeDir(packageDir)}: no schema.json found — running WITHOUT schema-derived input validation`;
}

function emptySchemaWarning(packageDir: string): string {
  return `[pbuilder] factory at ${relativeDir(packageDir)}: schema.json declares zero properties — no input validation performed`;
}

// Pre-`als.run` schema-conformance check (ADR-0029, REQ-RBV-01/03/05): validates BEFORE
// RunContext is built, so a rejection throws with nothing buffered — all-or-nothing holds
// trivially and the rejection never reaches the emit seam. Bare `defineFactory(fn)` (no
// `options`) skips this entirely — the untyped opt-out (REQ-TFO-02) stays byte-for-byte
// unchanged. Read-path posture (SEC-3, constraint 4): ONLY ENOENT maps to the opt-out;
// every other read/parse failure fails closed as a plain Error — deliberately NOT an
// AuthoringError: the closed reason enum (authoring-error-contract V3) has no member for
// a corrupt/unreadable schema file, only for author-input rejections (invalid-input /
// reserved-name). A parsed-but-empty schema (zero declared properties) is distinct from no
// schema at all (REQ-RBV-05.2) — it warns and skips validation, it does not opt out.
function validateAtRunBoundary(packageDir: string, input: unknown): void {
  const schemaPath = schemaPathFor(packageDir);
  let raw: string;
  try {
    raw = readFileSync(schemaPath, "utf-8");
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      console.warn(noSchemaWarning(packageDir));
      return;
    }
    throw new Error(malformedSchemaMessage(packageDir, describeReadFailure(err), undefined, undefined));
  }

  let schema: ReturnType<typeof parseSchema>;
  try {
    schema = parseSchema(raw);
  } catch (err) {
    if (err instanceof SchemaParseFailure) {
      throw new Error(malformedSchemaMessage(packageDir, err.problem, err.line, err.column));
    }
    throw err;
  }

  if (schema.properties.length === 0) {
    console.warn(emptySchemaWarning(packageDir));
    return;
  }

  const findings = validateInput(schema, input);
  const [firstFinding] = findings;
  if (firstFinding !== undefined) {
    throw rejectionFor(firstFinding);
  }
}

// Reserved-lifecycle-name enforcement (S-004, ADR-0028, REQ-RLN-01/02): resolves
// reserved-name status from the factory package's OWN MODULE STRUCTURE only — never from
// resolved run-time inputs (that is REQ-RBV-01.5's territory) or from `schema.json` field
// names (REQ-RLN-01.4). Non-ENOENT scan failures fail closed, same read-path posture as
// `validateAtRunBoundary` (constraint 4).
function checkReservedNames(packageDir: string): void {
  let reserved: string | undefined;
  try {
    reserved = findReservedSibling(packageDir);
  } catch (err) {
    throw new Error(
      `[pbuilder] factory at ${relativeDir(packageDir)}: could not scan for reserved lifecycle names: ${describeReadFailure(err)}`
    );
  }
  if (reserved !== undefined) {
    throw rejectionForReservedName(reserved);
  }
}

/**
 * Builds a run-context and runs the factory inside it, flushing buffered
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
 * @internal Sanctioned callers only — `src/core/**`, `src/testing/**`, and
 * `src/conformance/**` (enforced by `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts`).
 * Author code never imports this directly; it calls `runFactoryForTest` (test-time) or the
 * future production runner instead — both wrap this SAME seam internally.
 *
 * @param fn - the authoring logic; receives the resolved, schema-validated input.
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
 *     template: "export const port = {{port}};",
 *     options: { port: input.port },
 *   });
 * };
 *
 * const runner = defineFactory<Input>(bareFactory, { packageDir: import.meta.dir });
 * await runner(input, { client });
 */
export function defineFactory<O>(
  fn: (o: O) => void | Promise<void>,
  options?: { packageDir?: string | URL }
): (o: O, deps: { client: EngineClient }) => Promise<void> {
  const wrapped = async (o: O, { client }: { client: EngineClient }): Promise<void> => {
    let packageAnchors: RunContext["packageAnchors"];
    if (options?.packageDir !== undefined) {
      const resolvedDir = resolvePackageDir(options.packageDir);
      checkReservedNames(resolvedDir);
      validateAtRunBoundary(resolvedDir, o);
      // ADR-0046 / REQ-RBV-06: the containment-ceiling walk shares the SAME pre-`als.run`
      // chokepoint as schema/reserved-name validation, not a separate, uncoordinated read
      // site — a missing ancestor fails closed here, before `fn` ever runs (REQ-RBV-06.1).
      packageAnchors = { packageDir: resolvedDir, packageRoot: resolvePackageRoot(resolvedDir) };
    }
    const ctx: RunContext = {
      session: new Session(client),
      factory: new DirectiveFactory(),
      dialects: new DialectRegistryImpl(),
      packageAnchors,
    };
    // ADR-01: no `finally` — success (commit) and failure (discard) are distinct paths.
    // The final flush is INSIDE the try, so a flush-time emit rejection (already an
    // AuthoringError via Session.flush) skips commit() and routes to discard + re-throw.
    //
    // ADR-0037: the dialect-handle drain runs BETWEEN `als.run` and `session.flush()` — an
    // unawaited dialect chain (forgotten `await`) still completes and commits; a drain
    // rejection (an unawaited chain that threw) routes through the SAME catch below as a
    // flush rejection already does.
    try {
      await als.run(ctx, () => fn(o));
      await ctx.dialects.drain();
      await ctx.session.flush();
      await ctx.session.commit();
    } catch (err) {
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
