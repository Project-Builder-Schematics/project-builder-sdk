# Delta for commit-discard-contract

**Spec version**: V2
**Status**: draft
**Change**: `stage-1-ir-bedrock`

## ADDED Requirements

### REQ-10: Double-Fault Error Preservation — Discard Rejection Does Not Replace the Original Error

> Test layer: **integration** — the real `defineFactory` → `context.ts` → `Session` →
> `discard()` path, wired unmocked end-to-end; the ONLY test double is the
> `EngineClient`-compatible client whose `discard()` rejects. This requirement MUST NOT be
> hollowed into a mocked unit test of the catch block in isolation.
>
> RED posture: REQ-10.2 is a **RED-PHASE GATE** — transient by design: it proves the bug is
> live on today's `context.ts` BEFORE the fix, and becomes historical (the same fixture
> asserts the fixed behavior via REQ-10.1) once the fix lands. Distinct from a permanent
> string-fixture red-proof like REQ-FIT-09's planted bypass.

When a factory function throws an error (E1) AND the subsequent `discard()` call ALSO
rejects (E2), `defineFactory` MUST propagate the ORIGINAL error E1 to the caller — E2 MUST
NOT replace E1 and MUST NOT be silently swallowed. E1 MUST carry E2 accessible via its
`cause` property.

#### Scenario REQ-10.1: Discard rejection is attached as `cause`, original error still propagates

- GIVEN a factory that buffers one `create` directive then throws error E1
- AND a `ContractFake`-compatible client double whose `discard()` rejects with error E2
- WHEN the runner executes the factory (full unmocked integration path)
- THEN the runner's returned promise rejects with E1 (not E2)
- AND `E1.cause` is E2

#### Scenario REQ-10.2: Red-proof — today's `context.ts` fails this without the fix (RED-PHASE GATE)

- GIVEN the double-fault fixture from REQ-10.1
- WHEN run against the CURRENT (pre-fix) `context.ts` catch block (`await
  ctx.session.discard(); throw err;`, no inner try/catch around `discard()`)
- THEN the test MUST fail red (E2 replaces E1) before the fix lands — proving W6 is a live
  bug today, not already fixed

#### Scenario REQ-10.3: Contrast — discard succeeds normally, no `cause` attached

- GIVEN a factory that throws E1 and a `discard()` that resolves normally
- WHEN the runner executes the factory
- THEN E1 propagates unchanged and `E1.cause` is `undefined`
