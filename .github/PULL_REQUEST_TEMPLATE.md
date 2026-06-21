## What problem does this solve?

<!-- Describe the problem first, then the change. Code is the artefact of solving a problem. -->

## Changes

<!-- One logical change per PR. List what changed and why. -->

## Checklist

- [ ] `bun test` is green
- [ ] `bun run typecheck` is clean
- [ ] `bun run typecheck:permissive-proof` exits non-zero (the pass signal)
- [ ] `bun run build` succeeds
- [ ] New public exports carry a JSDoc `@example` (FIT-06)
- [ ] Public `.d.ts` changes update the baseline in `test/fitness/dts-baseline/` (FIT-04)
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
