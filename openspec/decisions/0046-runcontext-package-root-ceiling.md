# ADR-0046: `RunContext.packageRoot` — eager ceiling seeding at the run boundary

- Status: Proposed
- Date: 2026-07-12
- Deciders: Daniel (Hyperxq)
- Origin: change `schematic-local-files` (design rev 1).
- Builds on: ADR-0011 (ambient run-context; `dialects` field seeded once at run boundary —
  the pattern this mirrors), ADR-0029 (pre-`als.run` validation chokepoint).

## Context

The scaffold module needs TWO distinct anchors (obs #915 ruling 12, REQ-PRC-01): the
**resolution anchor** (`packageDir`, where a relative `from` resolves) and the
**containment ceiling** (the nearest `collection.json` ancestor, the boundary nothing may
escape). The ceiling must be derived ONCE per run, never re-walked per source
(REQ-PRC-02), and a missing `collection.json` ancestor must fail loud (REQ-PRC-03) BEFORE
the factory body runs (REQ-RBV-06.1's killable pre-body ordering observable).

## Decision

`RunContext` gains two fields, seeded once in `defineFactory` at the existing pre-`als.run`
chokepoint (alongside `checkReservedNames`/`validateAtRunBoundary`), mirroring the
`dialects` seeding pattern:

```ts
interface RunContext { session; factory; dialects;
  packageDir: string | undefined;    // resolution anchor
  packageRoot: string | undefined;   // containment ceiling (collection.json dir)
}
```

When `options.packageDir` is present, `defineFactory` walks ancestors for
`collection.json` EAGERLY (pre-`als.run`); found → `packageRoot`; absent → throw
`invalid-input` (REQ-AEC-12) fail-loud, pre-body. Bare `defineFactory(fn)` (no
`packageDir`) seeds both `undefined` and is unchanged (the untyped opt-out).

## Consequences

- (+) One ceiling walk per run, satisfying REQ-PRC-02 and REQ-RBV-06's "same chokepoint,
  not a separate read site."
- (+) `packageRoot`/`packageDir` are never conflated — the scaffold module reads both by
  name.
- (−) **Contract tightening (migration):** every `{ packageDir }` factory now REQUIRES a
  `collection.json` ancestor (REQ-RBV-06 states there is no opt-out for containment, unlike
  the no-schema opt-out). Rev 2 (A2) — the affected run sites are BOTH static fixtures
  (`test/fixtures/typed-factory/`, `test/fixtures/harness-opted-in/`) AND runtime
  temp-dir suites that fabricate their own trees, which no shared repo marker can cover:
  `test/security/canary-no-echo.test.ts` (`mkdtempSync`),
  `test/skeleton/run-boundary-validation.test.ts`,
  `test/skeleton/reserved-lifecycle-names.test.ts`, `test/fake/harness-opted-in.test.ts`,
  `test/fake/harness-in-memory-invariant.test.ts`,
  `test/fitness/fit-12-schema-parity.test.ts`, `test/fitness/fit-16-reserved-name-scan.test.ts`
  — each temp-tree setup helper seeds a `collection.json` marker. Real schematic packages
  already ship one, so real usage is unaffected; but this is a behavior change to
  `defineFactory`, not purely additive.

## Alternatives Considered

- **Lazy resolution at first `scaffold`/`copyIn` call** — REJECTED: REQ-RBV-06.1's fixture
  is bare `{ packageDir }` whose body's FIRST statement throws a sentinel and demands the
  missing-ancestor rejection win; lazy resolution surfaces the sentinel instead. No
  lazy/opt-in scheme satisfies pre-body ordering.
- **An explicit `{ scaffold: true }` opt-in flag to avoid tightening** — REJECTED for now:
  REQ-RBV-06.1 uses no such flag. Flagged for owner: if tightening is unacceptable, the
  REQ must be re-specced (route: spec).
