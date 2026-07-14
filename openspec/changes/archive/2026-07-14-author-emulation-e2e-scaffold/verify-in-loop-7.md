## Verify In-Loop Result

**Change**: author-emulation-e2e-scaffold
**Iteration**: 1/3 for S-004 (artefact N=7) — FINAL slice
**Scope**: S-004 (batch-cap, containment & rejection boundaries — 10 rows)
**Mode**: in-loop (Strict TDD)
**Delta under review**: commits `04b7586`, `d3a667d`, `a3702ab`, `6031a40`

---

### Verdict: PASS

All 10 S-004 rows land conformant: every rejection row asserts the FULL attribution
triple explicitly (nulls included, per SCM-05 — never reason-alone), the 10 committed
records are byte-stable rejection/boundary records with closed-union reasons and no
free-text messages, M-21's cross-chunk atomicity is proven at runtime (empty tree +
multi-flush + attributed collision), and the coverage manifest is genuinely finalized
(all 21 rows + s-00 in EXERCISED with committed files; FRICTION carries six real,
dispositioned entries). Both disclosed deviations are structurally justified (verified
against read-only `src/scaffold`). The M-13 spec divergence is RULED below: option (a)
with one binding condition on archive. **The build phase is COMPLETE.**

#### Real execution evidence

| Command | Result |
|---|---|
| `bun test` (full suite) | **1167 pass / 0 fail**, 2411 expect() calls, 137 files |
| `bunx tsc --noEmit` | **clean**, exit 0 |
| `bun scripts/regen-corpus.ts` (fresh process, 22 scenarios) + `git status` corpus dir | **all 22 transcripts byte-identical** |
| Corpus dir | exactly 22 `.transcript.json` + README + manifest; `SCENARIOS` has 22 entries — GCC-01 one-to-one holds (FIT-26 in-suite green) |
| FIT-23/24/25/26/27 focused run | 30 pass / 0 fail (all red-proofs incl. the N=6 additions) |
| `git diff 157a57e..HEAD --stat` | 15 files, **zero `src/` rows**; largest new blob 29 KB (slices.md) — M-10/M-11/M-12/M-21 fills all setup-materialized, no large blob in git |
| Rejection-reason sweep across all 9 rejection records | every `reason` a closed `AuthoringReason` value (`invalid-input` ×4, `changes-too-large`, `source-outside-package` ×2, `source-not-found`, `path-collision`); no `message` key in any record |

#### RULING — M-13 / GCC-09.1 spec divergence (requested)

**Ruling: (a) — recording-as-FRICTION is sufficient; no spec micro-unfreeze is required
before verify final — WITH one binding condition on archive.** Reasoning, from the
actual texts:

1. **GCC-09.1's THEN clause, read literally, is SATISFIED.** Its text is "records
   terminal outcome `rejected`, an empty directive sequence, and
   `{reason: "invalid-input", verb, path}` — and contains no free-text error message".
   It names a concrete VALUE only for `reason`; `verb` and `path` appear as FIELD NAMES,
   not values. The committed `m-13` record carries exactly those fields
   (`verb: null, path: null`), empty directives, outcome rejected, no message — every
   literal obligation of the scenario holds. The "concrete path" reading lives only in
   the illustration's implicit assumption, not in its words.
2. **The normative body does not force a path where none exists.** It hedges `verb`
   ("when attributable") and lists "the primary PACKAGE-RELATIVE path" unhedged — but
   for `invalidInput()`-sourced rejections there IS no primary path; requiring one would
   force the capture to invent, which the SIGNED design (R-F, ratified through
   plan-verify READY) explicitly bans, and design §4.3 types the field
   `path: string | null`. The unhedged clause is honored wherever a primary path exists:
   `m-16` (`../m16-traversal-outside.txt`), `m-17`, `m-18` (`missing.txt`), `m-21`
   (`out/big-5.txt`) all carry concrete package-relative paths. So there is no
   spec⇄design conflict — only a stale illustrative assumption that the landed API
   disproved, which is precisely the case R-F's carried note anticipated and prescribed:
   "reconcile at spec level (record the divergence), never patch the capture."
3. **The executor did exactly that, and better than asked**: the FRICTION entry
   generalizes the divergence from M-13 alone to all four `invalidInput()`-sourced rows
   (M-08/M-12/M-13/M-15) AND documents the batch-level-null behaviour of cap rejections
   (M-10/M-11) with the `emit-rejection.ts` contract citation. SCM-05 is still satisfied
   at every row — the triple is asserted explicitly AT its nulls.
4. **Binding condition**: archive's spec-sync MUST amend GCC-09.1's illustration
   deliberately — either annotate that `verb`/`path` serialize `null` when the producer
   mints none, or re-illustrate with a row that carries a concrete triple (M-18 or M-21
   are exact fits). This is an archive obligation, registered in the carried list below;
   final-mode verify should treat GCC-09.1 as ✅ COMPLIANT under the field-presence
   reading, citing this ruling — it is NOT a REQ-coverage inconsistency.

#### Disclosed deviations — judged

