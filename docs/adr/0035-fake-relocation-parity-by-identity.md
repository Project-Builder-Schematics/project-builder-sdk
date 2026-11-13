# ADR-0035: Fake relocation + parity-by-identity

- Status: Accepted
- Date: 2026-07-11
- Change: `stage-4b-testing-harness` (S-000)
- Builds on: ADR-0033 (third audience `author-testing`)

## Context

`defineFactory` and the normative `ContractFake` are unreachable from an installed
`@pbuilder/sdk` package — the fake lives under `test/support/`, which `tsconfig.build.json`
(`rootDir:"./src"`, `exclude:["test"]`) forbids the shipped build from importing. To surface
a harness, the fake must live in `src/`. But ~25 test files plus FIT-11 (whole-object leak
scan) import it from `test/support/contract-fake.ts` and `test/support/rejection-messages.ts`
today, and a second, independently-maintained fake would silently drift from the normative
one — the exact failure mode a "normative fake" promise exists to prevent.

## Decision

`git mv` both `contract-fake.ts` and `rejection-messages.ts` into `src/testing/`. Leave BOTH
old `test/support/` paths as **pure re-export shims** — no re-declared logic, only
`export { ... } from "../../src/testing/<file>.ts"`. Parity between "the fake authors reach
through `./testing`" and "the fake every existing test already trusts" is enforced by
**reference identity** (`===` on the exported `ContractFake` class; value equality on the
`rejection-messages.ts` constants) — never a behavioural parity suite. A fitness test
(FIT-18, S-002) fails closed if either shim regresses into a re-declared body instead of a
re-export.

`rejection-messages.ts` resolution is SHIM, not repoint: every existing importer (FIT-11
included) keeps its `test/support/rejection-messages.ts` specifier unchanged, uniform with
the fake's own relocation pattern, rather than mixing repoint-some/shim-others.

## Consequences

- (+) One physical fake, zero importer churn (all ~25 existing test files keep their
  `../support/contract-fake.ts` import specifier unchanged), drift impossible by
  construction (shims cannot silently diverge without failing FIT-18's identity check).
- (−) The fake now compiles under production-strict `tsconfig.build.json` flags and its
  `.d.ts` ships — a real new tarball surface (mitigated by the FIT-17 dev-only bundle guard,
  ADR-0034, which asserts the fake's text is absent from every non-`./testing` production
  entry).
- (→) The harness (`runFactoryForTest`, S-001) reuses the EXACT fake every existing test
  already trusts — no second implementation to keep honest.

## Alternatives Considered

- **Behavioural parity suite** (assert both fakes behave identically across scenarios) —
  rejected: two independent implementations can pass a behavioural suite while drifting on
  an untested edge case; reference identity cannot be spoofed by construction.
- **Keep the fake in `test/` and widen the build's `rootDir`** — rejected: fights the
  `rootDir:"./src"`/`exclude:["test"]` invariant every FIT-04/FIT-09 dist assertion is keyed
  to, and would pull the entire `test/` tree into the production build's scope.
