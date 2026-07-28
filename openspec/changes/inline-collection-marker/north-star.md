# North Star: `inline-collection-marker`

**Checkpoint**: foresight (post-design, pre-slice) · **Triage**: L · **Verdict**: `aligned`
**Steward**: blind launch — formed from triage / proposal V2 / spec V3 / design V2 only
**Date**: 2026-07-28

---

## 1. This is what we're going to do

In outcome terms, not implementation terms:

> **A schematic author whose collection lives entirely inside `project-builder.json` can run
> their factories.** Today they cannot run *any* of them. After this change, the SDK stops
> asking "where is this package's containment ceiling?" — a question it was never able to
> answer correctly — and simply resolves what a factory reads relative to the directory the
> factory declared. Where a path-carrying directive is *allowed* to land stops being the
> SDK's claim to make.

## 2. Here's how it fits

Three seams move; no layer is added and no dependency direction changes.

- **Bootstrap** (`src/core/context.ts`): the pre-`als.run` chokepoint drops from three reads
  to two. The upward `collection.json` hunt disappears; `packageDir` becomes the sole run anchor.
- **Scaffold leaf** (`src/scaffold/`): `containment.ts` (ceiling + realpath comparison) is
  replaced by `path-guards.ts` (lexical screen + IO hygiene). Same leaf, same one-way direction
  (FIT-22 holds), narrower job.
- **Public contract**: `AuthoringReason` narrows 12 → 11. `source-outside-package` retires with
  the concept that defined it.

The responsibility itself relocates *out of this repo*: by-reference paths become the engine's
apply-time problem (REQ-BRC-02); by-value bytes have no boundary control on either side, stated
plainly rather than implied. ADR-0077 records this, superseding ADR-0046 and ADR-0067.

## 3. Here's the outcome we're chasing

**The hurting person**: a schematic author on an inline-collection CLI project.

**Their reality today** — verified directly against source, not taken from the artefacts:

`src/core/context.ts:378` runs `resolvePackageRoot(resolvedDir)` unconditionally whenever
`defineFactory(fn, { packageDir })` is given a `packageDir` — the documented standard form.
`resolvePackageRoot` (`:199-217`) walks upward for `collection.json`; on reaching the filesystem
root with no hit it throws `invalid input: no collection.json found at or above <dir> — cannot
resolve the containment root for this factory's package` (`:184-189`).

Two facts sharpen the pain beyond the problem statement's own wording:

1. It fires **before the factory body executes** — nothing the author wrote ever runs.
2. It fires **even for a factory that reads no files at all**. Declaring `packageDir` is enough.
   This is not "file reads are broken"; it is "the supported mode does not start".

**Their reality after**: the body runs; all three read verbs work; the marker is never sought.

## 4. Result → problem map

| Plan element | Serves the stated pain? |
|---|---|
| Delete `resolvePackageRoot` + walk + fail-loud; `packageAnchors` → `{packageDir}` (REQ-MFB-01) | **Directly — this IS the outcome.** Everything else is consequence or policy. |
| Delete `containment.ts` → `path-guards.ts`; drop `packageRoot`/`realCeiling` threading | **Forced consequence.** Ceiling machinery cannot typecheck once the anchor it consumes is gone. |
| Re-homes R1–R7 (IO hygiene, destination guard, walk-root no-echo) | **Protective, not additive.** Stops the deletion from silently taking guards existing authors already depend on (`source-not-found`, no-echo messages). |
| Union 12 → 11 + FIT-04 baseline + CHANGELOG (a)(b)(c) | **Forced public consequence**, honestly shipped. |
| Ruling-5 unified lexical screen, three call sites | **Not required by the pain.** Deliberate policy: one predicate rather than a scattered residue. Author-visible effect for the inline author: none. |
| fit-43 / fit-44 / fit-45 | **Durability of the outcome**, not the outcome. Keeps the ceiling from regrowing and the surviving reasons from becoming unmintable. |
| 7 spec families + ADR-0077 | **Zero value to the hurting author**; mandatory under this repo's own spec discipline. |
| Cross-repo engine handoff (Addendum 3) | **Serves a different audience** (engine team). Its value activates outside this change — see Deferred. |
| Ruling 8 walk.ts recursive guard, ELOOP, NUL-byte, degenerate-string scenarios | **Conscious ride-alongs** — pre-existing gaps, unrelated to this pain. Labeled as such in the artefacts. |
| Step 0: restore REQ-AEC-10/11/12 into the main spec | **Forced prerequisite — premise verified true**: `rg REQ-AEC-1[012] openspec/specs/authoring-error-contract/spec.md` returns zero; the archived source has 11 hits. Without step 0 the MODIFIED blocks cannot apply. |

