# Spec: typed-options-and-read (#2 of l1-author-surface)

**Spec version**: V1 · **Status**: **signed** (orchestrator, 2026-06-22) · **Triage**: L
**Store**: hybrid · **Spec source**: internal

## Capabilities (delta specs)
| Capability | File | REQs | Kind |
|---|---|---|---|
| Typed Create — full options derivation | `specs/typed-create-skeleton/spec.md` | REQ-01 (modified), REQ-03 (added) | delta over typed-create-skeleton V1 |
| Read From Disk — trichotomy | `specs/read-from-disk/spec.md` | REQ-RD-01, REQ-RD-02, REQ-RD-03 | new capability |

## REQ-ID stability
- `REQ-01` keeps its ID — its scenarios 01.1/01.2/01.3 are preserved verbatim and 01.4–01.7 are appended
  (non-destructive MODIFIED; the destructive-sync check passes: ≥ base scenario count).
- `REQ-02` (Runtime Behaviour Unchanged, V1) is untouched and not part of this delta.
- `REQ-03` is a new ADDED requirement under the typed-create capability (negative-proof CI verifiability).
- `REQ-RD-01/02/03` are new IDs under the new read-from-disk capability — no collision with skeleton IDs.

## Frozen contract (the L1 semver surface this spec locks)
- `create<S>(path, opts: { template; options: OptionsOf<S>; force? }): WritableHandle` — signature shape
  unchanged from skeleton; `OptionsOf<S>` derivation grows (required/optional/type/excess), kept internal.
- `find(path).read(): Promise<string | undefined>` — content / not-found→`undefined` / empty→`""`.
- Untyped `create(path, { options: JsonValue })` overload preserved (backward compat).

## Acceptance summary (what "done" means)
Positive + negative type proofs for `OptionsOf<S>` (multi-field, optional-omittable, missing-required,
wrong-type, excess); the read trichotomy proven through the contract fake (content/undefined/""/whitespace/
falsy-strings/branchable); not-found returns `undefined` without throwing; FIT-04 dts baseline regenerated to
the new frozen read signature; the negative options proof CI-verifiable (regression flips red); FIT-01
(commons-no-AST) stays green; #1's union suite stays green (integration-gate regression fence).

## Out of scope (carried from proposal/explore)
Typed-error attribution & commit/discard (#3); read-staged / read-your-own-writes (engine §6, #3);
full dry-run renderer + frame-cap + tarball (#4); standalone `read(path)` export; schema-descriptor projection.

## Sign-off
Scope crisp, all product decisions resolved with the user (Framing A; `undefined` sentinel; handle-only read;
CI fold-in; `OptionsOf<S>` internal). No spec-ambiguity halts. **Signed — ready for design.**
