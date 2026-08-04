// ADR-0081: bundler-output disjointness verdicts, resolution-based — never string
// normalisation. `normaliseForComparison` (the retired mechanism) decided collisions by ad
// hoc string manipulation (leading-`./`-strip, trailing-`/`-strip); five spellings escaped
// it, probe-confirmed: `.//dist/transport` (double-slash defeats the leading-`./`-strip),
// `.` (total-root targeting the length-1 trailing-slash-strip skip missed), `-odist/...`
// (the short flag concatenated with no separator — never parsed at all), `../dist/...`
// (a relative-parent escape never resolved), `--outdir=$VAR` (undecidable at build time,
// silently treated as an ordinary string target).
//
// Every candidate flag token is resolved with `node:path`'s own `posix.resolve` against a
// FIXED virtual anchor (`/`) — pure path algebra, no real filesystem access, deterministic
// regardless of cwd. Using an arbitrary-but-consistent anchor is sound: containment between
// two paths resolved against the SAME anchor is anchor-invariant. Every candidate reading of
// an ambiguous token is tried (short-flag concatenated vs space-separated, long-flag `=`
// vs space-separated); a token shaped like an output-directing flag but not one of the
// three recognised spellings, or a recognised flag whose value is not decidable under the
// committed safe-path grammar below (including no value at all), is `unclassifiable` —
// never silently skipped, never silently passed.
import { posix } from "node:path";

export type BundlerFlag = "--outfile" | "--outdir" | "-o";

export interface BundlerTarget {
  readonly script: string;
  readonly flag: BundlerFlag;
  readonly target: string;
}

export interface UnclassifiableBundlerConstruct {
  readonly script: string;
  readonly token: string;
}

export interface DisjointnessViolation {
  readonly script: string;
  readonly target: string;
  readonly colliding: string;
}

const RECOGNISED_LONG: readonly BundlerFlag[] = ["--outdir", "--outfile"];

/**
 * The committed safe-path grammar (ADR-0081): the characters a build-time-decidable output path
 * is made of. Decidability is a WHITELIST, never a search for known-bad markers — testing for
 * `$` caught exactly two spellings (`$VAR`, `$(…)`) and read backticks, `${…}`, globs, `~`,
 * shell operators, quoting and embedded whitespace as literal paths, checking them as such.
 * A false positive fails a build; a false negative voids the closure-sealing lemma.
 */
const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;

/** A recognised flag's value is a target only if the grammar can decide it; absent counts too. */
function readValue(flag: BundlerFlag, value: string | undefined, token: string, consumed: number): TokenReading {
  if (value === undefined) return { kind: "undecidable", token, consumed: 1 };
  if (!SAFE_PATH.test(value)) return { kind: "undecidable", token: consumed === 2 ? `${token} ${value}` : token, consumed };
  return { kind: "target", flag, value, token, consumed };
}

interface TokenReading {
  readonly kind: "target" | "undecidable" | "unclassifiable-shape";
  readonly flag?: BundlerFlag;
  readonly value?: string;
  readonly token: string;
  readonly consumed: number;
}

/**
 * Classifies ONE token (plus, for a space-separated form, the token after it) at `index`.
 * Total over the grammar it recognises: every candidate reading (concatenated short-flag,
 * `=`-form long-flag, space-separated form) is tried in turn; an output-flag-SHAPED token
 * (`-o`-prefixed or `--out`-prefixed) that matches none of the recognised spellings falls
 * through to `unclassifiable-shape` rather than being silently ignored. A token with no
 * output-directing shape at all (`--minify`, a bare path segment, …) returns `undefined` —
 * REQ-PTH-01 verifies bundler-output disjointness, not general script-token classification.
 */