- **M-10/M-11 via direct `create()` — ACCEPTED.** Verified against read-only
  `src/scaffold/classify-transport.ts`: the CCL-02 budget gate downgrades any over-cap
  non-`.template` walked file to an ordinary by-reference verdict (fail-loud only via
  `failMessages`, i.e. render REQUESTS) — scaffold's own walk structurally cannot emit an
  at/over-cap `create`, so the REQ-04.2/04.3 boundary is reachable only by bypassing the
  classifier, which matches REQ-04.2's own framing ("unchanged" pre-existing per-batch
  check). Craftsmanship note: `fillTemplateForBatchSize` computes the boundary via the
  REAL `serializedBatchSize` from `core/wire.ts` (probe + exact ASCII arithmetic), so the
  at-cap/over-cap fixtures can never drift from the actual cap check — and M-10 still
  chains a trailing `scaffold()` so the expander's pending-size accumulator is exercised.
  M-11 pins `>` vs `>=` with at-cap SUCCESS (corpus-committed) + one-byte-over REJECT
  (inline companion, full triple asserted).
- **M-16 absolute-path variant inline-only — ACCEPTED.** The inline assertion is real
  (`runM16Absolute` captured through `captureRun`, `reason: "source-outside-package"`
  asserted). Corpus-capturing it would embed `/etc/passwd` verbatim (R-F pass-through)
  and trip FIT-24's purity guard — the guard working as designed, not a coverage dodge.
  The corpus-canonical + inline-companion split is used consistently (M-02, M-11, M-12,
  M-16, M-17) and each companion asserts against the caught error, not a weakened shape.

#### S-004 row-by-row (all verified in test source + committed records + execution)

| Row | Triple asserted | Record |
|---|---|---|
| M-08 (binary `.template` walk) | `invalid-input` / null / null — explicit | ✅ committed |
| M-10 (single group over cap) | `changes-too-large` / null / null — batch-level, documented | ✅ committed |
| M-11 (at-cap passes / +1 rejects) | at-cap committed record; over-cap inline full triple | ✅ committed (at-cap) |
| M-12 (templateFile binary/oversized) | `invalid-input` / null / null; oversized inline | ✅ committed (binary) |
| M-13 (filters eliminate all) | `invalid-input` / null / null — see RULING | ✅ committed |
| M-15 (intra-scaffold collision) | `invalid-input` / null / null (sources in message only — correctly excluded from record) | ✅ committed |
| M-16 (traversal / absolute) | `source-outside-package` / null / `../m16-traversal-outside.txt`; absolute inline | ✅ committed (traversal) |
| M-17 (no existence oracle) | non-existing committed; existing inline with IDENTICAL reason + message-shape-modulo-path comparison — a genuine oracle-absence discriminator | ✅ committed |
| M-18 (missing in-ceiling) | `source-not-found` / null / `missing.txt` | ✅ committed |
| M-21 (cross-chunk atomicity) | `path-collision` / `create` / `out/big-5.txt` + `tree.size === 0` + `emitted.length > 1` | ✅ committed (4+2 batchGrouping proves the 2-flush split) |

All new scenarios registered in `SCENARIOS` (22 entries, m-21 wired with its collision
seed via the registry's `seed` field — R-E single-source holds); regen script remains
the only corpus writer (FIT-27 green with the N=6 strengthened scan).

#### Manifest finalization (GCC-08 / AEG-06)

EXERCISED: all 21 rows mapped + s-00, every row now with a committed file ("matrix
COMPLETE at this spec version"). NOT-EXERCISED: the 5 literals intact. FRICTION: six
real dispositioned entries (3 from S-003 + 3 from S-004: the GCC-09.1 divergence, the
batch-level-null contract, the classifier structural-impossibility note) — not a vacuous
`none observed`.

---

All scope checks green. Loop can exit — **build phase COMPLETE (S-000..S-004 all verified)**.
- Tasks in scope complete: 5/5 (S-004.1-.5)
- Affected tests passed: 1167/1167 (full suite)
- Spec compliance for scope: all 10 rows + SCM-05 + GCC-09 ✅ (GCC-09.1 per RULING above)
- Assertion audit: clean (full-triple discipline throughout; no banned patterns)

Orchestrator action: exit loop; proceed to `/simplify` pass, then `sdd-verify --mode=final`.

### Carried-to-final list (final restatement)

| # | Item | Origin | Owed at |
|---|---|---|---|
| 1 | **TDD commit-order audit** — feat-before-test committed history across ALL slices (S-004 continues it: `04b7586` fixtures before `d3a667d` tests), no verifiable RED commits; apply narratives claim test-first working-dir order. Final must rule explicitly (likely frame: `strict-tdd-verify.md`'s per-slice-commit tolerance), not inherit in-loop tolerance. | verify-in-loop-1 #3 | `sdd-verify --mode=final` |
| 2 | **GCC-09.1 illustration amendment** — per this artefact's RULING: archive's spec-sync must annotate null-when-unattributable or re-illustrate with M-18/M-21. Final-mode verify treats GCC-09.1 as COMPLIANT citing the ruling. | verify-in-loop-7 RULING | `sdd-archive` (spec-sync), noted by verify-final |

All other previously-carried items retired (embedTemplate N=5; RPT-04.1 N=4; GCC-07.1 +
FIT-24 narrowing N=6).

### Artifacts Persisted
| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-7 | hybrid | engram `sdd/author-emulation-e2e-scaffold/verify-in-loop-7` + `openspec/changes/author-emulation-e2e-scaffold/verify-in-loop-7.md` |

### Risks
- None blocking. The GCC-09.1 amendment is an archive bookkeeping obligation — if
  skipped, the spec ships with a misleading illustration and the next reader re-litigates
  this exact divergence.

### Next Recommended
`/simplify` pass over the change's full diff, then `sdd-verify --mode=final`.

### Skill Resolution
none (greenfield project — skill registry empty)
