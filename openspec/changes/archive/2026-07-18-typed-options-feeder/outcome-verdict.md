# Outcome Verdict — typed-options-feeder (reckoning memo)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Triage**: M
**Verdict**: `delivered` (pending human confirmation on the two escalated questions — owner has effectively pre-answered both; see below)
**Held against**: the ORIGINAL problem statement (triage.md) and the foresight North Star, not the spec.
**Delivered reality**: branch `feat/typed-options-feeder` @ df82269 · verify final `pass-with-followups`, 32/32 scenarios, suite 1962/0.

## Our objective was THIS (quoted)

> Schematic authors must manually `JSON.stringify` array- and object-valued `create` options at
> every call site for the engine's v1 wire to render them. This is SDK-owned DX friction — the
> author should not need to know how options travel the wire.

North Star (foresight): *"A schematic author writes native arrays and objects as `create`/`scaffold`
option values everywhere options are accepted — and never has to know, or reach for, the
`JSON.stringify` wire-encoding the engine's v1 renderer secretly needs."*

## Did we deliver it? Show me WHERE.

Yes — and the "where" is pointable, not hand-waved:

| Stated pain | Delivered artefact (shipped) | Evidence |
|---|---|---|
| Author hand-`JSON.stringify`s composite options at every call site | `encodeOptions()` at the single factory choke point, called once in `DirectiveFactory.create()` (`src/core/directive-factory.ts` +89) | REQ-TOE-01.1-.8 COMPLIANT; fit-39 confines the call sites |
| Author must KNOW how options travel the wire | `docs/create-templates.md` §Appendix workaround DELETED, §1 example rides native values, zero `JSON.stringify` mentions | REQ-TOE-09.1 grep-zero verified; §1 (lines 25-29) + native-array example (57-67) + "you never hand-encode them" (80-81) |
| "No surface left inconsistent" (inline / templateFile / scaffold) | One choke point all three converge through | REQ-TOE-06.1/.2 byte-identical to absolute anchor `'[{"name":"load"}]'` |
| Don't break authors who already adopted the workaround | String passthrough byte-identical | REQ-TOE-02.1 |
| (pain-relocation guard) composite near 4 MiB mis-sized pre-encode | Shared helper threaded into `classify-transport` (`src/scaffold/classify-transport.ts` +12) | REQ-CCL-02.4 unit + real-scaffold fallback |
| (pain-relocation guard) non-JSON value fails opaquely | Loud, attributed reject naming the key + echoing the allowed set, no raw serializer text | REQ-TOE-04.1-.8 COMPLIANT |

The pain is removed AT ITS SOURCE (native composites accepted), not relocated one layer over.

## Author-journey simulation on the SHIPPED state

1. **Write the factory** — `create("model.ts", { options: { methods: [{ name: "load" }, { name: "save" }] } })` with a native array. `encodeOptions` lowers it at the boundary; the engine receives `'[{"name":"load"},{"name":"save"}]'`. No `JSON.stringify` at the call site. ✔
2. **Read the shipped doc** — `docs/create-templates.md` teaches native values ("pass as plain native values; you never hand-encode them", line 80-81); there is nothing in the guide that would send the author back to a `stringify` workaround. ✔
3. **Hit an error** — pass `{ when: new Date() }` or a nested `() => {}` and the call rejects at scheduling time with a message that names the key and echoes the allowed set, never a raw `TypeError`/`Do not know how to serialize`. ✔ (REQ-TOE-04.3/.5/.8)
4. **Assert in a test** — a recorded batch from `@pbuilder/sdk/testing` shows `options.methods` in its encoded wire string form, and the doc says so explicitly (lines 83-85), so the author is not surprised the assertion reads the JSON string, not the native array. ✔ (REQ-TOE-07.1)

The promised outcome holds end-to-end on the shipped state.

## Outputs-without-outcome check

**PASS.** The classic trap — "encode ships but docs still teach the workaround" — is explicitly
closed as a binary criterion of done (REQ-TOE-09.1, grep-zero, verified). This is not a green
suite over a beside-the-point output: the diff both ADDS the capability and REMOVES the pain's
documentation. The two pain-relocation risks the foresight memo flagged (budget mis-sizing; opaque
failure) are each pinned by a shipped, passing REQ.

## Did we drift? Promise (North Star) vs delivery

- **AuthoringError → plain `Error`** (foresight-flagged, ADR-03, owner-ratified): the reject is an
  interim plain `Error`, not the Stage-2 structured `AuthoringError` the proposal framed. **Not an
  outcome gap** — the message contract (names the key, echoes the allowed set, no raw serializer
  text) delivers the author-facing quality the outcome needs; the `JSON.stringify` friction the
  problem names is untouched by this drift. Structured-attribution parity is a registered followup
  (now touching 3 test sites, per verify report — worth noting when picked up).
- **Attribution shadow** for function/BigInt/symbol create-options (previously reached Stage-2's
  flush-time `unrepresentable-content` guard, now reject earlier as plain `Error`): reconciled in
  the affected Stage-2 tests, honest and contained. Followup registered. **Not an outcome gap.**
- **V3 micro-unfreeze — non-finite carve-out (REQ-TOE-03.3):** `NaN`/`Infinity` pass the plain-JSON
  predicate top-level; nested inside a composite they coerce to JSON `null` (plain `JSON.stringify`
  semantics), made loud downstream by the engine's "present but null" typed error. **Does this
  betray the North Star? No — it is coherent.** The North Star is about native ARRAYS/OBJECTS never
  needing wire knowledge; the carve-out touches neither — it governs where a non-representable
  SCALAR is caught (scheduling vs flush time), a cross-change coherence decision (keeping Stage-2's
  flush guard reachable), not the composite-encoding promise. The author still never reaches for
  `JSON.stringify`. Behaviour-recording only, no production change; owner ratification at archive.

No drift rises to an outcome gap. All three are owner-visible, documented, and outcome-neutral.

## Verdict

`delivered`. The shipped result resolves the stated pain at its source — native composites accepted
across all three surfaces — AND removes the knowledge burden (docs workaround deleted), verified by
real execution (32/32, suite 1962/0), not merely a correct-but-beside-the-point output. The two
questions below are the human-only ones the conscience never fakes; the owner has already
effectively answered both, recorded here for the record rather than as blockers.

## Conscience questions (human-only — escalated, not faked)

1. **Is it USABLE** by the schematic author who was hurting — does reaching for a native array now
   feel like the obvious path, with no residual moment where they wonder "do I need to encode
   this"? *Suspicion: yes* — the author-journey simulation holds end-to-end and the docs no longer
   contain a workaround to rediscover. *Owner has effectively answered:* the owner ruled this
   resolves SDK-side (`pending-changes.md:473`) and signed spec V2, which pins the native-value
   author experience as the contract.
2. **Is it SIGNIFICANT** — does closing this gap matter, or is it ceremony? *Suspicion: yes* — it
   retires a workaround that had *just* shipped (docs PR #36) and would otherwise calcify at every
   composite call site. *Owner has effectively answered:* the "why now" in the problem statement is
   the owner's own significance ruling ("closing the gap while the surface is fresh keeps the doc's
   appendix short-lived").
