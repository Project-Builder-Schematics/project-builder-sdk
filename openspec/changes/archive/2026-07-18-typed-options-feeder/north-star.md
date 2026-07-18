# North Star — typed-options-feeder (foresight memo)

**Checkpoint**: foresight (post-design, pre-slice) · **Triage**: M · **Verdict**: `aligned`
**Held against**: the ORIGINAL problem statement (triage.md), not the spec.

## The outcome we are chasing (one sentence)

A schematic author writes native arrays and objects as `create`/`scaffold` option values everywhere options are accepted — and never has to know, or reach for, the `JSON.stringify` wire-encoding the engine's v1 renderer secretly needs.

## How the design chases it

One pure `encodeOptions` helper at the single factory choke point (`DirectiveFactory.create()`, where `commons.create()` inline + `templateFile` and `scaffold` expansion all converge), plus the same helper threaded into `classify-transport` so the byte-budget estimate measures the true post-encode wire size. Type discrimination (string passthrough) IS the backward-compat seam — no flag, no dual path. Native composites are lowered; everything else rides verbatim. Crucially, the design also DELETES the docs section that teaches the `JSON.stringify` workaround — so the change removes the pain, not just adds a capability beside it.

## Result → problem map

| Stated pain (problem_statement) | Design piece that addresses it | Coverage |
|---|---|---|
| Author hand-`JSON.stringify`s composite options at every call site | `encodeOptions` at the factory choke point (REQ-TOE-01) | Fully addressed |
| Author must KNOW how options travel the wire | Docs delete the §Appendix workaround + §1 native-array example (REQ-TOE-09) | Fully addressed — the knowledge burden is removed, not relocated |
| "No surface left inconsistent" (create inline / templateFile / scaffold) | Single choke point covers all three; parity pinned to an absolute anchor (REQ-TOE-06) | Fully addressed |
| Don't break authors who ALREADY adopted the documented workaround | String passthrough byte-identical (REQ-TOE-02, ADR-02) | Fully addressed |
| (pain-relocation guard) composite near 4 MiB budget mis-sized pre-encode | Shared helper into `classify-transport` (REQ-CCL-02.4) | Addressed — estimate stays honest |
| (pain-relocation guard) non-JSON value fails opaquely at the wire | Loud, attributed reject: names the key, echoes allowed set, no raw TypeError (REQ-TOE-04) | Addressed at author-actionable quality |

## Author-journey simulation

**Today** — author writes a factory with a native array:
```ts
create("model.ts", { options: { methods: [{ name: "load" }, { name: "save" }] } })
```
→ engine renders `[object Object]` garbage (array never promoted). Author debugs, finds the docs appendix, rewrites to `methods: JSON.stringify([...])`. Pain: they now carry wire knowledge and repeat the wrap on every composite option forever.

**After this change** — same native-array factory:
```ts
create("model.ts", { options: { methods: [{ name: "load" }, { name: "save" }] } })
```
→ `encodeOptions` lowers it at the boundary; engine renders correctly; docs no longer mention `JSON.stringify`. The author never learns the wire trick because there is nothing to learn. Existing `JSON.stringify`'d call sites keep working untouched. **The pain named in the problem statement disappears at its source.**

## Outputs-without-outcome check

PASS. The classic trap here — "encode ships but docs still teach the workaround" — is explicitly closed: REQ-TOE-09 makes docs-workaround-removal an owner-ruled binary criterion of done. The change removes the pain rather than adding a capability the author still has to discover. The two pain-relocation risks (budget mis-sizing; opaque failure) are each pinned by a REQ so the pain is not merely pushed one layer over.

## Promise ↔ delivery drift

- **Rejection class downgrade (proposal → design)**: the proposal promised a Stage-2 `AuthoringError` for non-plain-JSON values; ADR-03 delivers an interim **plain `Error`** (owner-ruled — `AuthoringError`'s `originFor` is unconstructible at the encode site without inventing a verb/path/reason). Structured attribution is a registered followup. This is a real drift, but **owner-ratified, documented, and outcome-neutral**: the message contract (names the key, echoes the allowed set, no raw serializer text) keeps the author-facing quality the outcome actually needs. The core pain (JSON.stringify friction) is untouched by this drift. Not a gap — flagged for the human's awareness.
- **Attribution shadow (explicit in ADR-03/§4.2d)**: function/BigInt/symbol create-options that previously reached Stage-2's flush-time `unrepresentable-content` guard now reject earlier as a plain `Error`. The design reconciles the affected Stage-2 test (REQ-14.3 fixture moves to a non-finite number that still hits the flush guard) and registers the parity followup. Honest and contained.
- **Docs compat-line pending decision**: proposal carries `[owner-decision-pending]` on whether docs keep one line ("previously JSON.stringify'd values keep working") or zero mention. The design deletes the appendix and adds a testing-observability note but does not visibly resolve this one-line question. Doc-wording detail, not an outcome gap — surfaced below for the owner.

## Shorter path to the same outcome?

No shorter path found. The design is already minimal — one pure helper, two call sites, no new pattern (mirrors the existing `forceEntry` precedent in the same file). The three alternatives (verb-layer encode, flush-time encode, version-flag opt-in) are each rejected with sound reasoning; notably the version-flag path would REINTRODUCE the very wire-knowledge burden the change exists to remove. Threading the helper into `classify-transport` is not scope creep — it is what keeps the budget estimate honest so the pain isn't relocated to the 4 MiB boundary.

## Verdict

`aligned`. The design, executed as written, resolves the stated pain at its source (native composites accepted everywhere) AND removes the knowledge burden (docs workaround deleted) — not merely producing a correct-but-beside-the-point output. The two conscience questions below are for the human's judgment, not blockers.
