# North Star — ts-addimport-collision (foresight checkpoint)

**Checkpoint**: foresight (post-design, forward-looking)
**Change**: `ts-addimport-collision` · **Triage**: L (sensitivity override — `security (code execution): high`)
**Spec**: V3.1 signed · **Design**: rev V2, council-applied · **Verdict**: aligned
**Store**: filesystem fallback (engram unavailable this session)

## The problem we hold (verbatim north star)

> Who hurts — any schematic author using the SHIPPED TS dialect's `addImport` on files
> with type-only/default/namespace/aliased imports or same-named local declarations. What
> pain — silently broken emitted code: type-only merge → runtime ReferenceError;
> cross-module/value-namespace collision → SyntaxError at consumer parse; aliased import →
> silent no-op. Why now — the CLAIMED model was just built and proven for the React dialect
> (spec V8, judgment-day APPROVED, archived 2026-07-17); the fix is cheapest while fresh,
> and `src/dialects/typescript/**` is registered security-sensitive.

## 1. This is what we're going to do (in outcome terms)

Turn a code generator that TODAY emits silently-broken TypeScript into one that either
produces correct output or fails LOUDLY and immediately at the author's `addImport(name,
from)` call — never handing the author invalid code that breaks far away, at their
consumer's compile or runtime. The frozen `addImport(name, from)` signature is unchanged;
only the behaviour behind it is corrected, by adopting (not re-deriving) the four-branch
model — idempotent-no-op → loud collision-reject → shape-safe merge → separate create —
already proven and judgment-day-approved for the React dialect 20 lines away in the same
codebase. As a folded-in bonus on the same already-sensitive op, the confirmed `name`-splice
code-execution injection is closed by validating `name` at the boundary before any mutation.

## 2. Here's how it fits (architecture)

Leaf-isolated change in `src/dialects/typescript/ops.ts`. The port transfers three pure
ts-morph helpers verbatim (`boundNamesIn`/`satisfiesIdempotency`/`isNonTypeOnlyNamedImportClause`),
extracts the already-present value-namespace predicate into a shared `isValueNamespaceClaimed`
boolean consumed by BOTH the new `addImport` and the existing `assertNoCollision` (no new
intra-leaf copy), and adds ONE sanctioned dialect→core edge by consuming
`assertValidImportBinding` from `jsx-name-validator.ts` as-is. That edge makes the validator
genuinely two-consumer, falsifying the baseline's ARCH-2 "one consumer" premise — the design
registers this as debt rather than silently compounding it, and leaves the archived React
leaf byte-sealed (arm a). Impact = `modifying`; no boundary removed, no pattern replaced.

## 3. The outcome we're chasing (traced to the pain)

Every enumerated piece of the stated pain maps to a concrete resolution:

| Stated pain | After this change |
|---|---|
| type-only merge → runtime ReferenceError | rejects loudly (REQ-TSD-01.6/.8/.26/.27) or creates a separate value import (.7/.9) |
| cross-module / value-namespace collision → SyntaxError at parse | rejects loudly before any mutation (.16/.17) |
| aliased import → silent no-op | alias-to-different-name rejects (.14); aliased-underlying merges (.28); self-alias stays a correct no-op (.15, owner-ratified deviation) |
| same-named local declaration | rejects via the reused value-namespace predicate (.17) |
| (discovered) default/namespace duplicate-binding graft | now a clean idempotent no-op (.10/.13/.30) |
| (folded-in) confirmed `name`-splice injection | closed by REQ-TSD-13 validation gate before any mutation |

The concrete change in the hurting author's reality: they stop receiving silently-corrupt
emitted code. They get either correct output or an immediate branded error at the call site.

## 4. The filed question — does perfect execution RESOLVE the pain, or just produce outputs?

**Resolves it.** This is not outputs-without-outcome: the failure mode being killed is
*silent* corruption that surfaces far from its cause, and the change replaces it with
correctness-or-loud-immediate-failure at the exact authoring point. Two things actively
guard the change against a false outcome:
- It does NOT overclaim. The sibling ops (`addFunction`/`addVariable`/`addClass`) keep their
  raw-splice channels and default/namespace-blind collision scan; the spec/design forbid any
  "TS injection surface is closed" framing and require `addImport`'s JSDoc to AFFIRMATIVELY
  name the siblings as still-raw (REQ-TSD-13.5). The remaining exposure is registered as
  followups, not papered over.
- The shebang case ships the pre-authorized FALLBACK (ADR-03): shebang files still cannot
  receive imports (deferred), but they fail CLOSED (contained reject, byte-unchanged), never
  silently broken. Shebang was discovered during spec/design and is NOT part of the stated
  pain, so deferring it leaves no enumerated pain untouched.

**Shorter path to the same outcome?** No. The whole approach IS the shortest path — adopt
the proven model that already exists in-repo rather than derive a new one. Re-derivation
would be longer and riskier. This directly honours the binding lesson from react-dialect
("adopt, don't derive").

## What reckoning will hold this against

At the pre-archive reckoning, the delivered result must show:
1. An author calling `addImport` on each pain-shape gets correct output OR a loud immediate
   reject — demonstrated through the PUBLIC handle (e2e Flow 1), not just unit internals.
2. No "injection surface closed" overclaim shipped; siblings' still-raw status is documented.
3. Shebang fail-closed containment pinned; the insertion-upgrade followup actually registered.
4. Row bookkeeping (342/343/459/340/456) reconciled — the ledger honest about what moved.
5. FIT-39 predicate-parity green, with the self-alias row as an explicit expected-divergence.
