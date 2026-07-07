# ADR-0028: Reserved lifecycle names — kebab filename convention, runtime package-dir scan

- Status: DRAFT (Proposed; promoted at stage-4-typed-options archive)
- Date: 2026-07-06
- Change: `stage-4-typed-options`
- Un-gates: REQ-RLN-01 Scenario .1 (design-gated declaration mechanism)

## Context

`pre-execute`/`post-execute` are reserved schematic-level lifecycle names inherited verbatim from the
2026-07-06 engine handoff (a cross-repo contract; the Go CLI expects these exact kebab strings — they
stay kebab, not `preExecute`). Enforcement must observe the factory package's OWN module structure:
`defineFactory` historically receives only `fn` (arch-F3). REQ-RLN-02 requires the rejection to be a
runtime `AuthoringError` whose full error surface REQ-RBV-04 scans — so a pure build-time fitness scan
(no error object) cannot satisfy the contract. Candidates: a string-keyed hooks object export, or a
filename convention. A bare camelCase export is excluded (breaks the kebab token identity).

## Decision

A factory declares a lifecycle hook by a **kebab-case sibling file** in its package directory:
`pre-execute.ts` / `post-execute.ts` (matching the repo's established kebab-filename convention).

**Hybrid enforcement (SEC-2 — ADOPTED).** Two complementary planes:
1. **Runtime throw** — at the run boundary (pre-`als.run`), `defineFactory` given `options.packageDir`
   (ADR-0031) scans the directory (one `readdirSync`) and, on a reserved match, throws `AuthoringError`
   with `reason: "reserved-name"` (reason value gated on Stage-2; see ADR-0029). This is the surface
   REQ-RLN-02/REQ-RBV-04 need (`.stack`/structured fields).
2. **Build-time structural scan (FIT-16)** — an always-on fitness scan walks discoverable factory
   packages for a reserved sibling regardless of whether `packageDir` was threaded, closing the
   opt-in fail-open hole; it also flags a package that ships `schema.json` but calls `defineFactory`
   without `packageDir` (the 3rd signal, SEC-2c). Deliberate negative fixtures are allowlisted.

**Filename-matching semantics (TW-M2, pinned).** Matching is **case-insensitive** (defeating
`Pre-Execute.ts` evasion on case-insensitive filesystems, vs. the case-exact Go engine): the sibling
basename is lowercased, its extension stripped, and compared for exact membership in the reserved set
`{pre-execute, post-execute}` (accepted extensions `{.ts, .js}`). The **directory form** is also
caught: a sibling DIRECTORY whose basename matches a reserved token (e.g. `pre-execute/index.ts`) is a
reserved declaration too. Enforcement reads the file layout ONLY: never `schema.json` field names
(REQ-RLN-01.4), resolved-input keys (REQ-RBV-01.5), nor arbitrary exports like `remove` (REQ-RLN-03.2).
`add`/`remove` are NOT reserved here (L2).

**Read-path posture (SEC-3).** The runtime `readdirSync` distinguishes error classes: `ENOENT`
(directory absent) is not reachable when `packageDir` is a real dir; any `EACCES`/`EPERM`/`EISDIR`
FAILS CLOSED as an `AuthoringError` (interim shape) — an unreadable package dir is never silently
treated as "no reserved files". Unreadable-dir fixtures cover it.

## Consequences

- Rejection is a runtime `AuthoringError` — satisfies REQ-RLN-02, the AEC-09 template, and RBV-04's
  uniform error-surface scan; unifies with schema validation at one pre-`als.run` site.
- Reuses the `packageDir` already threaded for schema discovery — near-zero added surface, no new author-facing "hooks" concept.
- Cost: a factory that never passes `packageDir` is unscanned (acknowledged opt-out, consistent with the
  orphan-schema known limitation in REQ-RBV-05); enforcement is filesystem-based, not exhaustive.

## Alternatives Considered

- **String-keyed hooks object passed to `defineFactory`**: viable and runtime-inspectable, but adds a new
  author-facing API concept and object-literal parsing fragility; the filename form maps directly to
  "file layout" and the repo's kebab convention with no new surface.
- **Build-time static/fitness scan ONLY**: REJECTED as the sole mechanism — cannot produce the runtime
  `AuthoringError`/`.stack` surface REQ-RLN-02 + REQ-RBV-04 require. (Its structural coverage is kept as
  the FIT-16 half of the hybrid below.)
- **Runtime throw ONLY (`packageDir`-gated), no build-time scan** (rev-1 design): REJECTED — fail-open
  whenever the author omits `packageDir`; the always-on structural guarantee is worth one fitness test.
- **Build-time fitness scan + runtime throw HYBRID**: ACCEPTED (SEC-2) — the runtime throw supplies the
  error surface, FIT-16 supplies the `packageDir`-independent structural guarantee; the two cover each
  other's gap.
