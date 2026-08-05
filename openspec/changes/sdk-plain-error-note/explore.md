# Exploration: SDK plain-error note (sdk-plain-error-note)

**Triage**: M (sensitivity override — disclosure control)
**Persona lens**: none (light M exploration; security-engineer is scheduled at propose/spec, not explore)

## Cross-Change Lessons Consulted

`openspec/lessons-learned.md` — no change specifically about `error-text.ts`/`boundMessage`/WPS-07
widening exists yet. Two general-process lessons apply forward:
- `author-emulation-e2e-scaffold`: fitness-guard numbers are one flat project-wide sequence with
  no reservation — if design adds a new guard (see Open Questions), reserve its number at plan
  time, not apply time.
- `stdio-engine-client`/`conformance-corpus` (repeated 4x): a clean in-loop/council pass does not
  substitute for a blind adversarial pass on a disclosure-control surface — relevant since this
  change is sensitivity-forced M with a security-engineer persona already scheduled.

## Affected Flows

Affected Flows: not applicable — no user-facing CLI/API surface changes; this is a stderr text
enrichment inside an already-existing failure path (same command, same exit codes, richer message).

## Current State

The terminal catch in `runRunnerBody` (`src/transport/runner.ts:332-346`) wraps `await run(...)`.
On throw, it computes `label` via a 3-branch `instanceof` ternary (exact text, confirmed at HEAD,
lines 340-343):
```ts
const label =
  err instanceof AuthoringError || err instanceof TransportFault || err instanceof IntentRejectedError
    ? err.message
    : "run failed";
note(io, `pbuilder-runner: ${label}`);
```
`note()` (line 50-52) writes `${boundMessage(text)}\n` to `io.writeStderr` — stderr only, never the
wire (WPS-03). `boundMessage()` (`error-text.ts:25-27`) is a pure length cap: `MESSAGE_CEILING_CHARS
= 2000`, applied to the WHOLE composed string (prefix + label), no content inspection, no path
scrubbing. It does not scrub absolute paths or stack frames — that's a separate, unused-here
capability (`toProjectRelativePath`) that only applies where the SDK itself holds a structured path
value (e.g. `resolveInput`'s `unreadable()` message), not to opaque third-party `Error.message` text.
A plain `Error` (e.g. Node's `fs` throws, or an author's bare `throw new Error(...)`) hits the `:
"run failed"` fallback today — its message, including any embedded absolute path, is discarded, not
merely capped. `classifyExitCode` (`exit-codes.ts:38`) independently falls through to exit 4 for any
unclassified error — untouched by this change (triage: exit taxonomy out of scope).

A second, narrower terminal catch exists in `src/bin/pbuilder-runner.ts:34-42` (wraps the `runRunner`
call itself, catching only what escapes the internal catch above, e.g. `OverlappingRunError`) with
its own literal `"run failed before completing"` fallback. Triage/contract/SEAM-01 name only
`runner.ts`'s catch — this second one is a distinct, much narrower swallow point, **read-only /
out of scope** for this change.

**OQ-3 cap sizing**: `MESSAGE_CEILING_CHARS = 2000` already matches the triage scope's resolution
("stays ≤ existing cap, message-only, stack excluded") — zero new cap logic needed. Do not confuse
this with the engine's separate `stderrTailCap = 2048` (program.md SEAM-02) — different repo,
different quantity (bytes of captured raw stderr vs. chars of one composed message).

**No existing test today asserts on the fallback branch's text.** `test/fake/exit-matrix.e2e.test.ts`
case (d) (crash fixture, `TypeError` thrown mid-run) asserts only `exitCode === 4`, never stderr
content — so widening the branch carries no known regression risk against current assertions.
Confirmed via search: **no fitness/security test scans the runner's stderr `note()`/`boundMessage`
output for absolute-path leakage** (`test/security/canary-no-echo.test.ts`'s canary-no-echo suite
covers `AuthoringError`/`path-guards.ts` rejection surfaces only, never this terminal-catch path) —
this is a real coverage gap, not an oversight to dismiss.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/transport/` cluster (runner.ts terminal catch) | modify | widen the ternary's fallback branch to surface a plain `Error`'s message instead of the literal `"run failed"` | aligns |
| `src/transport/error-text.ts` (WPS-07 boundMessage) | reuse (no change) | existing cap discipline already satisfies the scope's cap requirement | aligns |

No new component, no new layer — `architecture.md`'s own convention ("every transport error message
routes through `error-text.ts`") is followed verbatim, matching triage's "no new mechanism" framing.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/transport/runner.ts` | Modify | widen the 3-branch ternary (lines 340-343) |
| `src/transport/error-text.ts` | Read-only | confirmed `boundMessage`/cap sizing needs no change |
| `src/transport/exit-codes.ts` | Read-only | confirmed exit-4 fallback is untouched (in scope: message only) |
| `src/bin/pbuilder-runner.ts` | Read-only | confirmed a distinct, out-of-scope swallow point (own literal fallback) |
| `test/fake/exit-matrix.e2e.test.ts` | Modify | case (d) needs a stderr-content assertion added |
| `test/transport/runner.unit.test.ts` | Modify | unit-level ternary coverage for the new branch |
| `test/security/canary-no-echo.test.ts` (or a new file) | Modify or Create | closes the confirmed absolute-path leak-scan gap on this path |

## Approaches

### 1. Widen the existing ternary to `err.message`, reuse `boundMessage()` verbatim (cap-only)
**Description**: Collapse (or extend) the ternary so any thrown value's message — not just the three
curated classes — flows through the exact same `note()`/`boundMessage()` call already used today.
Zero new functions, zero new cap logic, zero new sentinel shape.
**Pros**: Matches triage's own characterization ("no new mechanism, no rewrite"); matches
`docs/error-observability-contract.md` Seam 1's SDK obligation text literally ("includes... message
... bounded, same cap discipline" — it does NOT ask the SDK to scrub); matches the program's own
chosen mitigation layer — the parent contract explicitly schedules the CLI-side leak-scan
(`Test_ERR41_1`) extension for this exact widened field, i.e., the security control the program's
architects chose lives downstream, not here; SEAM-01's interface is already pinned as ONE line
`pbuilder-runner: <boundMessage(err.message)>\n` for ALL classes — this is the only approach that
doesn't require re-negotiating that already-signed cross-repo shape.
**Cons**: Ships a real, known residual: a plain Error whose message embeds an absolute host path
(e.g. Node's `ENOENT: ..., open '/abs/path'`) reaches stderr unscrubbed, in tension with WPS-07's own
normative text ("MUST NOT echo... absolute filesystem paths") until/unless that text records an
explicit exception for this newly-admitted uncurated class.
**Effort**: Low.
**Pattern fit**: matches existing `error-text.ts`/`note()` exactly — no new pattern.

A sanitizing approach (scanning free-text `Error.message` for path-shaped substrings and redacting
them) was considered and rejected at exploration depth: `toProjectRelativePath` only formats a
*known, structured* path value the SDK already holds — it has no application to opaque prose where
a path may be embedded anywhere in arbitrary shape (POSIX, Windows, quoted, unquoted). Building that
scanner would be new pattern, new false-positive/negative surface, and higher effort than triage's
own S-sized estimate assumes; not ruled out permanently, but not the M-depth recommendation.
A structurally distinct sentinel (marking uncurated messages differently from curated ones) was also
considered and rejected: SEAM-01's interface is already fixed as one sentinel format across ALL error
classes for `#2` (engine-runner-note-carrier) to extract — diverging from it here would break an
already-negotiated cross-repo seam this SDK repo cannot unilaterally change.

## Recommendation

Approach 1 (widen the ternary, reuse `boundMessage()` verbatim, cap-only) — it is the only approach
compatible with SEAM-01's already-pinned interface, matches the existing `error-text.ts` pattern with
zero new code beyond the ternary branch, and mirrors the mitigation layering the parent contract's
own architects already chose (CLI-side leak-scan, not SDK-side scrubbing). The residual absolute-path
risk this leaves open is real and must be resolved explicitly, not silently — see Open Questions.

## Risks

- **Documented-but-unresolved WPS-07 tension**: shipping approach 1 without an explicit spec-level
  decision (accept residual + document it, vs. scrub, vs. reject certain shapes) means REQ-WPS-07's
  own text and the shipped behavior visibly disagree — must close before spec signs (see OQ below).
- **Sequencing collision with `runner-tripwire-invariants`** (triage-confirmed, real): that change
  pins `dist/runner-manifest.json`'s sha against the current `runner.ts` build; any `runner.ts` edit
  before it lands invalidates the pin. This change's own artefacts stay planning-only through
  APPLY-blocked sequencing (no `src/`/`dist/` writes before `/build`), so no order is forced during
  planning — but the human/orchestrator "do not interleave" decision triage flagged is still
  unresolved and must be made before either change's `/build` proceeds against `main`.
- **Untested absolute-path behavior**: no existing fitness/security test exercises this path's
  leak posture at all (confirmed gap) — whatever the spec/design decision, it ships as an assertion
  gap unless a new test is added.
- **Non-`Error` thrown values**: the ternary's fallback also covers non-`Error` throws (a bare
  `throw "x"` or `throw 42` has no `.message`) — widening naively to `err.message` needs an explicit
  fallback for that shape (see OQ below), or `"run failed"` silently regresses to `"undefined"`.

## Open Questions

- type: product
  question: "Does REQ-WPS-07's normative text need an explicit documented-exception addendum for
  the newly-admitted uncurated plain-`Error` content class (accepting the absolute-path residual,
  mitigated only by the downstream CLI leak-scan per the parent contract), or must the SDK actively
  scrub/reject certain message shapes before this ships?"
  why_it_matters: "This is the exact tension triage flagged and assigned the security-engineer
  persona to weigh; picking silently either ships a spec-contradicting behavior or over-builds a
  scrubber the parent contract's own architecture didn't ask for."
- type: product
  question: "Confirm sequencing order with `runner-tripwire-invariants` (plan-complete, owner-ready
  to `/build`, `dist/runner-manifest.json` pinned) before this change's own `/build` runs against
  `main` — land tripwire first, or have its owner explicitly re-baseline the manifest hash after
  this change merges?"
  why_it_matters: "Triage marked this a real file+semantic collision and explicitly a human call,
  not resolvable by triage or explore; unresolved, it risks a red integrity-manifest check on
  whichever change lands second."
