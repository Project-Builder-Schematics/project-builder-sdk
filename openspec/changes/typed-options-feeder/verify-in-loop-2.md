# Verify In-Loop Result

**Change**: typed-options-feeder
**Iteration**: 2/3
**Scope**: S-001+S-002
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

## Execution Evidence (verbatim)

### Scoped test run

```
$ bun test test/core/encode-options.test.ts test/commons/encode-surface-parity.test.ts test/skeleton/error-attribution.test.ts test/fake/harness-result.test.ts test/fake/harness-leak-scan.test.ts
bun test v1.3.11 (af24e281)

test/commons/encode-surface-parity.test.ts:
[pbuilder] factory at ../../../../../tmp/encode-surface-parity-ZXmX12: no schema.json found — running WITHOUT schema-derived input validation

 63 pass
 0 fail
 163 expect() calls
Ran 63 tests across 5 files. [172.00ms]
```

### Full suite

```
$ bun test
...
 1884 pass
 0 fail
 4020 expect() calls
Ran 1884 tests across 183 files. [44.52s]
```
(Baseline per apply-progress.md was 1884 pass after S-002; matches exactly — 0 regressions. Net delta over S-000's 1863: +21 tests across S-001 [+11] and S-002 [+10 net, after 3 reconciled pre-existing tests kept the same count while their trigger changed].)

### Typecheck

```
$ bun run typecheck
$ tsc --noEmit
```
Clean, no output, exit 0.

## REQ Conformance Table (S-001+S-002 scope)

| Requirement / scenario | Test | Assertion match | Result |
|---|---|---|---|
| TOE-01.3 nested-ride | `encode-options.test.ts::[characterization] ...01.3` | `{methods:[{tags:["x","y"]}]}` → `'[{"tags":["x","y"]}]'`, single-call nested-ride | met |
| TOE-01.4 mixed order | `...01.4` | key order `b,a,c` preserved + encode/passthrough split | met |
| TOE-01.5 null-proto encodes | `...01.5` | `Object.create(null)` w/ `{a:1,b:2}` → `'{"a":1,"b":2}'` | met |
| TOE-01.6 empty composites | `...01.6` | `[]`→`"[]"`, `{}`→`"{}"`, not skipped | met |
| TOE-01.7 empty options no-op | `...01.7` | `{}` → `{}` | met |
| TOE-01.8 options absent | `encode-surface-parity.test.ts` (via `scaffold()`) | schedules successfully, `create.options` = `{}` | met (see Deviation (a) below) |
| TOE-02.1 pre-stringified passthrough | `...02.1` | byte-identical, `toEqual(options)` | met |
| TOE-02.2 `[`/`{`-prefixed string passthrough | `...02.2` | byte-identical, `toEqual(options)` | met |
| TOE-03.1 number/boolean passthrough | `...03.1` | `{count:3,active:true}` unchanged | met |
| TOE-03.2 null never `"null"` | `...03.2` | `result.note` `toBeNull()` | met |
| TOE-05.1 `__proto__` own key | `...05.1` | own enumerable key present, `Object.prototype` unaffected | met |
| TOE-04.1 top-level `undefined` rejects | `...04.1` | message names `"userMethods"`, `undefined at userMethods`, allowed-set echo | met |
| TOE-04.2 nested `undefined` rejects | `...04.2` | message: `undefined at methods[0].tag` | met |
| TOE-04.3 function/symbol/BigInt reject | `...04.3` | 3 cases, each names key+kind; BigInt message asserted NOT to contain raw "Do not know how to serialize a BigInt" | met |
| TOE-04.4 true cycle rejects loud | `...04.4` | message: `a circular reference at self.self`; asserted NOT to contain raw "Converting circular structure to JSON" | met |
| TOE-04 shared-ref DAG encodes (non-false-positive) | `describe("REQ-TOE-01 (shared-ref DAG...")` | same object at 2 sibling keys → both encode to `'{"x":1}'`, not rejected | met |
| TOE-04.5 Date rejects | `...04.5` | message: `Date at when` | met |
| TOE-04.6 Map rejects | `...04.6` | message: `Map at methodRegistry`, never silent `'{}'` | met |
| TOE-04.7 class instance rejects | `...04.7` | message: `a class instance at userProfile` | met |
| TOE-04.8 nested function/symbol reject | `...04.8` | `function at methods[0].handler`, `symbol at userTags[0]` | met |
| TOE-04 (integration) rejection at scheduling | `encode-surface-parity.test.ts` | `caught instanceof Error`, `not instanceof AuthoringError`, message verbatim, nothing staged (`committedTree`/`stagingTree` size 0) | met |
| REQ-14.3 reconcile | `error-attribution.test.ts` | fixture `{ratio:0/0}`, `reason==="unrepresentable-content"`, verb/path undefined, appliedCount 0 — unchanged assertion values | met |

Message template verified verbatim against design §4.3's pinned contract, including the trailing allowed-set echo (`"Options must be strings, numbers, booleans, null, arrays, or plain objects."`) on every reject test.

## Mutation Spot-Check (mechanics)

| Check | Evidence | Result |
|---|---|---|
| Thrown error is a plain `Error`, never `AuthoringError` | `rejectOption` (`directive-factory.ts:78-83`) does `throw new Error(...)`; `encode-surface-parity.test.ts` explicitly asserts `not.toBeInstanceOf(AuthoringError)` | confirmed |
| Never raw serializer `TypeError` text | Tests assert `.not.toContain("Do not know how to serialize a BigInt")` and `.not.toContain("Converting circular structure to JSON")` | confirmed |
| `assertEncodable` deletes ancestor on ascent | `directive-factory.ts:109-119` — `ancestors.add(value)` before recursion, `finally { ancestors.delete(value) }` around both array/object branches (scoped per top-level call via default param) | confirmed by code read |

## Deviation Adjudication

| # | Deviation | Adjudication | Reasoning |
|---|---|---|---|
| (a) | TOE-01.8 tested via `scaffold()` instead of `create()` | **benign** | Verified by reading types: `src/commons/index.ts:39` — `CreateOptions.options: JsonValue` is a REQUIRED field on every `create()` overload; TypeScript does not admit omission, and a forced `as unknown as CreateOptions` cast to omit it produces `{options: undefined}` which fails at FLUSH time for an unrelated reason (`ContractFake`'s round-trip fidelity guard rejects a key holding `undefined`) — not the scheduling-scoped "schedules successfully" TOE-01.8 pins. `src/scaffold/expander.ts:48` — `ScaffoldOptions.options?: JsonValue` is genuinely optional, and `expander.ts:158/174` (`args.options ?? {}`) defaults the omitted field to `{}` before it ever reaches `encodeOptions`. `scaffold()` is therefore a real, type-checked, author-reachable "no options argument at all" call, and a faithful witness of the scenario. `test/commons/encode-surface-parity.test.ts:20-36` confirms: `scaffold({from:"files", to:"out"})` with no `options` key, asserting `result.error` is `undefined` and the emitted `create.options` equals `{}`. |
| (b) | 2 extra files reconciled outside the pinned File Map: `test/fake/harness-result.test.ts` (REQ-ATH-09.1), `test/fake/harness-leak-scan.test.ts` (REQ-ATH-12.1's `unrepresentable-content` case) | **benign** | Both hit the IDENTICAL ADR-03-documented shadow §4.2d already approved for REQ-14.3 (a function-valued create option now rejects at scheduling, never reaching the flush-time `unrepresentable-content` guard) — same mechanism, same fix pattern (function trigger → `{ratio: 0/0}`), same unchanged assertion values (`result.error instanceof AuthoringError`, `reason === "unrepresentable-content"`, plus `scanForLeaks` returning `[]` in the leak-scan file). Read both blocks directly: `harness-result.test.ts:224-239` and `harness-leak-scan.test.ts:121-133` — only the trigger input changed, every assertion is byte-identical to its pre-reconcile form. Sweep re-run: `rg "fn: \(\) =>" test/` finds exactly ONE remaining match — `test/fitness/fit-05-serializable-bytes.test.ts:94` — which constructs a raw `Directive` wire literal `satisfies Directive` fed directly to `isSerializable()`, never through `create()`/`encodeOptions` (confirmed by reading the block: it's a `[red-proof]` test of `isSerializable` itself, no factory/commons call in the path). NOT shadowed, correctly left untouched, confirmed still green in the full-suite run above. Sweep claim holds — no further `fn: () => {}` victims reaching `encodeOptions`. |

## Scope Check

`git diff --stat` against the working tree confirms only: `src/core/directive-factory.ts`, `test/core/encode-options.test.ts`, `test/fake/harness-leak-scan.test.ts`, `test/fake/harness-result.test.ts`, `test/skeleton/error-attribution.test.ts` (all modified), plus `test/commons/encode-surface-parity.test.ts` (untracked/new) and the two artefact files (`apply-progress.md`, `slices.md`). No `classify-transport.ts`, no `createOp`/`directive-builders.ts`, no `dry-run/plan.ts`, no `docs/create-templates.md`, no `fit-39` file — S-003 territory is untouched. Clean.

## Followup Note

The `AuthoringError`-parity followup (registered at design time, ADR-03 Consequence) now has a WIDER surface than originally scoped: 3 shadowed call sites confirmed (REQ-14.3, REQ-ATH-09.1, REQ-ATH-12.1), not 1. When that followup is picked up, all 3 files' assertions will need to move from `toBeInstanceOf(AuthoringError)` (flush-time) to whatever the eventual scheduling-time structured error type becomes. This does not block this batch's PASS — flagging for the record per apply-progress.md's own Risks note.

Orchestrator action: exit loop, proceed to S-003 build per Build Order (requires S-001 + S-002, both now satisfied).
