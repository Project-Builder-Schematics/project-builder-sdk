# ADR-0081: Path Verdicts Are Resolution-Based; Tripwire Predicates Live in `scripts/`

**Status**: Accepted · **Date**: 2026-07-29 · **Change**: `runner-tripwire-invariants`

## Context

`normaliseForComparison` decided bundler-output disjointness by string manipulation
(leading-`./`-strip, trailing-`/`-strip); five spellings escaped it, probe-confirmed:
`--outdir .//dist/transport` (a double slash defeats the leading-`./`-strip), `--outdir .`
(total-root targeting, missed by the length-1 trailing-slash-strip skip), `-odist/…` (the short
flag concatenated with no separator — never parsed at all), `--outdir ../<pkg>/dist/…` (a
relative-parent escape never resolved), and `--outdir=$VAR` (undecidable at build time, silently
treated as an ordinary string target).

Separately, the disjointness predicate lived in `test/support/` while every other tripwire
predicate lives in `scripts/`, so "which branch is the default?" could not be answered by reading
one directory.

## Decision

1. **Verdicts are resolution-based.** Both the closure path and the candidate bundler target are
   `resolve()`d against the same fixed virtual anchor and judged by resolved-prefix containment —
   never by string normalisation. Every candidate reading of an ambiguous flag token is tried,
   including the `-o` short form. An undecidable target (`$VAR`, **command substitution**) is an
   explicit `unclassifiable-construct` violation, never a pass.
2. **The predicate moves to `scripts/bundler-disjointness.ts`**, with
   `test/support/closure-integrity-checks.ts` as a consumer that re-exports it.

Decidability is decided by a **committed safe-path grammar** — a value is a target only if it
matches it — rather than by searching for known-bad markers. Testing for a marker (`$`) closes the
spellings enumerated at the time and leaves the class open: backticks, `${…}`, globs, `~`, shell
operators, quoting, embedded whitespace and an absent value all read as literal paths under a
marker test. A whitelist is the only form of the rule that fails closed on a spelling nobody
thought of.

## Consequences

- Verdicts become spelling-invariant, so closing a spelling stops being the unit of work.
- Over-approximation is the safe direction: **a false positive fails a build; a false negative
  voids the closure-sealing lemma.** A rejected-but-innocent path costs one build and one commit;
  an accepted-but-escaping path silently un-seals everything the manifest claims to cover.
- **(2) is PLACEMENT, NOT TIMING — this is explicitly NOT a reversal of accepted ADR-0075.**
  Constraint 1 continues to ship as a structural CI check (`fit-42`), never as a loader-observed
  build tripwire. Moving the predicate's source file changes who *hosts* it, not when it *runs*;
  the BUILD/CI/ENGINE authority split is untouched. This sentence is the guard rail: any later
  reading of the `test/support/` → `scripts/` relocation as a timing change contradicts this ADR.
- The new cross-boundary edge (`test/support/` → `scripts/`) does not trip FIT-27, whose
  non-reachability rule names `scripts/regen-corpus.ts` specifically and is corpus-scoped.

## Alternatives Considered

- **Add the five escaping spellings to the normaliser**: rejected — it is the "add another
  spelling" move this change exists to end, and success criterion 11 fails on it by definition.
- **Full shell-grammar parse of `package.json#scripts`**: rejected as disproportionate. The
  consequence is accepted explicitly: a quoted target with embedded whitespace
  (`--outdir "my dir/dist"`) is `unclassifiable` rather than resolved, which is the safe
  direction. M3.6 script-chaining is registered OUT with reason rather than silently absorbed.
- **Leave the predicate in `test/support/`**: rejected — one home for tripwire predicates is what
  makes "which branch is the default?" answerable by reading one directory.
