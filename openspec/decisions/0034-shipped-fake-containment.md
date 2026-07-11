# ADR-0034: `./testing` containment strategy (six structural guards)

- Status: Accepted
- Date: 2026-07-11
- Change: `stage-4b-testing-harness` (S-003)
- Builds on: ADR-0033 (third audience `author-testing`), ADR-0035 (fake relocation)

## Context

Relocating the normative fake into shipped `src/` (ADR-0035) raises the stakes: test-only
machinery must never reach a production bundle, and the guards keyed to the fake's old
`test/support/` path must transition to the new `src/testing/` location without widening
into carve-outs that would reopen the boundary they exist to protect.

## Decision

Containment is structural and fail-closed across six guards:

1. **FIT-17** dev-only bundle guard (new) — minified `bun build` output of `.`, `./commons`,
   and `./conformance` asserts `CONTRACT_FAKE_PREFIX` ABSENT, and (mandatory positive
   control) PRESENT in the `./testing` bundle. The literal is IMPORTED from
   `rejection-messages.ts`'s `CONTRACT_FAKE_PREFIX` export, never re-hardcoded, so this
   guard and FIT-11's leak dictionary cannot silently drift apart.
2. **FIT-08** per-path allowlist + wildcard-re-export ban by form (modified) — replaces the
   single flat `KIT_SYMBOL_NAMES` ban with a per-scanned-path `{valueAllow, typeAllow}`
   model; `./testing` gets a narrow allowlist (`defineFactory`/`runFactoryForTest` value,
   `Batch`/`Directive` type-only), `ContractFake` stays banned there in both forms. Any
   `export *`/`export * as ns` on any scanned path is a violation BY FORM, with the single
   specifier-exact grandfathered exemption `src/index.ts` → `./commons/index.ts` (its
   pre-existing legitimate umbrella re-export).
3. **FIT-10** single-path allow-list transition (modified, S-000) — `test/support/…` →
   `src/testing/contract-fake.ts`, exactly one path, never a directory-level exemption; the
   facade `src/testing/index.ts` is explicitly excluded from the allow-list.
4. **FIT-07** glob PINNED to `src/core/**` (modified, comment de-staled this slice) — never
   widened to `src/testing/**`: the relocated fake's own `#tree: Map<string, string>` field
   is its legitimate job, and widening the scan would wrongly flag it as an ADR-0008
   violation.
5. **FIT-04** dts baseline granularity = entry-only `dist/testing/index.d.ts` (modified) —
   chosen over a whole-`dist/testing/**` alternative, which is REJECTED because it would
   monitor non-public fake internals (unshipped-as-surface, like today's `dist/core/**`) and
   churn baselines on every internal fake refactor, while entry-only still catches removal of
   every public export line (`defineFactory`, `runFactoryForTest`, `Batch`, `Directive`).
6. **dts negative declaration-scan** (new companion assert on FIT-04's testing row) —
   `dist/testing/index.d.ts` MUST NOT match `\b(EngineClient|EmitRejection)\b`. FIT-10 scans
   sources only and FIT-04 above is removal-only, so declaration emit could resurface a
   port-internal name that neither guard alone would catch. Housed on FIT-04's testing row
   because that file already reads `dist/testing/index.d.ts` via the shared `ensureTscBuild()`
   build; FIT-17 scans minified JS, not `.d.ts` output.

## Consequences

- (+) Every containment surface is fail-closed and drift-proof by construction — no guard
  depends on a convention holding, only on a structural check.
- (−) FIT-17 adds four per-entry minified builds to suite cost, mitigated by the shared
  `ensureMinifiedEntry` build fixture (`test/support/shared-build.ts`, memoized per entry).
- (→) Together the six guards prove the fake ships reachable ONLY via `./testing` — never
  bundled into a production entry, never resolvable from a non-allowlisted export, and never
  silently resurfacing a port-internal name through declaration emit.

## Alternatives Considered

- **Conditional (fail-open) `exports` routing as the containment mechanism** — rejected:
  fail-open by construction; FIT-17's red-proof (a fixture bundle still carrying the literal
  behind a conditional-exports branch) demonstrates the scan must read actual bundle OUTPUT
  content, not the `exports` map's declared routing, precisely because a conditional branch
  can still ship the fake into a production entry undetected by a routing-only check.
- **Directory-level FIT-10 exemption (`src/testing/**`)** — rejected: reopens the port-bleed
  hole a single-path allow-list closes; a bleed planted anywhere else under `src/testing/**`
  (e.g. a hypothetical `src/testing/helpers.ts`) would go uncaught.
