# Local dialects (CA-18, A-16 amended) — SDK side

Objective: let the conformance fixture and the runner handle a workspace's local dialect. Branch `feat/local-dialects` (worktree `project-builder-sdk-worktrees/local-dialects`), off origin/main 6fa2889. Delivery: ask-on-risk. Runner: `bun test`.

## Specs

- S1 (rules v0.26.9, architecture): "A local dialect is named by the key of its Dialect declaration, `"ini": { "path": "./dialects/ini/index.ts", "conformance": "./dialects/ini/conformance.ts" }`. The conformance fixture rejects a local dialect whose `name` differs from that key". Scenario: "A local Dialect whose name is not the key of its declaration fails the conformance fixture" (@sdk), step `an author-defined dialect "{dialect}" for the extension "{extension}", declared locally as "{key}"`.
- S2: "The runner's pre-run check: a local dialect must resolve, by real path, inside the folder of its base file, instead of inside the Lock-pinned cache package."
- S3: "The fixture needs a way to run on a local dialect: the base file and conformance file paths, plus the expected name, in place of a package. The CLI calls it through engine conformance.Run."
- S4 (agreed with engine): runner `--dialects` local entry `{"kind":"local", name, root, path}`, root = the folder engine hashed, path = the base file, both absolute real paths; published entries stay `{name, version, root}` with no kind. Check: realpath(path) inside realpath(root). Error (proposed, pending architecture): `the factory does not start because the dialect "ini" resolves outside the folder of its base file`.
- S5 (agreed with engine): `pbuilder-conformance --local <name> --conformance <abs file> --path <abs base file>`, same JSON line and 0/1/2 exit codes; `dialect` = key, `version` = "".
- S6: "Bump the rules submodule to v0.26.9." Superseded by the next rules tag (v0.26.10 or later) carrying S7-S9.
- S7 (architecture, Daniel's decision): "yes, for BOTH kinds. A-16 now says every dialect has a base file: the module its package exports at its root, or a local dialect's `path`. The fixture rejects fixture data that tests a Dialect other than the one that base file exports. So keep --path, and the published form gains the same check against the package's root export. That's a change to 0.18.0's published behaviour." Scenario Outline: "Fixture data that tests a Dialect other than the one its base file exports fails the conformance fixture" (shipped/local examples), step `the conformance fixture data of the dialect "{dialect}" tests a Dialect other than the one its base file exports`.
- S8: scenario "A local dialect that resolves outside the folder of its base file stops the factory before it starts", Then `the factory does not start because the dialect "{dialect}" resolves outside the folder of its base file`.
- S9: "the conformance file must sit inside the base file's folder. The CLI enforces that at sync."

## Tasks

- T1 S1,S3,S5,S7,S9 — base-file check for both kinds, `checkLocalDialect` + bin `--local`, tests, docs — inline — done (run-package.test 24/24, RED observed first)
- T2 S2,S4,S8 — runner local `--dialects` entry and probe, wire spec — inline — done (declared-dialects 14/14, RED observed first)
- T3 S6,S1,S7,S8 — rules pinned at v0.26.11, acceptance steps for the new scenarios — inline — done (the 4 new designed scenarios pass; rules:implemented 514/514)

## Log

- L1 (2026-11-28, architecture for Daniel): "Rules tag v0.26.9 (186532d) adds local dialects (CA-18) and amends A-16. SDK work: (1) A local dialect is named by the key of its Dialect declaration [...] (2) The runner's pre-run check: a local dialect must resolve, by real path, inside the folder of its base file [...] (3) The fixture needs a way to run on a local dialect [...] Tell me how the runner's --dialects entry should carry a local dialect [...] Agree it with engine before building. Bump the rules submodule to v0.26.9."
- L2: engine agreed S4/S5 as proposed. Its hash walk uses Lstat and refuses symlinks; keep the realpath check as defence in depth. Engine wants the SDK commit once it lands.
- L3: open with architecture: the error text of S4, and whether the fixture checks that the base file exports fixture.dialect (not in the rules; until answered `--path` is accepted and not loaded).
- L4 (architecture): S4's shape and S5's argv confirmed; answers became S7-S9; new tag pending.
- L5: base file resolution agreed with engine's pointerdir.go: exports string, conditions object, or exports["."], picked recursively bun>import>default; no fallback to main once exports exists; without exports main (prefixed "./") else index.js; target starts with "./" and its realpath stays inside the package.
- L6: Bun 1.4.4 loads one file twice when it is imported under two spellings of its path (/var vs /private/var) after the first import, so the fixture and base file are imported by real path; the base check compares the Dialect by reference.
- L7: rules v0.26.10 (base-file check) then v0.26.11 (CLI-only); pinned v0.26.11.
- L8: fitness: fit-50 snapshot refreshed, fit-52 rebaselined `./conformance` only (the commons drift is pre-existing). FIT-42 passes alone (69/69) with a longer timeout; FIT-46, FIT-40 Bun pin, FIT-42N are environmental as before.
- Route: all tasks inline, no writer trigger (one sequential feature, about 150 lines each).
