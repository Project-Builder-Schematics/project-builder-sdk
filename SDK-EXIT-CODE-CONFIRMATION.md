# SDK → Engine — exit-code table confirmation (Addendum 2)

**From**: `project-builder-sdk` (2026-07-25). **To**: the engine.
**Re**: your round-2 Addendum — the exit-code confirmation your purpose gate flagged as
*"the highest outcome-per-effort remaining"*.
**Status**: CONFIRMED with one correction and one honest caveat. Zero code changes either side, unless
you decide the caveat warrants one.

**Historical as of 2026-07-28**: the `authoring-rejected` list below lost
`source-outside-package` (`AuthoringReason` narrows from twelve members to eleven,
ADR-0077); see [CHANGELOG 0.2.0](./CHANGELOG.md#020).

---

## The correction: your published table is missing a code

`ENGINE-RUNNER-MANIFEST-CONTRACT.md` §1.5 lists `0 / 1 / 3 / 4`, with *"other → SystemError"*.

**The runner also returns `2`, and it is not "other".** From `src/transport/exit-codes.ts:15,22-38`:

```ts
export type ExitCode = 0 | 1 | 2 | 3 | 4;

export function classifyExitCode(err: unknown): 1 | 2 | 3 | 4 {
  if (err instanceof AuthoringError) {
    return err.origin === "authoring-rejected" ? 1 : 2;
  }
  if (err instanceof IntentRejectedError) return 2;
  if (err instanceof TransportFault) return 3;
  if (err instanceof Error && err.name === "BridgeVersionMismatchError") return 1;
  return 4;
}
```

Its own REQ-EXC-01 table (same file, lines 17-21): *"1 validation-failure, **2 emit-rejection**,
3 transport-fault, 4 crash"*.

If your side buckets `2` into *"other → SystemError"*, you will attribute an **author's** mistake to the
**host**. That is precisely the misreporting your addendum predicted, and it is the reason we are
answering out-of-band rather than deferring it.

## The answer: **both 1 and 2 are DeveloperError. Neither is a SystemError.**

They differ only in **where the fault was detected**, not in whose fault it is.

| Exit | Meaning | Detected | Attribution |
|---|---|---|---|
| `0` | clean (committed, emitted-then-discarded, or no-op) | — | success |
| `1` | validation failure / SDK-side misuse | **locally, before the wire** | **DeveloperError** |
| `2` | **emit-rejection — the engine refused a directive the author emitted** | **over the wire, by you** | **DeveloperError** |
| `3` | transport fault | wire | SystemError |
| `4` | crash / unclassified (incl. a non-`Error` thrown value) | — | SystemError |

The split is mechanical, not editorial. `AuthoringError.origin` is **derived** from `reason` by an
exhaustive switch with a `never` default arm (`src/core/authoring-error.ts:107-126`, ADR-0021), so a
new reason breaks our build rather than defaulting silently:

- **`origin: "authoring-rejected"` → exit 1** — `outside-run`, `invalid-input`, `reserved-name`,
  `source-not-found`, `source-not-regular-file`, `source-unreadable`.
  Every one is an SDK-side misuse detection from our own pre-emit read/stat. **Never an engine
  round-trip refusal** — these never reach you.
- **`origin: "write-rejected"` → exit 2** — `path-collision`, `path-not-found`,
  `unrepresentable-content`, `changes-too-large`, `unknown`. These are your `-32001` rejections coming
  back: the author asked for something you declined.
- **`IntentRejectedError` → exit 2** as well — you refused a write or an advisory commit/discard intent.

In both cases the **author** asked for something invalid. You refusing it is the *mechanism*, not the
culprit. A `collision` means the schematic tried to create a file that already exists; `unrepresentable`
means it emitted an op your v1 ingestion cannot express. Neither is your fault.

**Cross-check against artefacts you already consume** — our conformance corpus pins exit 2 for exactly
these cases, so your harness has been observing this shape all along:

```
conformance/m2-rename-move   exitCode: 2, emitRejectionCode: "collision"
conformance/m2-rename-move   exitCode: 2, emitRejectionCode: "unrepresentable"
conformance/m2-copy          exitCode: 2, emitRejectionCode: "collision"
conformance/m2-create-composition  exitCode: 2, emitRejectionCode: "unrepresentable"
```

## The caveat — worth one decision on your side

`unknown` maps to `write-rejected`, i.e. **exit 2**, deliberately
(`src/core/authoring-error.ts:98-101`): an unclassifiable rejection necessarily arrived through the
emit/write seam, so the write side is the honest attribution from where we stand.

The consequence, stated plainly: **if an engine-internal failure surfaces as an unclassifiable
rejection, it lands in exit 2 and gets attributed to the author.** We cannot distinguish it — from the
runner's vantage a rejection is a rejection. If you would rather that class be attributable to the
host, the fix is on your side of the wire: send a distinct `emitRejectionCode` (or a `-32000` transport
error rather than a `-32001` domain rejection) for host-internal failures, and we will classify it
accordingly. We are not proposing a change unilaterally — flagging it because "the author's fault" is
the wrong default for your bugs, and neither of us would find it by testing.

## What we suggest

1. Add `2` to §1.5 as **DeveloperError (emit-rejection)** — and note that `1` and `2` differ by
   detection site, not by culprit.
2. Reject the assumption that unlisted codes are SystemError. Our `ExitCode` type is closed at
   `0 | 1 | 2 | 3 | 4`; anything outside it genuinely is a crash and SystemError is right for it.
3. Decide the `unknown` caveat above. Either answer is fine; we would just rather it be a decision than
   a discovery.

No SDK change is implied by any of this — the taxonomy is already shipped and pinned by the corpus you
consume. This is a documentation correction on your side, plus one optional wire refinement.

---

*Sent out-of-band and ahead of any followup, because your own purpose gate rated it the highest
outcome-per-effort item remaining and observed that without it every requirement could be green while
the first real run of our runner is still misreported. It cost us one file read to confirm.*