**Outputs-without-outcome scan**: no element produces an artefact that serves nobody. But the
work splits roughly **one part closing the reported pain, nine parts serving other audiences**
(repo consistency, engine team, future maintainers). That is legitimate and honestly labeled —
it is not disguised — but it is the fact behind conscience question Q1.

## 5. Simulated journey — the author, after this lands

Layout (no `collection.json` anywhere, on any ancestor):

```
my-project/
  project-builder.json          # whole collection inline
  schematics/add-endpoint/
    factory.ts
    files/controller.ts.tpl
    assets/logo.svg
```

`factory.ts`:

```ts
export default defineFactory(async (o) => {
  create({ templateFile: "files/controller.ts.tpl", to: "src/api/controller.ts" });
  scaffold({ from: "files", to: "src/api" });
  copyIn("assets/logo.svg", "public/logo.svg");
}, { packageDir: import.meta.dir });
```

**Before**: `checkReservedNames` ✓ → `validateAtRunBoundary` ✓ → `resolvePackageRoot` walks
`add-endpoint` → `schematics` → `my-project` → … → `/` → throws. Body never entered. Author sees
a message about a "containment root" they never configured and cannot create in inline mode.

**After**: two ordered bootstrap reads → body runs.
`create` → lexical screen (no `..`, not absolute) → `statSourceForRead` → regular file → bytes
emitted by value. `scaffold` → screen on the root `from` *before* enumeration → walk → per-entry
classify. `copyIn` → destination screen → source stat → by-reference directive on the wire.
Commit. This is REQ-MFB-01.2, and its test carries an explicit
`existsSync(join(dir,"collection.json")) === false` assertion at **every** ancestor up to the
filesystem root, with its own `mkdtemp` — it cannot pass vacuously via a marker-seeding helper.

**What the author must still not do**: `templateFile: "../shared/base.txt"` still rejects. The
reason string changes (`source-outside-package` → `invalid-input`), visible only to someone
switching on `err.reason`. A missing file still says `source-not-found` with a package-relative
path.

**Who does not regress**: an author who *does* have a `collection.json` (non-inline mode). Their
runs behave identically; the file is simply no longer read.

**Where the journey still bends**: an author who reaches outside the package through an
*in-package symlink* used to be rejected; now they succeed silently. For the inline author this
is strictly permissive — no new failure. It is a real posture change, ratified in REQ-PSH-04 and
asserted *positively* (REQ-PSH-04.1), so it cannot regress unnoticed.

## 6. Promise ↔ delivery drift (proposal V2 → design V2)

No material gap. The design delivers the user-seat criterion, the three-call-site screen, the
re-home table, the pre-declared `breaking` impact, and the R5/R6 rationale rewrite. Two small
items to carry forward so nobody chases a phantom:

- **Stale success criterion.** The proposal's Success Criteria still asks for a CHANGELOG entry
  covering "ruling-5 narrowing (with migration guidance)". The proposal's *own* correction block
  and spec REQ-IPF-01.4 both establish that **no such narrowing exists** (literal `..` was
  already rejected unconditionally by `isLexicallyEscaping`). Design's entry (b) quietly gets
  this right ("a reason change, not a new rejection"). Slice/verify must not manufacture
  migration guidance for a behaviour that does not change.
- **fit-43 clause (e) is a handoff, not a test.** The `openspec/specs/` sweep was moved out of
  the fitness function (it would ship permanently red) into a post-archive-sync criterion owned
  by `package-root-containment` and executed by `sdd-archive`. Correct call — but it means one
  falsifiable criterion now depends on the very last step of the pipeline running it. Recorded
  as deferred check D2.

Naming drift only (not a gap): `resolveSourceForRead`/`source-resolve.ts` → `statSourceForRead`/
`path-guards.ts`.

## 7. Is there a shorter path to the same outcome?

**Yes, and it was considered and rejected on the record.** "Optional marker, fail-open" — stop
throwing when the walk reaches the root — closes the reported bug in roughly five lines and one
slice, with near-zero blast radius, no public break, and no cross-repo handoff. The author's
experience is **identical** under either path.

