# Delta for Conformance Corpus Registry

**Spec version**: V2
**Status**: draft
**Change**: `copy-copyin-conformance-fixtures`

**V1 → V2 (council feedback incorporated, 2026-07-22)**: owner ruling extends `m2-copyin` to 5
engine-plane cases (`dest-dir-twin` added) — branch-held totals become 7 fixtures / 23 cases
(`main` stays 6 fixtures / 18 cases). REQ-CCR-05 gains: (a) an explicit honesty note that its
own derived-sum check is an orphan/consistency guard, NOT the load-bearing case-shape guard
(that's `conformance-fixtures` REQ-CFX-05..09/15/16); (b) a verification-cadence note on the
monotonic-floor scenario mirroring REQ-CCR-04's (PR-gate/review check, not a `bun test`
assertion — `fit-40` is worktree-only and cannot read git history); (c) a new scenario
requiring deletion of dead hardcoded checkpoint gates. REQ-CCR-09 gains: a concrete 5-item
un-hold re-validation checklist (cross-referencing `conformance-fixtures` REQ-CFX-17
explicitly) and a new scenario pinning the held branch's hold-time baseline (green in
isolation at 7 fixtures / 23 cases) so "fully authored" is a testable claim. All REQ-IDs
preserved; no IDs added or removed relative to V1 in this file.

## ADDED Requirements

### REQ-CCR-09: `m2-copy`/`m2-copyin` Landing Sequence — Branch-Hold Boundary, Two Done-Definitions (owner ruling 4, extended 2026-07-22)

This change bundles two fixtures with DIFFERENT landing destinies, mirroring REQ-CCR-03's
PR#1/PR#2 precedent: `m2-copy` MUST land on `main` in a commit that ALSO lists it in
`corpus.json#fixtures` (REQ-CCR-04 atomicity) and MUST NOT depend on any `m2-copyin` artefact —
its PR is independently mergeable. `m2-copyin` MUST be fully authored (manifest, factory,
`assets/`, `expected/`, now 5 cases per the 2026-07-22 owner-ruling extension adding
`dest-dir-twin`) in the SAME change, but its landing commit MUST stay on an UNMERGED branch/PR —
`corpus.json#fixtures` on `main` MUST NOT list `m2-copyin` until the engine's `copyIn`
wire-inclusion is in flight (owner-accepted un-hold trigger).

Two SEPARATE done-definitions apply — neither substitutes for the other:

| | `m2-copy` (main) | `m2-copyin` (branch-held) |
|---|---|---|
| Landing | Merged to `main`, own commit, own `corpus.json` entry | Authored + committed on a named branch; commit NOT merged |
| `corpus.json` on `main` | Lists `m2-copy` | Does NOT list `m2-copyin` |
| `fit-40` on `main` | Green at the 6-fixture / 18-case checkpoint (REQ-CCR-05) | N/A on `main` — verified in ISOLATION on its own branch at 7 fixtures / 23 cases (REQ-CCR-09.4) |
| Un-hold trigger | N/A — already done | Engine `copyIn` wire-inclusion in flight |
| Re-validation before un-hold | N/A | The 5-item checklist below |
| Pending-changes registration at archive | N/A — delivered | Registers as an authored-but-held debt row (distinct debt type from a normal followup): branch name, un-hold trigger, the checklist below |

**Un-hold re-validation checklist (concrete, 2026-07-22)** — enumerated so an un-hold executor
reading only this debt row does not miss a step:

1. Rebase and re-validate `m2-copyin`'s commit against the THEN-current `conformance/` schema
   and REQ set (schema/REQs may have changed while held).
2. `fit-40` green at the THEN-current manifest-derived checkpoint (REQ-CCR-05) — not
   necessarily the 7-fixture/23-case figure frozen at authoring time, which may itself have
   shifted if further fixtures landed while `m2-copyin` was held.
3. Add `copyIn` to ALL `conformance-fixtures` REQ-CFX-17 sync sites (the README sentence, the
   DO-NOT-COPY clause (e) text, AND its regex) IN the un-hold commit — cross-referenced
   explicitly here because an un-hold executor reading only this row, not REQ-CFX-17 itself,
   must not miss it.
