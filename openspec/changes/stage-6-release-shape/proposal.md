# Proposal: Stage 6 — Release shape & DX closure (stage-6-release-shape)

**Triage**: L · **Persona lens**: none (council joins separately)

## Intent

Stages 1–5 built the entire authoring surface (six verbs, attributable errors, dry-run, typed
options, testing harness, typescript dialect), but nothing PACKAGES it for a consumer. External
authors cannot use the SDK — it has never shipped, and the only way to learn it is cloning this
repo and reading tests. The team cannot publish confidently either: `publish.yml` has no W3
repo-owner guard (a fork with its own `main` can reach the `id-token: write` OIDC job — verified
live), pins only `setup-bun` (not `checkout`/`setup-node`), and drags `dist/core/**` into the
tarball with no decision taken. Stage 6 is the TERMINAL stage of the ratified objectives plan and
delivers release-READINESS, not a release: the pipeline is hardened and rehearsed, resolution is
guaranteed from a real local install (`bun link`, the owner's everyday loop, plus a packed
tarball), and one documentation set takes a new author from local install to a passing typed
factory. The publish button stays untouched — owner's call, a separate future gate after real
engine integration.

## Scope

### In Scope
- **Local consumption story** — `bun link` as the canonical documented install path plus a new
  `bun link` e2e scenario; the packed-tarball path kept as release-shape verification.
- **Publish pipeline hardening** — W3 repo-owner guard, SHA-pin `actions/checkout` +
  `actions/setup-node`, `prebuild` clean, `declarationMap: false`, and an npm PLACEHOLDER publish
  reserving `@pbuilder/sdk` in the owner's scope (the one deliberate stub that fires — not the product).
- **Exports + tarball surface** — confirm every public subpath resolves and `/core` stays
  unreachable (FIT-09/FIT-14); DOCUMENT-not-strip `dist/core/**` (forced by `./testing`'s runtime
  import of `../core/context.ts`).
- **Author documentation set** — quickstart, six-verb reference (read-trichotomy rule), dialect
  usage, error contract in author vocabulary, dry-run usage; `bun link` first.
- **6.4 reconciliation + milestone** — ROADMAP, problem statement, pending-changes mutually
  consistent; declare Stage 6 = release-readiness; L2+ explicitly out.

### Out of Scope
- The first LIVE npm publish (deferred to L1-readiness after engine integration — separate gate).
- **Row 74 (EmitRejection port conformance)** — mis-tagged "6"; binds a real `EngineClient` that
  does not exist in this repo. Formally EXCLUDED here and RE-TAGGED to the cross-repo engine-gated
  bucket (see out-list below).
- GitHub Packages / dual-name / go-live interlocks (→ public-package plan, own /plan cycle).
- `defineFactory` graduation (stays `./testing`; → public-package plan, row 169).
- FIT-09/14 exports-guard extensibility refactor (→ trigger "second dialect", row 188).
- Asset-copy / SourceFS, real wire `ir.emit`/`tree.read`, stage-5b build, L2 composition,
  `@pbuilder/sdk-kit` extraction.

## Capabilities (contract with sdd-spec)

### New Capabilities
- `local-consumption`: bun link + tarball install resolves every public subpath, `/core` unreachable
- `publish-pipeline-hardening`: W3 guard, SHA pins, prebuild clean, declarationMap off, name placeholder
- `author-onboarding-docs`: docs-as-test set + 6.4 planning-doc reconciliation and milestone declaration

### Modified Capabilities
- `factory-package-shape`: tarball documents `dist/core/**` (not stripped); exports/surface baselines confirmed

## Approach

