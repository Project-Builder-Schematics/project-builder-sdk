# ADR-0050: Honest write-verb rename on the frozen `Handle` type

- Status: Accepted
- Date: 2026-07-14
- Change: `author-write-surface` (S-000)
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0010 (op-pack composition), ADR-0037 (coalescing seam), ADR-0039 (fail-loud
  rejection of incoherent operations)

## Context

`.modify(content)` names wholesale replacement dishonestly — it reads like a targeted edit but
overwrites the file's entire text. `.raw(fn)` exists only because the honest name (`modify`) was
already taken by the wholesale-replace verb. `Handle` is the ONE type `architecture.md` marks
FROZEN. Pre-1.0 (publish `--dry-run`, no external consumers) is the last clean-break window with
no deprecation machinery — the cost of this rename only grows once the SDK ships to real
consumers.

## Decision

Unfreeze `Handle`, rename `modify(content)` → `replaceContent(content)` and `raw(fn)` →
`modify(fn)` as two DISTINCT, non-overloaded methods, re-freeze via a NEW 10th FIT-04 pair
`core.define-dialect.d.ts` (the only baseline whose text exhibits `Handle`'s members — the 9
existing pairs don't). Reserve-both: `RESERVED_HANDLE_NAMES` keeps `raw` blocked (muscle-memory
guardrail against authors reaching for the retired name) and adds `replaceContent`, becoming an
exported, ordered 9-member array (`then/read/raw/modify/replaceContent/rename/move/copy/remove`).

**ORCHESTRATOR RULING R2**: `RESERVED_HANDLE_NAMES` is exported `@internal` for
test/conformance observability only (so `test/core/define-dialect-collision.test.ts` and
`test/dialects/typescript/ops-exact-set.test.ts` can import it instead of hand-typing a second
literal) — it is NOT a supported public API member, not semver-covered beyond the FIT-04
baseline pin it already sits inside.

## Consequences

(+) author vocabulary is honest — a name promises what it does. (+) the load-bearing breaking
edit is now gated behind an explicit ADR, not a silent deviation. (−) ~20 call-site files break
at once across the change's slices (mitigated by per-module slicing: S-000 → S-001 → S-002 →
S-003 → S-004). (−) a type `architecture.md` deliberately marks FROZEN is unfrozen — justified
by the pre-1.0 clean-break window closing forever once external consumers exist. (enables) a
future public dialect-kit plan inherits an honest surface from day one.

## Alternatives considered

**Keep `raw`** — perpetuates the dishonest `.modify(content)`/`.raw(fn)` pair; no honesty gain.
**Name it `edit`** — a third verb for a concept already owned by `modify`; adds vocabulary
without removing the dishonesty. **Name it `transform`** — implies a pure return-value
transformation, but the function mutates the AST in place; misleading in the opposite direction.
**Polymorphic `modify(string | fn)`** — runtime type-sniffing, ambiguous error messages on
misuse, and forfeits the fn-only/string-only compile-time pins the spec mandates (REQ-DG-03.3 /
REQ-MC-08.6).
