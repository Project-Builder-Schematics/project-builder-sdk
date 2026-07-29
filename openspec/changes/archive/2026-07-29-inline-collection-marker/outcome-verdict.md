# Outcome Verdict: `inline-collection-marker`

**Checkpoint**: reckoning (pre-archive) · **Triage**: L
**Verdict**: `delivered-pending-activation`
**Steward**: blind launch — formed from triage / north-star / proposal / delta specs / the raw
delivered tree, verified first-hand against a running suite. No orchestrator transcript.
**Date**: 2026-07-29

---

## 1. Our objective was THIS

From `triage.md`'s `problem_statement`:

> SDK factory runs die with `AuthoringError invalid-input: "no collection.json found at or
> above <dir>"` when the consuming project uses the CLI's inline-collection mode (whole
> collection inside `project-builder.json` at the project root; no `collection.json` ever
> exists on disk). […] Why now: hard blocker for every inline-collection project, discovered
> in real use.

The North Star restated it in outcome terms: *a schematic author whose collection lives
entirely inside `project-builder.json` can run their factories.*

## 2. Did we deliver it? Here is WHERE

Every claim below was re-derived first-hand, not read off the verify report.

| # | Reckoning criterion (north-star §8) | Evidence | |
|---|---|---|---|
| R1 | REQ-MFB-01.2 green — three verbs commit with no `collection.json` on any ancestor | `test/scaffold/inline-collection.test.ts:51-107`; its own `mkdtemp`, `assertNoAncestorMarkerAnywhere` walks to the filesystem root asserting `existsSync(...collection.json) === false` at every level — cannot pass vacuously | ✅ |
| R2 | `rg -F 'no collection.json found at or above' src/` returns zero | Zero hits, re-run | ✅ |
| R3 | REQ-MFB-01.1 sentinel — the thrown value IS `"body-ran"` | `inline-collection.test.ts:36-48` | ✅ |
| R4 | `packageAnchors` deep-equals `["packageDir"]` | `src/core/context.ts:71` types it `{ packageDir: string }`; `:342` constructs it; no `packageRoot`/`realCeiling` survives anywhere in `src/` | ✅ |
| R5 | No re-homed guard silently lost | `src/scaffold/path-guards.ts` (173 lines, replacing containment.ts's 291) carries all three guards; `source-not-found` / `source-not-regular-file` / `source-unreadable` intact and minted through ONE helper; fit-44 reachability green | ✅ |
| R6 | fit-43 / fit-45 green — the ceiling cannot regrow | `test/fitness/fit-43-no-ceiling-regrowth.test.ts`, `fit-44-…`, `fit-45-single-lexical-predicate.test.ts` all present and green in the full run | ✅ |
| R7 | Public break shipped honestly — union 11, FIT-04 baseline in the SAME commit, CHANGELOG (a)(b)(c) + preamble amendment | Union is 11 members, `source-outside-package` gone (`src/core/authoring-error.ts:73-84`); `b66900e` carries `authoring-error.ts` **and** `dts-baseline/core.authoring-error.d.ts` + `package.json` 0.2.0 in one commit; CHANGELOG `## 0.2.0` carries entries (a)(b)(c)(d) with amended preamble | ⚠️ **partial — see §4 D1** |
| R8 | The author is told the new rule | `docs/authoring-verbs.md:15-35` carries the verbatim rule and the "What the boundary is now" paragraph; `SECURITY.md` § "Package-local read trust posture (v1)" carries the v1 trust model with the per-path-class breakdown | ✅ |

**Suite, first-hand**: `bun test` → **2440 pass / 0 fail** across 201 files. (A first run showed
1 failure — `REQ-RXD-08.1` react-conformance, 5.3s — which did not reproduce on two subsequent
runs and passes in isolation. This is the contention flake the verify report already disclosed;
it is a pre-existing react-dialect timing artefact, not this change's.)

**The pain is closed.** The mechanism that produced the reported error does not exist in the
tree. The test that proves it mirrors the reported layout by construction and asserts its own
precondition to the filesystem root.

## 3. The user journey, simulated

**The hurting author — inline-collection project, first run on 0.2.0.** They call
`defineFactory(fn, { packageDir: import.meta.dir })`. Bootstrap does two ordered reads and
enters the body. `create({ templateFile })`, `scaffold({ from })`, and `copyIn` each pass a
lexical screen and a `statSync`, and commit. Nothing looks for a marker. **This works today.**

**The existing 0.1.0 author, on upgrade.** Four things can bite them:

1. **Union narrowing** — an exhaustive `switch (err.reason)` with a `case "source-outside-package"`
   stops compiling. TypeScript points at it; CHANGELOG entry (b) tells them to delete the arm.
   *Migration path adequate.*
2. **Reason change** — a literal `..` or absolute source now reports `invalid-input` instead of
   `source-outside-package`. It was **always** rejected; only the label moved. Documented in (b),
   and correctly framed as "a reason change, not a new rejection". *Adequate.*
3. **Root-symlink rejection (ruling 16)** — `scaffold({ from })` where `from`'s final component is
   a symlink now hard-rejects instead of following. This is a genuine new failure for anyone
   symlinking to a shared templates directory. CHANGELOG entry (d) carries it with migration text,
   correctly scoped to the final-component-only reach. *Adequate.*
4. **Degenerate `from` rejection (ruling 17)** — `scaffold({ from: "" | "." | "./" })` used to
   silently walk the entire package; it now rejects `invalid-input`. **This is a new breaking
   rejection with NO CHANGELOG entry.** It is documented in `docs/authoring-verbs.md`, so the
   author is not left blind — but the migration channel the spec itself designated for the real
   consumers (engine repo, conformance corpus) does not mention it. *See §4.*

**Who does not regress**: an author who has a real `collection.json`. Their runs are identical;
the file is simply no longer read.

## 4. Drift — promise ↔ delivery

**D1 — the CHANGELOG stopped tracking delivery at round 2 (the material finding).**

This change *established its own precedent* that this class of gap is a defect: judgment-day
round 2 found that ruling 16's breaking rejection had no CHANGELOG entry, and treated it as
serious enough to amend a signed spec — `package-dir-run-anchor` REQ-MFB-02 was rewritten from
three entries to **"exactly FOUR entries"**, and `419fff2` added entry (d).

Round 3 (`a4f90c9`) then landed **ruling 17** — another breaking, author-visible rejection — and
did **not** repeat the fix. It amended entry (d)'s wording and stopped. The CHANGELOG still says
four; the tree now carries five. REQ-MFB-02's literal text ("exactly FOUR") passes, which is
precisely why no automated gate caught it: the requirement pins a *count*, and the count is
still right.

Round 3 also shipped several further observable changes with no CHANGELOG treatment. The owner
should rule on which of these warrant entries:

- a per-entry `rename` value carrying a literal `..` now rejects (previously normalized away)
- `include`/`exclude` are now shape-validated at entry (a non-string element used to no-op)
- an escaping `to` outside a run now reports `outside-run`, not `invalid-input` — an `err.reason`
  change of exactly the class entry (b) exists to document
- intra-scaffold collision detection now keys on the normalized destination (new rejections)
- the walk's 10,000-entry bound now counts every dirent, not just files — a directory-heavy
  package that scaffolded successfully before may now hit the bound

Ruling 17 is the clearest: a silent-success → hard-rejection transition. Cost to close: one
CHANGELOG paragraph, and REQ-MFB-02's count amended four → five.

**D2 — the foresight memo's two carry-forwards, both honoured.** No migration guidance was
manufactured for the non-existent ruling-5 "narrowing" (entry (b) correctly says "a reason change,
not a new rejection"). fit-43 clause (e) remains a handoff to `sdd-archive`, as designed.

**No other drift.** The design's re-home table, three-call-site screen, `breaking` architecture
impact, ADR-0077 superseding 0046/0067 with dated headers, and the release vehicle all landed as
promised. Naming drift only (`statSourceForRead` / `path-guards.ts`) — already noted at foresight.

## 5. Cross-repo dimension — is the engine dependency honestly documented?

The outcome rests on REQ-BRC-02: the engine re-derives its own ceiling at apply time. Foresight
filed this as Q2, the highest-stakes question. It was **partially answered**.

**What is now on the record** (`specs/by-reference-copy-wire/spec.md` § Seam Obligations Status):
the owner *verified first-hand* on 2026-07-28 that the engine's apply process implements ceiling
validation — it validates the resolved path and rejects on escape. The prior ENGINE-GATED marker
and `pending-changes.md` row 268 were stale, not merely "scheduled". This is a narrow, dated,
evidenced correction — explicitly **not** a blanket "everything shipped" claim; REQ-BRC-08 stays
gated. That is honest practice, and it converts the change's central premise from assertion to
verification.

**What is still unknown, and matters**: the verification records *that* the engine validates,
not *on what basis*. Foresight asked "realpath or lexical?" — that half is unanswered. It is
load-bearing: if the engine's re-derivation is lexical, in-package symlinks now reach apply
**completely unfiltered**, a case the SDK genuinely did catch before this change.

**Is it documented for consumers?** Mixed, and worth the owner's eye:

- `CONFORMANCE-CORPUS-HANDOFF.md` Addendum 3 states the risk **verbatim and plainly** to the
  engine team — "if your re-derivation is itself lexical rather than canonicalization-based,
  in-package symlinks now reach you completely unfiltered", plus the unscreened Windows
  UNC/drive-relative forms. Nothing is hidden from the audience that can act on it.
- `SECURITY.md`, however, tells a consumer two things in adjacent bullets: "Path-carrying
  directives are re-checked by the engine at apply time (REQ-BRC-02, **verified live**)" and
  "Symlink escape from `packageDir` is an accepted, documented residual". A reader can
  reasonably fuse those into "the engine catches the symlink case" — which is exactly what
  nobody has confirmed. The outcome does not *silently* rest on an unverifiable claim, but
  SECURITY.md's phrasing is more settled than the underlying evidence.

**Steward's read**: this is not concealment — it is a confidence gradient that flattened as it
moved from the handoff (precise) to SECURITY.md (summarized). One qualifying clause fixes it.

## 6. Outputs without outcome?

The foresight memo predicted the shape honestly and it held: **roughly one part closes the
reported pain, nine parts serve other audiences** (repo spec discipline, the engine team, future
maintainers). No element produces an artefact serving nobody — but the ratio is real, was
disclosed pre-build, and was ratified at Q1 pre-sunk-cost. Reckoning does not re-open worth.

What the extra nine parts *bought*, concretely: three fitness guards that prevent the ceiling
from regrowing, and — most valuable in hindsight — the adversarial-review surface that caught
**ruling 16 and ruling 17**, two real silent-escape bugs (`from: "link/"` enumerating outside the
package; `from: "."` mirroring the whole package) that predate this change and would have
survived the minimal five-line path untouched. The heavier path found bugs the cheaper path
would have left in the tree. That is a defensible return on the Q1 commitment.

## 7. Deferred value (from north-star §9) — not gate criteria

| # | Value | Activates | Check then | Status |
|---|---|---|---|---|
| D1 | Engine team absorbs Addendum 3 (no SDK-side realpath/case-fold; Windows UNC/drive-relative unscreened) | Engine's next REQ-BRC-08 canonical-form work | `openspec/pending-changes.md` rows 268-270 dispositioned | Addendum 3 **written** (`CONFORMANCE-CORPUS-HANDOFF.md:189-216`), NOTIFICATION status, non-blocking; absorption unverifiable pre-archive |
| D2 | fit-43 clause (e) — `rg 'package-root-containment\|REQ-PRC-\|source-outside-package' openspec/specs/` returns zero | Archive spec-sync commit | Executed by `sdd-archive` | **Pending** — 7 spec files still carry the vocabulary (85 hits); correct pre-archive, must be zero after sync |
| D3 | A real inline-collection project runs against a published `0.0.0-dev.<sha>` build | Next consumer install | The temp-dir test asserts equivalence *by construction*; only a real run confirms it | **Pending** — the reason this verdict is `-pending-activation` |

## 8. Verdict

**`delivered-pending-activation`.**

Every pre-archive-evaluable criterion the foresight memo committed to (R1–R8) passes on
first-hand evidence, with R7 carrying the D1 shortfall in §4. The reported pain is closed by a
test that cannot pass vacuously, and the mechanism that caused it no longer exists. The value
that cannot be evaluated at this checkpoint — a real inline-collection project running against a
published build (D3), and the engine team absorbing Addendum 3 (D1) — is deferred by design, not
by omission, and re-opens as an `outcome-check` followup.

This is not code that merely passes tests. It closes a hard blocker, and the adversarial surface
the L-weight bought found two real escapes along the way.

## 9. Conscience questions — escalated, not answered

**Q1 — CHANGELOG completeness (recommendation attached, blocking-cheap).**
Ruling 17's degenerate-`from` rejection is a silent-success → hard-rejection break with no
CHANGELOG entry, in a change whose own signed spec was amended at round 2 *specifically because
that gap is a defect*. Archive freezes the release bundle. **My recommendation: add the fifth
entry and amend REQ-MFB-02 four → five before archive** — one paragraph, and it keeps the
precedent this change set for itself. Also worth your ruling: do the other five round-3
behaviour changes listed in §4 warrant entries, or are they below the line?

**Q2 — USABILITY (human-only).**
The temp-dir test proves the mechanism. Has anyone pointed a *real* inline-collection project at
this tree — even a linked local build — and watched a factory run end-to-end? If not, D3 is the
honest state and this verdict is right. If yes, say so and it upgrades to `delivered`.

**Q3 — SECURITY.md phrasing on the engine premise (§5).**
"REQ-BRC-02, verified live" is true and evidenced — but the verification did not establish
*whether* the engine re-derives by realpath or lexically, and that distinction decides whether
the in-package-symlink residual is caught anywhere at all. Should SECURITY.md carry a qualifying
clause (e.g. "the basis of the engine's re-derivation — canonicalized vs lexical — is not
established SDK-side; see Addendum 3"), or do you consider the handoff's precise wording
sufficient coverage for consumers?

**Q4 — Residual acceptance (human-only, ratification not analysis).**
Post-rulings 16/17, the standing residual is: **mid-path symlinks** (`from: "link/sub"`) in
`scaffold`, and any in-package symlink under `create({templateFile})` / `copyIn`, reach the
engine unscreened — with the engine's catching basis unestablished per Q3. This is documented in
three places and asserted positively in REQ-PSH-04 so it cannot regress unnoticed. Do you ratify
it as the accepted v1 posture for the 0.2.0 release?

---

**Note for the orchestrator**: significance (foresight Q1) is NOT re-asked here — it was ratified
pre-sunk-cost and delivery did not drift from that commitment. On `delivered-pending-activation`,
archive proceeds AND registers ONE `outcome-check` followup in `project/pending-changes` covering
D1 + D3, so the outcome question re-opens after activation instead of dying at archive.