Execute 6.1–6.4 plus the release-readiness posture as one cohesive L change (explore Approach 1).
The graduation decision is DECOUPLED this cycle (owner ruling: `defineFactory` stays `./testing`),
which collapses the graduation⟷`dist/core` coupling into a single settled call: document-not-strip,
because `dist/testing/index.js` needs `dist/core/context.js` physically present at runtime.
Reuse existing vehicles, never fork them: extend `test/e2e/installed-consumer.e2e.test.ts` for the
`bun link` scenario (ADR-0036), extend FIT-09/FIT-14 and regenerate their baselines, and follow the
`docs/authoring-a-dialect.md` house style plus the `test/docs/testing-story-docs.test.ts`
docs-as-test precedent — with the swap target being the LINKED/INSTALLED package, never `src/`.
Design must formalise (ADRs): the placeholder-publish shape (stub reserving `@pbuilder/sdk` without
shipping the product), the `dist/core` document-not-strip decision, `bun link` auto-build via
`prepare` vs a documented build-then-link ritual, and the concrete checkable form of the docs-only
"new author success" bar (automated e2e vs recorded QA walkthrough — carried open question).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `package.json` | Modified | exports/files confirm, `prebuild` clean, `prepare` (design call) |
| `.github/workflows/publish.yml` | Modified | W3 guard, SHA pins, placeholder publish |
| `tsconfig.build.json` | Modified | `declarationMap: false` |
| `.github/workflows/ci.yml` | Read-only | SHA-pin scope decision (open question) |
| `src/core/context.ts` / `src/testing/index.ts` | Read-only | graduation deferred; import unchanged |
| `test/e2e/installed-consumer.e2e.test.ts` | Modified | add `bun link` scenario |
| `test/fitness/fit-09-*` + `fit-14-*` + baseline JSON | Modified | extend guards, regen baselines |
| `docs/*.md` | New | quickstart, verb ref, dialect, error contract, dry-run |
| `README.md` | Modified | front-door dialect entry (row 143), quickstart link |
| `ROADMAP.md` + `openspec/pending-changes.md` | Modified | 6.4 reconciliation, retire rows |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| W3 guard absent — fork `main` reaches OIDC job today | High | 6.2 guard is first hardening slice; security-engineer review load-bearing |
| Placeholder publish accidentally ships the product | Low | Stub-only, `--access public` on reserved name; verify no `dist` payload in a rehearsal |
| `dist/core` strip would break `./testing` at runtime | Medium | Ruled document-not-strip; FIT-14 baseline pins the shipped tarball |
| Docs-only acceptance bar has no test precedent | Medium | Design derives one checkable form (open question carried to spec) |
| `bun link` path completely untested today | Medium | New e2e scenario extends the existing installed-consumer vehicle |
| Scope creep via mis-tagged row 74 | Low | Formally excluded + re-tagged in this proposal |

## Rollback Plan

All changes are additive config/docs/tests on one branch with no live publish and no data
migration. Rollback = revert the merge commit, which restores: `publish.yml` to its pre-guard
form, `tsconfig.build.json` `declarationMap: true`, the FIT-09/FIT-14 baselines, and removes the
new docs and `bun link` e2e scenario. The npm placeholder publish is the ONLY externally-visible
act: if it fires and must be undone, `npm unpublish @pbuilder/sdk@<placeholder-version>` within the
72-hour window (or `npm deprecate` after) — the reserved name stays owned by the owner's scope
either way, so nothing is lost. `bun link` symlinks in sibling consumers are cleared with
`bun unlink`. Validate rollback by re-running the suite on the reverted commit (green) and
confirming `npm view @pbuilder/sdk` shows no product tarball.

## Dependencies

- None external. All upstream stages (1→2→5, 3, 4, 4b) already merged to main. npm placeholder
  publish uses the owner-controlled `@pbuilder/sdk` name (verified free inside the owned scope).

## Success Criteria

- [ ] Every public subpath (`.`, `./commons`, `./conformance`, `./testing`, `./typescript`)
      resolves from a `bun link` AND a packed-tarball install; `./core` throws.
- [ ] `publish.yml` rejects any repo whose owner ≠ the configured owner (W3 guard), and
      `checkout` + `setup-node` are commit-SHA-pinned.
- [ ] `prebuild` clean runs before build; `declarationMap: false` in `tsconfig.build.json`.
- [ ] A new-author walkthrough goes from local install to a passing typed factory against the fake
      using ONLY the docs (checkable form defined at spec).
- [ ] FIT-09 and FIT-14 pass with regenerated baselines; `dist/core/**` documented in the tarball.
- [ ] npm placeholder publish reserves `@pbuilder/sdk` with no product payload (rehearsal-verified).
- [ ] ROADMAP, problem statement, and pending-changes are mutually consistent; rows 27/33/34/35/86/143
      retired, L2+ marked out.

## Caveats from Exploration

Exploration returned `ready_for_proposal: yes` — no caveats. Three technical open questions carried
forward to spec/design: (1) SHA-pin scope for `ci.yml`; (2) graduation-ADR-before-`dist/core`
sequencing — resolved by the owner's deferral (graduation out, document-not-strip in); (3) the
concrete checkable form of the docs-only "new author success" scenario.
