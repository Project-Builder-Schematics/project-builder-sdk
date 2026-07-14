# Proposal: Author write surface — honest write-verb rename (replaceContent / modify(fn))

**Triage**: L · **Persona lens**: none (Council: architect, pm, ba, qa, security, tech-writer)

## Intent

Schematic authors face a dishonest write API. `.modify(content)` promises "modify" but wholesale-replaces the file's text, and `.raw(fn)` exists only because the honest name (`modify`) was taken. On a pre-1.0 POC (`@pbuilder/sdk`, 0.x, publish still `--dry-run`) this is the last cheap window for a clean-break rename with no deprecation machinery: rename the string-replace verb to `.replaceContent(content)`, free the honest `modify` name, and give it to the AST escape hatch as `.modify(fn)`. The wire IR is untouched — this fixes the author vocabulary, not the engine contract.

## Scope

### In Scope
- Rename `.modify(content)`→`.replaceContent(content)` on all handles AND the commons frozen top-level verb `modify(path,content)`→`replaceContent(path,content)`.
- `.raw(fn)` removed; absorbed by `.modify(fn: (ast)=>void)` — chained on dialect handles + importable `modify(handle, fn)` shipped from `@pbuilder/sdk/typescript` (never commons, never the deferred kit).
- Distinct methods, no runtime polymorphism: `.modify` is fn-only, `.replaceContent` string-only.
- `RESERVED_HANDLE_NAMES` reserve-both: `raw` stays blocked (guardrail) + `replaceContent` added.
- Migrate the ADR-0039 reject-while-pending guard onto `.replaceContent`; prove it ABSENT from `.modify(fn)`.
- Migrate `./conformance`'s published `ConformanceCase.chain` `{raw}` step + dispatch in lockstep.
- Unfreeze the `Handle` type (explicit ADR); regenerate FIT-04 dts-baselines + add a 10th pair (`core/define-dialect.d.ts`).
- Update tests, ADR-0039 (amend in place), SECURITY.md, `docs/authoring-a-dialect.md`.

### Out of Scope
- Wire IR (`{op:"modify"}` stays byte-identical); `AuthoringVerb`/`DryRunVerb` labels (KEEP `"modify"` — see Approach).
- No deprecation aliases (clean break). Engine/CLI untouched. Coalescing/mutation-gate/lazy-print unchanged.
- DEFERRED: public dialect-kit subpath / ADR-0009 revisit; `hasImport`/query helpers; standalone op-function exports.

## Capabilities (contract with sdd-spec)

### New Capabilities
- None (importable `modify(handle,fn)` is an addition WITHIN `typescript-dialect`, not a new domain).

### Modified Capabilities
- `foundations-skeleton`: frozen author verb `modify(path,content)`→`replaceContent`; base `WriteOps`.
- `dialect-generics`: REQ-DG-03 `.raw(fn)`→`.modify(fn)`; Handle/DialectWriteOps unfreeze; reserve-both names; +FIT-04 10th DTS pair.
- `modify-coalescing`: dialect `.modify(content)`→`.replaceContent`; `runModify`→`runReplaceContent` keeps ADR-0039 guard, guard absent from `.modify(fn)`.
- `typescript-dialect`: `./typescript` `.raw`→`.modify(fn)`; adds importable `modify(handle,fn)` export.
- `dialect-conformance`: chain `{raw}` step→`{modify}` union + dispatch; discriminant-misroute RED test.
- `dialect-authoring-standards`: SECURITY.md 3 frozen threat sentences + `authoring-a-dialect.md` + foreign-wrap tail literal migrate to `.modify(fn)`.
- `authoring-error-contract`: PIN `AuthoringVerb`/`DryRunVerb` KEEP `"modify"` (deliberate).

## Approach

