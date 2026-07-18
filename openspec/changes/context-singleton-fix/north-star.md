# North Star — context-singleton-fix (foresight memo)

**Checkpoint**: foresight (post-design, pre-slice) · **Triage**: M · **Verdict**: `aligned`
**Recorded**: 2026-07-19 · Held verbatim at the reckoning checkpoint.

## 1. This is what we're going to do (outcome terms)

Make the SDK's run-context store *module-identity-safe*, so that when the engine's live
conformance harness spawns the pinned **dist** runner against a **`.ts`-source** corpus
factory, the authoring verbs actually run instead of throwing `outside-run` (exit 4). One
`AsyncLocalStorage`, parked at `globalThis[Symbol.for("@pbuilder/sdk:core/context#run-als")]`,
shared by every realm that resolves `context.ts` — dist and src alike. Prove it with a new
e2e that recreates the *exact* dual-realm topology and RED-fails on pre-fix `main`.

## 2. Here's how it fits

The bug lives at one seam: `core/context.ts`'s module-scope `als`. The fix moves store
*ownership* (module-scope → process-wide symbol registry) and touches nothing else — Session,
DirectiveFactory, the run sequence, the error taxonomy, the `@internal` boundary (off
`package.json#exports`, ADR-0034) all stay put. It is a `deviates` touchpoint on the
architecture baseline (first `Symbol.for` idiom → ADR-02), post-verify baseline refresh warranted.
The dist-runner e2e is the only topology that exercises the split; it reuses `frame-host` +
`fake-engine-harness` verbatim, guarded by a fail-loud fresh-dist check.

## 3. The outcome we're chasing (traced to the problem statement)

The engine team is **blocked now** (PC-PROTO-02, M1). The pain is not "SDK tests are red" — it
is "the engine cannot advance because its first live conformance run fails every verb." The
concrete change in their reality: pin advances → their harness's `.ts`-corpus run against the
dist runner exits 0 with `[tree.read, ir.emit, ir.commit]`.

## 4. The filed question — does perfect execution RESOLVE the pain?

**Within this repo: yes, and de-risked as far as a single repo can.** The e2e is a faithful
proxy of the engine's failing topology with a pre-fix RED proof — this is *not* outputs-without-
outcome. The fix is topology-agnostic (any two realms both executing `Symbol.for(key)` dedupe),
so it survives reasonable differences in the engine's relative-import depth or Bun version.

**Beyond this repo: three facts sit between "SDK green on main" and "engine unblocked," and none
of them can be settled from inside this repo.** The proposal itself scopes engine confirmation as
a *non-gating downstream followup* — that is an honest scoping call, but it means "green on `main`"
is this change's done-definition while "engine actually unblocked" lives one handoff away. The
steward's job is to make sure that gap is *named and owned*, not silently equated. See the
conscience questions.

## Conscience questions carried to reckoning

- **CQ-1 (topology fidelity)** — The e2e reproduces the split with *this repo's* fixture importing
  `../../../../src/index.ts`. Is that faithful to how the **engine's** corpus factory resolves the
  SDK (submodule-with-src-import vs. pinned-dist-dependency in `node_modules`)? If the engine
  consumes the SDK as a bare-specifier dist dependency, there is no split to fix; if via a
  differently-nested src checkout, the fix still holds — but only the owner knows the real layout.
- **CQ-2 (does M1's corpus stay on the covered path?)** — The fix covers `create({template})`; the
  documented residual **Hazard #2** (SRC-constructed `AuthoringError` via `requirePackageAnchors`,
  reached by `create({templateFile})`/`scaffold`/`copyIn`) is explicitly *not* closed (FU-4). If any
  M1 corpus factory exercises `templateFile`/`scaffold`/`copyIn`, the engine stays blocked *after*
  this ships — a different exit-4. Is M1's corpus guaranteed to only hit `create({template})`?
- **CQ-3 (who advances the pin and confirms, and does it gate archive?)** — Pin advance + engine
  confirmation are cross-repo acts this change cannot perform. Is "suite green on `main`" acceptable
  as done with engine confirmation as a non-gating followup, or should reckoning hold archive until
  the engine's real run confirms M1 unblocked?

These are cross-repo coordination and significance calls — human-only. The design is not gated on
them (nothing in the design is misaligned); the reckoning checkpoint will hold delivery against them.