function classifyToken(tokens: readonly string[], index: number): TokenReading | undefined {
  const token = tokens[index] as string;

  for (const flag of RECOGNISED_LONG) {
    if (token === flag) return readValue(flag, tokens[index + 1], token, 2);
    if (token.startsWith(`${flag}=`)) return readValue(flag, token.slice(flag.length + 1), token, 1);
  }

  if (token === "-o") return readValue("-o", tokens[index + 1], token, 2);
  if (token.startsWith("-o") && token.length > 2) return readValue("-o", token.slice(2), token, 1);

  // Output-flag-SHAPED but not one of the three recognised spellings above — e.g.
  // `--out-dir`. Never confused with an ordinary non-output flag: those don't start with
  // `--out` or `-o` at all, and are correctly left unclassified (returns undefined below).
  if (token.startsWith("--out") && !RECOGNISED_LONG.includes(token as BundlerFlag)) {
    return { kind: "unclassifiable-shape", token, consumed: 1 };
  }

  return undefined;
}

function tokenize(command: string): string[] {
  return command.split(/\s+/).filter((token) => token.length > 0);
}

interface ClassifiedBundlerConstructs {
  readonly targets: BundlerTarget[];
  readonly unclassifiable: UnclassifiableBundlerConstruct[];
}

/** ONE tokenize/classify walk producing both target and unclassifiable-construct lists. */
function classifyBundlerConstructs(scripts: Record<string, string>): ClassifiedBundlerConstructs {
  const targets: BundlerTarget[] = [];
  const unclassifiable: UnclassifiableBundlerConstruct[] = [];
  for (const [script, command] of Object.entries(scripts)) {
    const tokens = tokenize(command);
    for (let index = 0; index < tokens.length; index += 1) {
      const reading = classifyToken(tokens, index);
      if (reading?.kind === "target") {
        // No quote-stripping: a quoted value is outside the safe-path grammar and never reaches
        // here as a target.
        targets.push({ script, flag: reading.flag as BundlerFlag, target: reading.value as string });
      } else if (reading?.kind === "undecidable" || reading?.kind === "unclassifiable-shape") {
        unclassifiable.push({ script, token: reading.token });
      }
    }
  }
  return { targets, unclassifiable };
}

/** Every RECOGNISED (`--outfile`/`--outdir`/`-o`) target, decidable value only. */
export function findBundlerTargets(scripts: Record<string, string>): BundlerTarget[] {
  return classifyBundlerConstructs(scripts).targets;
}

/**
 * REQ-PTH-01.5/.7: a recognised flag's undecidable value, or an output-flag-shaped token
 * that names no recognised spelling. Both are `unclassifiable-construct` — never a pass.
 */
export function findUnclassifiableBundlerConstructs(
  scripts: Record<string, string>
): UnclassifiableBundlerConstruct[] {
  return classifyBundlerConstructs(scripts).unclassifiable;
}

/** Resolution-based verdict: BOTH sides resolved against the same fixed virtual anchor. */
function resolveAgainstAnchor(path: string): string {
  return posix.resolve("/", path);
}

function collides(flag: BundlerFlag, resolvedTarget: string, resolvedClosurePath: string): boolean {
  if (flag !== "--outdir") {
    // -o / --outfile write a SINGLE file: exact path match only.
    return resolvedClosurePath === resolvedTarget;
  }
  const prefix = resolvedTarget.endsWith("/") ? resolvedTarget : `${resolvedTarget}/`;
  return resolvedClosurePath === resolvedTarget || resolvedClosurePath.startsWith(prefix);
}

/** A bundler aimed at the runner rewrites the module graph the baseline pins. */
export function findDisjointnessViolations(
  targets: readonly BundlerTarget[],
  closurePaths: readonly string[]
): DisjointnessViolation[] {
  const violations: DisjointnessViolation[] = [];
  for (const { script, flag, target } of targets) {
    const resolvedTarget = resolveAgainstAnchor(target);
    for (const closurePath of closurePaths) {
      const resolvedClosurePath = resolveAgainstAnchor(closurePath);
      if (collides(flag, resolvedTarget, resolvedClosurePath)) {
        violations.push({ script, target, colliding: closurePath });
      }
    }
  }
  return violations;
}