4. Confirm the engine's `copyIn` wire-inclusion is ACTUALLY in flight (the un-hold trigger
   itself) before merging.
5. Re-verify the two owner-pinned-but-engine-unconfirmed rejection codes against ACTUAL engine
   behaviour before treating them as settled: `m2-copy`'s `missing-source-twin`
   (`"not-found"`) AND `m2-copyin`'s `dest-dir-twin` (`"collision"`) — both are owner-confirmed
   CODE-READING declarations (ruling 3 / its 2026-07-22 extension), not yet
   engine-harness-proven.

#### Scenario REQ-CCR-09.1: m2-copy's PR never references an m2-copyin artefact

- GIVEN `m2-copy`'s merge commit to `main`
- WHEN its diff and factory imports are inspected
- THEN nothing under `conformance/m2-copyin/` is referenced or required for `m2-copy` to
  build/test green

#### Scenario REQ-CCR-09.2: m2-copyin's commit stays unmerged, corpus.json unchanged on main

- GIVEN the branch carrying `m2-copyin`'s full artefact set
- WHEN `main`'s `corpus.json#fixtures` is read
- THEN it does NOT list `m2-copyin` — the branch commit is not merged

#### Scenario REQ-CCR-09.3: Archive registers m2-copyin as authored-but-held debt, with the checklist attached

- GIVEN this change reaches `sdd-archive`
- WHEN `project/pending-changes` is reviewed
- THEN it carries an explicit row for `m2-copyin`: branch name, un-hold trigger (engine
  `copyIn` wire-inclusion in flight), AND the 5-item re-validation checklist above (verbatim
  or by reference) — never omitted as if `m2-copyin` were simply done

#### Scenario REQ-CCR-09.4: The held branch commit is independently testable at authoring time

- GIVEN `m2-copyin`'s branch commit, in isolation, before any un-hold
- WHEN `fit-40` runs against THAT branch's worktree
- THEN it is GREEN at 7 fixtures / 23 cases total (5 fixtures / 12 cases pre-existing +
  `m2-copy`'s 6 + `m2-copyin`'s 5) — "fully authored" is a TESTABLE claim distinguishing held
  DEBT (complete, verified, merely gated on timing) from unfinished work (which would fail
  this check)

## MODIFIED Requirements

### REQ-CCR-05: Corpus-Wide Numerics — Manifest-Derived Cadence, Monotonic Floor, and Retirement of Dead Hardcoded Gates

The corpus's fixture/case inventory check MUST be DERIVED FROM `corpus.json#fixtures`'s own
declared list — every listed id MUST have a complete, landed artefact set, and 0 fixture
directories under `conformance/` may exist without a matching `corpus.json#fixtures` entry (0
orphan directories). Both the fixture COUNT and the total case COUNT MUST be computed from the
CURRENTLY-landed manifest set at check time — NEVER asserted as a hardcoded absolute literal —
so the check stays green at every landing checkpoint without a spec/test edit merely to update a
number (pending-changes row 502: "Monotonic fixture floor ... + derive absolute case counts from
the manifest set instead of a hardcoded literal"). Additionally, `corpus.json#fixtures.length`
MUST NOT DECREASE across the corpus's commit history (monotonic floor) — a shrinking fixture
count is always a hard failure, never a legitimate state. Any hardcoded absolute-count
early-return gate left over from a prior checkpoint scheme (e.g. an `if
(corpus.fixtures.length !== N) return` guard) MUST be DELETED, not left in place as vacuous
dead code that can never go RED.

**Honesty note on what REQ-CCR-05.1 actually proves (added V2, QA)**: the manifest-derived sum
check (REQ-CCR-05.1) compares the corpus's OWN declared case counts against ITSELF — it is an
orphan/consistency guard (nothing is uncounted, nothing double-counts), and by construction it
CANNOT fail RED on a case-count-shape drift (e.g. an author quietly deleting a twin case). The
per-fixture behavioral-contract blocks (`conformance-fixtures` REQ-CFX-05 through REQ-CFX-09,
REQ-CFX-15, REQ-CFX-16) are the LOAD-BEARING guard against that: they pin each case's exact
name/outcome/transcript shape and go RED if any is altered or missing. REQ-CCR-05 only proves
the inventory is internally consistent, never that any individual case is behaviorally correct.

Known checkpoints to date: PR#1 (1 fixture / 2 cases), PR#2 (5 fixtures / 12 cases), THIS
change's `m2-copy` landing on `main` (6 fixtures / 18 cases — `m2-copyin`'s 5 cases, extended
from 4 by the 2026-07-22 owner-ruling addition of `dest-dir-twin`, are AUTHORED but branch-held
per `conformance-fixtures` REQ-CFX-17/REQ-CCR-09, and MUST NOT be counted in `main`'s inventory
until its own un-hold commit lands — a future checkpoint of 7 fixtures / 23 cases this change
does not itself reach).