ADR-0077 §I rejects it: *"a boundary that silently disappears when a file is absent is worse than
no boundary: it reads as a control in review and is not one."* That is a sound engineering
argument, and the owner has now chosen removal over widening **twice** (the re-triage explicitly
supersedes the dual-marker direction). The steward does not relitigate a ratified decision — but
foresight is the last cheap moment to reverse it, so it is filed as Q1 below rather than buried.

## 8. Reckoning criteria (all evaluable pre-archive)

| # | Criterion |
|---|---|
| R1 | REQ-MFB-01.2 green — three verbs commit byte-exact with no `collection.json` on any ancestor |
| R2 | `rg -F 'no collection.json found at or above' src/` returns **zero** hits |
| R3 | REQ-MFB-01.1 sentinel green — the thrown value IS `"body-ran"` (body reached) |
| R4 | REQ-MFB-01.3 — `Object.keys(packageAnchors)` deep-equals `["packageDir"]`, never `toBeUndefined()` |
| R5 | No re-homed guard silently lost — REQ-PSH-01/02/03 and REQ-IPF-01/02/03 green **driven once per verb (three cases)**, fit-44 proving the surviving `source-*` reasons stay mintable |
| R6 | fit-43 and fit-45 green — the ceiling cannot regrow unnoticed |
| R7 | Public break shipped honestly — union 11, FIT-04 baseline in the **same commit**, CHANGELOG (a)(b)(c) + preamble amendment |
| R8 | The author is told the new rule — `docs/authoring-verbs.md` carries the verbatim rule and the "what the boundary is now" paragraph; `SECURITY.md` carries the v1 trust model |

## 9. Deferred value — NOT gate criteria

| # | Value | Activates | Check then |
|---|---|---|---|
| D1 | Engine team absorbs Addendum 3 (no SDK-side realpath/case-fold; Windows UNC/drive-relative forms unscreened) | Engine's next REQ-BRC-08 canonical-form work | `openspec/pending-changes.md` rows 268-270 dispositioned |
| D2 | fit-43 clause (e) — `rg 'package-root-containment\|REQ-PRC-\|source-outside-package' openspec/specs/` returns zero | Archive spec-sync commit | Executed by `sdd-archive`, not by the test suite |
| D3 | A real inline-collection project runs against a published `0.0.0-dev.<sha>` build | Next consumer install | The temp-dir test asserts equivalence *by construction*; only a real run confirms it |

## 10. Conscience questions — escalated, not answered

**Q1 — SIGNIFICANCE (ratify now, pre-sunk-cost; reckoning will NOT re-ask it).**
The pain closes under either path. The minimal path is ~5 lines and one slice; the chosen path is
~40 files, 49 scenarios, three new capabilities, seven touched spec families, a public breaking
change and a cross-repo handoff. The extra effort buys structural correctness and the removal of
a control that would otherwise silently no-op — **not** anything the hurting author can perceive.
Do you ratify that this is worth roughly an order of magnitude more work than closing the reported
bug? Your answer becomes the commitment reckoning holds delivery against.

**Q2 — PROBLEM-FIT PREMISE (highest stakes).**
The entire case for *deleting* rather than *widening* rests on "the engine's apply-time
re-derivation (REQ-BRC-02) is the real control, and it is LIVE" — owner ruling 1, asserted
cross-repo. **None of this change's 49 scenarios verifies it.** The design's own handoff warns
that if the engine's re-derivation is lexical rather than realpath-based, in-package symlinks now
reach apply *completely unfiltered* — a case the SDK genuinely did catch before. Has anyone
confirmed the engine re-derives today, and on what basis (realpath or lexical)? If the premise is
unverified, this change is strictly more permissive in a self-flagged security domain with no
verified compensating control anywhere.

**Q3 — USABILITY OF THE HANDOFF.**
The engine-team deliverable is a written addendum in `CONFORMANCE-CORPUS-HANDOFF.md`. Writing it
is pre-archive verifiable; a human on the engine team reading and acting on it is not. Is that
channel one that actually works today, or does the value stop at the file edit?

**Q4 — SCOPE (low stakes; recommendation attached).**
Ruling 8's walk.ts recursive guard, ELOOP coverage, and the NUL-byte / degenerate-string
scenarios are labeled conscious ride-alongs — pre-existing gaps unrelated to this pain, riding a
change that is already a security-flagged L. *My lean: keep them* — they touch code already being
edited, and splitting would cost more ceremony than the fix. One word settles it.

---

**Verdict**: `aligned` — the design, executed as written, resolves the stated pain, and the
pain-closing element is pinned by a red-today test that mirrors the reported situation exactly.
The conscience questions are filed for ratification, not as blockers.
