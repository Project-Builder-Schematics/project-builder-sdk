# ADR-0019: Batch size cap, UTF-8 measurement, text-only wire content

- Status: Accepted
- Date: 2026-07-04
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0018 (boundary pass-through — the SDK never validates); ADR-0015
  (`EngineClient` port); `openspec/problem-statement.md` invariant #5 (single engine
  boundary).
- Closes: DECISION D8 (`openspec/objectives-plan.md`, Stage 1.4).

## Context

The `Batch` needs a size cap, but no unit, encoding, or enforcement site existed. Two axes
were open: measurement unit (raw content bytes? UTF-16 code units? serialized UTF-8 bytes?)
and where the check runs (SDK-side `Session.flush`, or the engine boundary). ADR-0018
forbids SDK-side validation — judgment lives on the engine side of the `EngineClient` port.

## Decision

Cap = `4 * 1024 * 1024`, measured as `Buffer.byteLength(JSON.stringify(batch), 'utf8')` —
**UTF-8 bytes of the serialized envelope**, not raw content, not UTF-16 units.
**Exactly-at-cap passes; one byte over rejects** (strictly `>` the cap).

Enforced **only** at the fake's `emit` (the engine stand-in) — the engine, not the SDK,
owns validation (ADR-0018). `Session.flush` calls `emit` unconditionally; it carries no
SDK-side size branch of its own.

Wire content (`modify.content`, `create.template`) is exactly `string` in v1 — **text-only**.
No union with a binary/base64 wrapper shape exists in the v1 contract. A future
binary/base64 shape would be an *additive* wire change (a new field or a widened union),
not a modification of this contract — deferred until a concrete binary-payload need
materializes; nothing in Stage 1 requires it.

## Consequences

- One authority for size, matching ADR-0018; the cap travels with the wire and survives
  the fake→real engine swap without SDK involvement.
- The empty-batch path is untouched — a zero-directive factory still `flush`-no-ops (no
  `emit` call) and reaches `commit()` (REQ-03) — zero production change to
  `session.ts`/`context.ts` for that path.
- The fake carries the measurement logic; its tests must pin against escaping and
  multi-byte adversarial fixtures, not plain-ASCII ones (a plain-ASCII fixture cannot
  distinguish a correct UTF-8-serialized-byte measurer from a naive raw-content or
  UTF-16 measurer).
- Binary payloads are unsupported until a later additive wire change.

## Provenance

The 4 MiB value is **SDK-chosen** — a reasonable JSON-RPC-over-stdio frame limit — **not**
engine-confirmed; confirmation against the real engine's frame limit is pending (engine
§6 dependency). Until the Stage 6 semver freeze this value is explicitly cheap to change.
To keep it cheap: the cap lives as a **single named constant** (`BATCH_CAP_BYTES` in
`src/core/wire.ts`, a Batch-contract property alongside the envelope shape); the fake's
`emit` check and all boundary fixtures (`test/fake/batch-cap-fixtures.ts`) parametrize on
that constant — changing the value touches exactly one production line plus regenerated
fixtures, nothing else.

## Alternatives Considered

- **Enforce at `Session.flush`** — rejected: puts engine judgment in the SDK, violating
  ADR-0018.
- **Measure raw content bytes** (sum of `content`/`template` field lengths) — rejected:
  ignores envelope and JSON-escaping overhead, under-counts the real wire size (the
  REQ-01.2 fixture proves the flip: a raw-content measurer accepts a batch whose
  serialized size is actually over the cap).
- **Measure `.length`** (UTF-16 code units) — rejected: wrong for multi-byte content, not
  what a byte-oriented transport actually sees on the wire.

## Related

ADR-0017 (normative fake semantics) gained a self-move identity exclusion amendment in
this same Stage 1 hardening pass — see the amendment appended to
`openspec/decisions/0017-normative-fake-semantics-fail-closed.md`.
