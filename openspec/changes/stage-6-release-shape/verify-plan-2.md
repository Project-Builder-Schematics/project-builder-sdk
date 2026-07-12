# Plan Verify Result

**Change**: stage-6-release-shape
**Iteration**: 2/3
**Mode**: plan
**Write mode**: sync — ticket bodies not composed

---

### Verdict: gaps

Two blind judges (opus). Inputs: slices rev 2 (Executor Context appendix) + local-consumption spec with the G-1 mechanism note; iteration-1 rulings (G-1/G-2) passed to Judge A as accepted plan record.

### Judge A — problem/scope fit

**NO blocking findings in any category.** Coverage map independently rebuilt and reconciled (25/25 active REQs → slices). Problem-fit complete against the re-scoped problem. Out-of-scope: zero violations; the two boundary cases (AOD-09.6 documents-the-deferral; FIT-14 additive extension vs restructuring) explicitly judged as correctly handled. Transparency notes only: party (a)'s INSTALL half remains carved out (owner ruling 4); the defineFactory in_scope line intentionally carries no REQ/slice (resolved-by-ruling, null build).

### Judge B — simulated executor (slices rev 2, one-file world)

Trajectory 18 → **3** residual question-technical findings:

- **B-1**: baseline regeneration mechanism for `pkg-surface-baseline.json` not stated (fit-14 described as comparator only).
- **B-2**: exact SHA values + pinning policy for `actions/checkout`/`actions/setup-node` neither provided nor homed.
- **B-3**: the dialect-doc link target ("link not duplicate", S-004/FPS-06.2) never named in the appendix.

### gaps[]

| # | category | description | suggested_route |
|---|---|---|---|
| B-1 | question-technical | baseline regen mechanism unstated | slices rev 3 appendix item 16: the established procedure exists verbatim (stage-5b slices.md:62-68) — hand-edit surface halves from built package.json; `tarball` regenerated from `bun pm pack --dry-run` sorted listing |
| B-2 | question-technical | SHA values/policy unhomed | slices rev 3 appendix item 17: policy = 40-hex SHA + trailing `# vX.Y.Z` comment (match existing setup-bun pin style); reference values live-resolved at design (checkout v4.3.1 = 34e11487…, setup-node v4.4.0 = 49933ea5…) with MANDATORY re-verify procedure via `gh api` at apply time |
| B-3 | question-technical | dialect doc target unnamed | slices rev 3 appendix item 18: `docs/authoring-a-dialect.md` EXISTS (the only doc in docs/ today) — link it, never duplicate (REQ-AOD-04.1) |

### Disposition

All three answerable from existing verified facts — slices rev 3 is additive appendix only; no spec/design change. Iteration 3 (final): re-run both blind judges.