Mechanical clean-break rename following the repo's kit-internal-amendment precedent (explore Approach 1; the shape was ratified #2109/#2114 — no alternative naming to re-litigate). `sdd-design` must formalise three ADRs: (1) **Handle-type unfreeze** — the one type `architecture.md` calls FROZEN; (2) **modify-polymorphism** — distinct method names over an overloaded `modify`, rejected alternatives "keep raw" / "name it edit"; (3) **ADR-0039 amendment in place** (guard verb renamed, per ADR-0037/0012 precedent). Owner decision #1 pins the KEEP: every author write lowers to the same `{op:"modify"}` directive, so `AuthoringVerb`/`DryRunVerb` label the WIRE mutation — "modify" is honest at that altitude; a failed `.replaceContent()` still reports `verb:"modify"`, pinned deliberately so a future refactor cannot "fix" it. Slice per module (rename+call-sites+docs together) to avoid a half-migrated CI-red state. Fold in passing: the FIT-04 regen doc omits 2 churning baselines. Coordinate merge order with the paused `ts-dialect-backend-ops` (same files). pending-changes row-136 (already resolved by ADR-0039) closes at archive — no new decision.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/base-handle.ts` | Modified | `WriteOps.modify`→`replaceContent` |
| `src/commons/index.ts` | Modified | 3 call sites + frozen top-level `modify()`→`replaceContent()` |
| `src/core/define-dialect.ts` | Modified | Handle/DialectWriteOps unfreeze; `RESERVED_HANDLE_NAMES` reserve-both |
| `src/core/dialect-handle.ts` | Modified | `runModify`→`runReplaceContent` (keeps ADR-0039 guard); `runRaw`→ new `runModify(fn)` |
| `src/dialects/typescript/index.ts` | Modified | `.raw` JSDoc; new importable `modify(handle,fn)` export |
| `src/dialects/typescript/ops.ts` | Modified | JSDoc `.raw()` collision-text ref |
| `src/conformance/index.ts` | Modified | chain `{raw}`→`{modify}` union + dispatch |
| `test/fitness/dts-baseline/*` | Modified/New | 9 pairs regen + new 10th `core/define-dialect.d.ts` pair |
| `openspec/decisions/0039-*.md` | Modified | guard target rename, amend in place |
| `SECURITY.md`, `docs/authoring-a-dialect.md` | Modified | 3 frozen threat sentences + author doc on new name |
| ~20 test files (dialect-handle, define-dialect-collision, e2e, planted, types) | Modified | call-site rename + presence pins (incl. 4 byte-exact foreign-wrap tail) |
| `src/core/authoring-error.ts`, dry-run | Read-only | `AuthoringVerb` KEEPS `"modify"` — no churn (owner decision #1) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| FIT-04 gap: 9 existing pairs don't show Handle's shape → rename passes the semver gate undetected | Medium | Add 10th DTS pair `core/define-dialect.d.ts` (explore-verified live) |
| ADR-0039 guard silently attaches to new `.modify(fn)` → silent data loss | Medium | Negative test proves guard ABSENT from `.modify(fn)`; RED silent-data-loss scenario |
| Conformance `{raw}` not migrated in lockstep → tests validate the wrong verb | Medium | Migrate `{raw}`→`{modify}` + discriminant-misroute RED test, same slice |
| Handle type is FROZEN → silent unfreeze | Medium | Explicit unfreeze + modify-polymorphism ADRs (design-gated) |
| Merge conflict with paused `ts-dialect-backend-ops` (same files) | Medium | Coordinate merge order; sequence after its rebase |
| Clean break breaks all callers at once (~20+ files) | High | Slice per module (rename+call-sites+docs); no half-migrated state |
| Third-party op-pack named `raw` breaks | Low | Pre-1.0, none exist; reserve-both keeps `raw` a guardrail |

## Rollback Plan

Pre-1.0 POC: nothing published (publish is `--dry-run`), no consumer data, no migrations, wire IR untouched. Rollback = revert the change branch before it merges to `main`; the prior `.modify(content)`/`.raw(fn)` API is fully restored by the revert (clean break has no forward-compatible residue to leave). Validate: full `bun test` + fitness suite green on the reverted tree AND FIT-04 `dts-baseline` snapshots byte-match their pre-change state. No irrecoverable data — the change is source-only.

## Dependencies

- None external. Sequencing (not a hard dependency): coordinate merge order with the paused `ts-dialect-backend-ops` change (edits the same `typescript/{ops,index}.ts` + `conformance/index.ts`).

## Success Criteria

- [ ] `rg '\.raw\('` over `src/` returns 0; `RESERVED_HANDLE_NAMES` = `[then,read,raw,modify,replaceContent,rename,move,copy,remove]` (raw reserved, replaceContent added).
- [ ] `.replaceContent(content)` on all handles + commons `replaceContent(path,content)`; `.modify` fn-only, `.replaceContent` string-only (distinct methods, no runtime polymorphism).
- [ ] Importable `modify(handle,fn)` exported from `@pbuilder/sdk/typescript` only (absent from commons + kit).
- [ ] A Given/When/Then pins failed `.replaceContent()` reports `verb:"modify"` WITH documented rationale.
- [ ] ADR-0039 guard on `.replaceContent` only; a negative test proves it ABSENT from `.modify(fn)` (silent data-loss scenario RED then guarded).
- [ ] Conformance chain `{raw}`→`{modify}`; a discriminant-misroute RED test exists.
- [ ] FIT-04 `DTS_PAIRS` gains a 10th pair (`core/define-dialect.d.ts`); all baselines regenerated; full suite + 276+ fitness green.
- [ ] 4 byte-exact foreign-wrap tail pins read `modify() on "…" threw`; SECURITY.md's 3 threat-model sentences renamed.
