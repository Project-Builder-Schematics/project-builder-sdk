# North Star — conformance-corpus (Steward Foresight)

**Checkpoint**: foresight (post-design, pre-slice) · **Verdict**: `aligned` · **Triage**: L
**Held against**: the ORIGINAL `problem_statement` (triage), NOT the spec.

## This is what we're going to do (outcome terms)

Land a fixture corpus under `conformance/` at repo root, on `main`, that the engine repo
(`project-builder-engine`, `sdk-live-conformance` / PC-PROTO-02) consumes as a pinned git
submodule and drives through the REAL runner via its Go harness — replacing the in-repo contract
FAKE as the thing SDK↔engine validation runs against. Delivered in two PRs: **PR#1 = `m1-vehicle`
+ all scaffolding, which alone unblocks the engine's M1 milestone the moment it goes green**; PR#2
= the four `m2-*` fixtures.

## Here's how it fits (architecture)

Additive. A net-new root-level, cross-repo-consumed static-contract layer (`conformance/`,
ADR-0063) — no `src/` change, no wire-spec change, no runner change. The corpus SATISFIES an
existing runner precondition (`resolvePackageRoot` needs a `collection.json` ancestor, ADR-0067)
rather than modifying the runner. The only in-repo executable surface is one structural,
non-spawning self-check (`fit-40`). Nothing in the baseline becomes wrong.

## Here's the outcome we're chasing (the hurting person's reality)

The engine engineer advances the submodule pin and, for the FIRST time, exercises real SDK
factories through the real runner instead of the fake — closing the fake↔engine fidelity gap that
today goes undetected in both repos. Concretely for M1: pin advance → Go loader reads
`corpus.json` → runner resolves `conformance/` as `packageRoot` (via `collection.json`) → drives
`m1-vehicle`'s factory (`read` → `modify v1→v2`) → asserts exit 0 / `out.txt=v2` /
`[tree.read, ir.emit, ir.commit]`. M1 (handshake + round trip) is unblocked.

## Why this is aligned (not outputs-without-outcome)

The design does not merely transcribe the handoff — it delivers the corpus that actually **RUNS**,
and it is TRUER to the real runner than the handoff's own text:

- **collection.json (ADR-0067)** — the design traced the runner source and found that WITHOUT this
  marker every fixture exits 1 before its factory runs. The handoff never mentions it. This single
  insight is what turns "corpus lands but everything fails exit 1" into "corpus lands and runs." It
  is engine-loader-invisible, so it costs the engine nothing. This is the plan being truer than the
  ask.
- **Corrected twin transcripts (V3 evidence-driven unfreeze)** — a blind architect review caught
  the SIGNED V2 pinning transcript values that CONTRADICT the runner (`defineFactory` discards on
  any rejection → twins end in `ir.discard`, not a halt at the rejected `ir.emit`). Correcting them
  IS the fidelity mandate: a transcript that lies about the runner would be a fidelity defect baked
  into the fidelity fixture.
- **Case-level `factory` schema delta (ADR-0065)** — the handoff's own schema is underspecified for
  `m2-create-composition` (two behaviours, one fixture, no discriminator, splitting forbidden). The
  design resolved the contradiction by proposing a schema extension, gated on engine sign-off, and
  made the handoff amendment itself. Escalated, not silently drifted.
- **Self-check / `.gitattributes` / README** — each serves fidelity (byte-exact `expected/`
  survives checkout), fail-fast (don't ship a corpus the engine's fail-closed loader would
  HARD-reject and re-block on), or maintainability. None is gold-plating; the self-check is
  structural-only and cheap. All owner-ratified scope.

**Shorter path check**: PR#1 already isolates the minimum M1 unblock (m1-vehicle only). No lighter
path to the SAME outcome without forfeiting the fail-fast guard on the engine's fail-closed loader.

## Honesty boundary (carried to reckoning)

Per REQ-CFX-11, this repo has NO runner-driven verification path: every exit code, transcript, and
post-run byte is a **DECLARATION**, traced from runner source and hand-authored against the
handoff — engine-authoritative, first PROVEN only engine-side. The corpus's truth is
"traced-from-source + engine-proven-later," never "SDK-proven-now." The self-check proves internal
CONSISTENCY, never engine behavior. This is honestly disclosed and is the right posture for a
cross-repo contract corpus — but the reckoning must not let "self-check green" masquerade as
"the engine will produce these bytes."

## Preconditions the reckoning must hold the result against

1. **Spec V3 not yet re-signed** (unfrozen from signed V2, DRAFT). Archive MUST gate on owner
   re-sign — the design flags this itself.
2. **PR#2 blocked on engine sign-off** for the ADR-0065 case-level `factory` schema delta. PR#1 /
   M1 unblock is unaffected.
3. **Greeting-twin `expected:"empty"` assumption** — `m1-vehicle`'s greeting-mismatch-twin
   pre-stages `out.txt` before the exit-1 greeting check yet declares zero files post-run; whether
   the engine physically removes the pre-staged-but-uncommitted file is ENGINE-OWNED and currently
   an ASSUMPTION on the very fixture that unblocks M1.

## Filed conscience questions (human / cross-repo — see envelope)

The three forward-looking calls the AI cannot make: (Q1) is a declaration-only corpus usable to
unblock M1, or does the engine team need SDK-side runner proof first; (Q2) is the greeting-twin
empty-vs-pre-staged assumption confirmed with the engine, or is M1 unblocking on an unverified
engine cleanup behaviour; (Q3) is the engine team aware they now OWN a loader change (ADR-0065)
before the full corpus can land, and is that coordination cost acceptable.