(Previously: pinned an ABSOLUTE hardcoded assertion — exactly 5 fixtures / 12 cases — as a
POST-PR#2 gate distinct from the derived inventory check. This change REMOVES the hardcoded
absolute assertion entirely in favor of a fully manifest-derived count PLUS the monotonic-floor
invariant PLUS mandatory deletion of dead early-return gates, so no future fixture landing —
including `m2-copyin`'s eventual un-hold at 7 fixtures / 23 cases — requires another
literal-count edit or leaves stale dead code behind. V2 also adds the honesty note above
distinguishing this REQ's orphan/consistency role from REQ-CFX's load-bearing behavioral role,
per QA council feedback.)

#### Scenario REQ-CCR-05.1: Derived case count is an internal-consistency check, not a behavioral guard

- GIVEN whatever set of fixtures `corpus.json#fixtures` CURRENTLY lists (1, 5, 6, or 7, as the
  corpus grows)
- WHEN every listed fixture's `manifest.json#cases` is counted
- THEN the sum equals the DERIVED total for that exact set — this proves the inventory is
  self-consistent; it does NOT prove any individual case's outcome/transcript shape is correct
  (that is `conformance-fixtures` REQ-CFX-05..09/15/16's job)

#### Scenario REQ-CCR-05.2: No directory exists outside the registry

- GIVEN `conformance/` on disk
- WHEN every subdirectory is compared against `corpus.json#fixtures`
- THEN no subdirectory is absent from the list (0 orphan directories) — holds at every
  checkpoint

#### Scenario REQ-CCR-05.3: Each checkpoint is evaluated only against its own derived count

- GIVEN any landed checkpoint (e.g. the commit that closes PR#1, or the commit that lands
  `m2-copy`)
- WHEN the inventory-derived check runs at THAT commit
- THEN it passes using that commit's OWN fixture/case counts — a later checkpoint's count is
  never evaluated against an earlier commit, and vice versa

#### Scenario REQ-CCR-05.4: Fixture count never decreases across commit history

- GIVEN the corpus's `corpus.json#fixtures.length` across the branch's commit history, in order
- WHEN each value is compared to its predecessor
- THEN each is greater than or equal to the previous — a decrease is a hard failure, never a
  legitimate state

**Verification cadence note** (added V2, mirrors REQ-CCR-04's): this is a ONE-TIME PR-gate/review
check over the branch's commit history (e.g. a `git log`-scanning CI job), NOT a `bun test`
suite assertion — `fit-40` only ever inspects the CURRENT worktree and cannot read git history,
so it structurally cannot enforce this scenario itself.

#### Scenario REQ-CCR-05.5: No dead hardcoded checkpoint gates remain (added V2)

- GIVEN `test/fitness/fit-40-conformance-corpus-integrity.test.ts`'s source
- WHEN scanned for absolute-count early-return guards from prior checkpoint schemes (e.g.
  `corpus.fixtures.length !== 5` / `!== 1`)
- THEN none remain — any such guard is either deleted or replaced by the manifest-derived check
  above; a vacuous dead-code guard that can never go RED is itself a violation of this REQ

## Sensitive Areas Coverage

None. `security (IPC)` was already ruled out for this domain (`src/transport/**` untouched);
this change adds no new schema keys and touches no engine-loader-parsed field.
