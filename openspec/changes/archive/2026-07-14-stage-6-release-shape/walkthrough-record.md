# Walkthrough Record — `stage-6-release-shape` (REQ-AOD-08)

> Filled in by the owner at STEWARD RECKONING per the G-2 ruling (`slices.md`, plan-verify
> iteration 1, gap G-2). REQ-AOD-08 is only discharged once this record holds a REAL,
> completed verdict from an actual walkthrough.

## Reader

Daniel Ramirez (owner)

## Verdict

**PASS** — on walkthrough 2, against the fixed docs (2026-07-14). Walkthrough 1 FAILED and
produced the doc fixes recorded below; the full FAIL → fix → PASS trajectory is this
record's evidence.

## Walkthrough 1 — 2026-07-14 — FAIL (at step 4)

Steps followed:

1. Run `bun run link:sdk`
2. Create schema.json
3. Run `pbuilder-codegen .`
4. Create the factory — **stuck**: ts(2307), factory does not recognize `@pbuilder/sdk`

Findings (owner-reported, all confirmed and fixed in apply-progress Run 6):

1. The guide doesn't say where to create the schema.json — new folder? does it need a
   package.json / tsconfig init?
2. The factory file does not detect the `@pbuilder/sdk` package (ts2307 — consumer
   tsconfig.json never instructed; legacy resolution can't read the exports map).
3. The two-sided link flow (`bun link @pbuilder/sdk` in the consumer) was learned from the
   console output, not from the doc's context.
4. Step 5's `bun:test` import is unresolvable without `@types/bun` + `types: ["bun"]` —
   never mentioned.
5. Filenames (`factory.ts`, `factory.test.ts`) existed only in fence `filename=` metadata,
   invisible in rendered markdown.

## Walkthrough 2 — 2026-07-14 — PASS (fixed docs, fresh folder)

Steps followed, using ONLY the published `docs/quickstart.md` as fixed:

1. Run `bun run link:sdk`
2. Create the consumer folder and link `@pbuilder/sdk`
3. Create tsconfig.json + `bun add -d @types/bun` per the doc
4. Create schema.json
5. Run `pbuilder-codegen .`
6. Create factory.ts
7. Create factory.test.ts and run it — green

## Constraint Attestation

- [X] The walkthrough used ONLY the published docs (`docs/quickstart.md` and what it links)
- [X] The reader never opened `src/` or `test/` during the walkthrough
- [X] The verdict above is a real, binary pass/fail from an actual completed walkthrough

## Notes

Walkthrough 1's stumbles routed as `outcome-gap (not-usable)` → doc fix (apply-progress
Run 6): consumer workspace setup, tsconfig + `@types/bun`, filename prose, and the machine
leg extended to typecheck `factory.test.ts` with the doc's own tsconfig. Codegen-on-PATH
suspicion investigated and found false (`bun link` populates `~/.bun/bin`).
