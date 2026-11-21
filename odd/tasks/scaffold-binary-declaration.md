# scaffold: the author declares binary files (#163)

Objective: `scaffold` stops choosing render vs copy by size; the author declares binary files and every other file renders.
Branch: `feat/163-scaffold-binary`, stacked on `fix/176-idempotent-declarations` (26d1f10). Delivery: one PR, stacked. Test runner: `bun test`.

## Specs

- S1 (approved shape, verbatim from the orchestrator relaying the user): "`binary?: string[]` globs, matched against the original source-relative path".
- S2: "the UTF-8/NUL sniff kept only as a guard that rejects an undeclared non-text file, with a `binary: [...]` suggestion".
- S3: "binary plus .template rejects".
- S4: "an unmatched binary pattern is allowed silently".
- S5: "the Q2 interim: a render file larger than one emit frame rejects, naming the file and its size, until architecture#59 settles splitting".
- S6: "a 0.x minor bump with a CHANGELOG migration note, and m-07, m-09, m-10 and m-11 rewritten".
- S7 (from #163's scope): "The by-value/by-reference verdict never depends on the frame budget or on the size of the options." and "A file that must be rendered is never copied unrendered. If it cannot travel, the error names the file."
- Assumption: `binary` has the same shape validation as `include`/`exclude` ("must be an array of strings"), and its globs use the same matcher, against the path relative to `from`.
- Assumption: m-06 (binary-by-reference) also declares `binary`, since it relies on the sniff today.

## Tasks

- T1 [S1-S5, S7] inline: `binary` option, classifier by declaration, guards and rejections, with RED tests through `scaffold`. Status: done (RED 6/9 in binary-declaration.test.ts, GREEN 9/0).
- T2 [S7] inline: rewrite the classify-transport tests that pin the size and sniff fallbacks. Status: done (8 classifier tests rewritten, 4 tests declare `binary`; scaffold folder 222/0).
- T3 [S6] inline: corpus m-05, m-06, m-07 declare `binary`; m-09/m-10/m-11 reviewed (comments only); fit-40 and the corpus e2e pending the heavy run. Status: in progress.
- T4 [S6] inline: JSDoc, docs guide, README done; CHANGELOG + version bump as a separate release commit. Status: in progress.
- T5 inline: build, whole test/fitness, P-SIZE, e2e scaffold suites (heavy slot). Status: open.

## Log

- L1 (2026-11-21, orchestrator relaying the user): "The user approved #163's shape as proposed, with the key named `binary`: `binary?: string[]` globs, matched against the original source-relative path; the UTF-8/NUL sniff kept only as a guard that rejects an undeclared non-text file, with a `binary: [...]` suggestion; binary plus .template rejects; an unmatched binary pattern is allowed silently; the Q2 interim: a render file larger than one emit frame rejects, naming the file and its size, until architecture#59 settles splitting; a 0.x minor bump with a CHANGELOG migration note, and m-07, m-09, m-10 and m-11 rewritten. Write it after #176, stacked on #176's head, test-first. Run the whole test/fitness folder plus P-SIZE before handover."
- L2: Map. The classifier is `scaffold/classify-transport.ts` (stat gate, sniff, serialized budget, each falling back to by-reference). The expander passes `isTemplateMarked`; include/exclude match `entry.relPath` (relative to `from`) through `isIncluded` in `domain/services/filename-pipeline.ts`. m-09 (six 0.8 MiB text files) still renders under the new rule; m-10/m-11 use direct `create()` calls, so only their comments describe the old downgrade.
- L3: T1-T2 done; m-05 (files-mixed/photo.png) also relied on the sniff and now declares `binary`. Light suites (bounded-contexts, commons, security, types, docs, golden-ir, acceptance) 2170/0. The CHANGELOG guard forbids `## Unreleased`, so the migration note goes under `## 0.15.0` with the package.json bump, in its own `chore(release)` commit.
