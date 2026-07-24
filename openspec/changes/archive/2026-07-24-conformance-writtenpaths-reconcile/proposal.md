# Proposal + Spec (merged): conformance-writtenpaths-reconcile

**Triage**: M · **Store**: hybrid · **spec_source**: internal (no upstream publish, no plan-verify gate) · **spec_status**: draft (awaiting owner signature)

## Intent

Reconcile the SDK conformance corpus's `writtenPaths` semantics with the engine's shipped
`mutation-event-streaming` contract change. The engine's `Result.WrittenPaths` now names **every
workspace-relative path touched by a committed mutation across all six op classes**
(`create`/`modify`/`rename`/`delete`/`copyIn`/`copy`), deduplicated and sorted — a superset of the
old "engine-materialized (schematic-lowered `create`) paths only" rule the corpus still encodes.
Result: the engine conformance suite is red (`m2-create-composition/positive`) and spec REQ-CFX-12's
rule text now contradicts its own pinned values.

Source: issue `Project-Builder-Schematics/project-builder-sdk#47`, engine `#153` (PC-CONF-08). This
is the second real-engine-contact finding after `context-singleton-fix` — the expected CQ-3 loop.

## Scope

**In**
- Rewrite spec `REQ-CFX-12` (rule text + scenarios REQ-CFX-12.1/.2 + pinned-value enumeration) to the
  new committed-mutation-set contract.
- Update spec `REQ-CFX-09` hardcoded pin (table + scenario REQ-CFX-09.1).
- Bump `outcome.writtenPaths` in four fixtures' **positive** cases: `m2-create-composition`,
  `m2-modify`, `m2-delete`, `m2-rename-move`.
- Update the four `fit-40` hardcoded positive-case assertions.
- Reconcile quoted pins in docs (`CONFORMANCE-CORPUS-HANDOFF.md`, `conformance/README.md`).

**Out**
- Any engine-side change (the engine is correct per its spec).
- Adding/removing fixtures or changing corpus structure.
- SDK author-verb behavior (`remove`/`rename`/`replaceContent`/`create`).
- Negative-twin cases — all keep `writtenPaths: []` (rejected/discarded runs commit nothing).
- `m1-vehicle` — its pin `["out.txt"]` is already correct under the new rule (unchanged).

## Approach

Pin to the engine's **actual, code-grounded** output (confirmed by the engine team 2026-07-24, with
mechanistic justification — not inference), not to our reasoning. A fail-closed byte-exact corpus
must assert what the engine really emits.

Authoritative new pins:

| Positive case | Old | New | Engine justification |
|---|---|---|---|
| `m1-vehicle` | `["out.txt"]` | `["out.txt"]` (unchanged) | schematic `create` `out.txt` + factory `modify` of same `out.txt` → dedup to one entry |
| `m2-modify` | `[]` | `["target.txt"]` | committed `modify` lists its target |
| `m2-delete` | `[]` | `["target.txt"]` | committed `delete` lists the **removed** path (contract = committed set, not "bytes written") |
| `m2-rename-move` | `[]` | `["dst.txt"]` | one journal entry, `Op.Path` = **destination only**; source is a moved-away tombstone, `PlanOf` skips it (`plan.go:115`), never journaled |
| `m2-create-composition` | `["generated.txt"]` | `["existing.txt","generated.txt"]` | schematic `create` `generated.txt` + factory `modify` `existing.txt`, sorted |

Because REQ-CFX-06/07/08 (m2-modify/delete/rename) delegate their pin to REQ-CFX-12
("`writtenPaths` pin: REQ-CFX-12") rather than hardcoding a value, rewriting REQ-CFX-12's
enumeration fixes all three in one place. Only REQ-CFX-09 hardcodes the old value inline.

**Coverage note (engine-confirmed)**: only `m2-create-composition` is red today because of *test
coverage*, not semantics — engine-side only `mutation_create_test.go` asserts `WrittenPaths`;
the modify/delete/rename tests declare `writtenPaths: []` and assert nothing on the field. The
contract already hit all three; no test looks (the gap engine `#153` tracks). Reconciling all four
now is therefore correct **and** forward-looking.

## Requirements (spec delta)

The full MODIFIED requirement blocks live in `specs/conformance-fixtures/spec.md`. Summary:
- **REQ-CFX-12** — retitled "Committed-Mutation Set (all six op classes)"; rule rewritten; per-op
  semantics added; pinned enumeration updated to the 5 values above; scenarios .1 (same-path
  create+modify dedup) and .2 (wire-mutation cases pin their committed target path) rewritten.
- **REQ-CFX-09** — positive-case pin `["generated.txt"]` → `["existing.txt","generated.txt"]`
  (table + scenario REQ-CFX-09.1).

## Build-time file changes (contract with /build — the actual edits, deferred to /build)

| File | Edit |
|---|---|
| `conformance/m2-create-composition/manifest.json` | positive `writtenPaths` `["generated.txt"]` → `["existing.txt","generated.txt"]` |
| `conformance/m2-modify/manifest.json` | positive `writtenPaths` `[]` → `["target.txt"]` |
| `conformance/m2-delete/manifest.json` | positive `writtenPaths` `[]` → `["target.txt"]` |
| `conformance/m2-rename-move/manifest.json` | positive `writtenPaths` `[]` → `["dst.txt"]` |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | 4 positive-case assertions: m2-modify→`["target.txt"]`, m2-delete→`["target.txt"]`, m2-rename-move→`["dst.txt"]`, m2-create-composition→`["existing.txt","generated.txt"]` (locate by fixture, robust to line drift) |
| `openspec/specs/conformance-fixtures/spec.md` | REQ-CFX-12 + REQ-CFX-09 (synced from the delta on archive) |
| `CONFORMANCE-CORPUS-HANDOFF.md`, `conformance/README.md` | update any quoted pins |

**Slicing** (M, one cohesive slice): S-000 — the spec delta + 4 manifests + 4 fit-40 assertions +
doc reconciliation, verified by `bun test` (fit-40 green). No walking-skeleton split needed: the
change is a coordinated pin update with a single fitness gate. Strict TDD: fit-40 IS the failing
test to make green (its assertions move first, then the manifests satisfy them).

## Risks

- **Rename destination-only semantics** is the sharpest pin. Mitigation: engine confirmed it
  mechanistically (tombstone + `plan.go:115`); the definitive proof is the engine closing its
  `#153` coverage gap and advancing the pin — non-blocking, expected.
- **Doc drift** — quoted pins in handoff/README are easy to miss. Mitigation: grep `writtenPaths`
  repo-wide during build.

## Rollback

Single logical revert (git). No data, no migration, no runtime behavior — test-data + spec only.

## Success Criteria

- `bun test` green, `fit-40` asserting the 5 new pins.
- REQ-CFX-12 rule text internally consistent with its pins (no self-contradiction).
- On the engine advancing its SDK submodule pin and running the corpus:
  `TestConformance_M2CreateComposition/positive` (and, once `#153` coverage lands,
  modify/delete/rename) turn green.