- type: technical
  question: "What should the note text be when the thrown value is not an `Error` instance (no
  `.message`) — keep a fixed fallback text, or coerce via `String(err)`?"
  why_it_matters: "A naive `err.message` widen silently produces `\"undefined\"` in stderr for a
  bare `throw \"x\"`/`throw 42`, which is worse than today's `\"run failed\"` — needs an explicit
  design decision, not an accidental regression."
- type: technical
  question: "Should this change add the SDK-local absolute-path/leak-scan fitness or canary test
  that today does not exist for this stderr path, independent of the scrub-vs-cap-only decision —
  so the residual (whatever it is) is asserted and monitored rather than silently untested?"
  why_it_matters: "Feeds sdd-design's Test Derivation table; closes the confirmed coverage gap
  either way the product question above resolves."

## Ready for Proposal

**Status**: partial
**Reason**: The mechanical approach (widen the existing ternary, reuse `boundMessage()` verbatim) is
clear, low-effort, and pattern-matched — no further investigation needed there. What remains open is
a genuine, triage-flagged security-disclosure decision (scrub vs. accept-and-document) plus a
cross-change sequencing confirmation and a small edge-case decision (non-`Error` throws) — none of
these are ambiguity about WHAT the SDK-side change looks like, only about two explicit product
rulings and one technical edge case that sdd-propose/spec should carry forward and resolve on the
record (not silently assume), per the security-engineer persona already scheduled at this M's
triage.
**Recommended action**: Proceed to `sdd-propose` (merged M path) with the four open questions above
carried forward verbatim; surface the two `product` questions to the user/owner before the proposal
is signed.
