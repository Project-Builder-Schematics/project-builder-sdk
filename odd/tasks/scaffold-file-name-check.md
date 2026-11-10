Objective: scaffold rejects raw template syntax and names Windows refuses under the source folder (sdk#149, architecture A-17), matching the engine's `checkFilesPath`/`CheckPortableName` (engine main 61f577c).
Branch: feat/scaffold-file-name-check off origin/main 699b3f0; not pushed (the orchestrator pushes). Test runner: `bun test` (focused: `bun test test/scaffold/filename-pipeline.test.ts test/scaffold/file-name-check.test.ts`).

## Specs

S1 — A-17: "Every component of the relative path under `files/`, each directory name and the file name, is checked as it is written on disk, before any token is translated. A name is rejected when: it holds the sequence `{=` or `=}` …; it holds any of `|`, `"`, `<`, `>`, `:`, `?`, `*` or `\`; it holds a control character, any code from 0x00 to 0x1F; its part before the first dot, compared without regard to letter case, is `CON`, `PRN`, `AUX`, `NUL`, `COM0` to `COM9`, `LPT0` to `LPT9`, or `COM` or `LPT` followed by one of the superscript digits `¹`, `²` and `³` (U+00B9, U+00B2, U+00B3), once the spaces at its end are removed …; it ends in a dot or a space." Match the engine's CheckPortableName exactly (check order, rule and character vocabulary). Leave CONIN$/CONOUT$ alone (architecture#52).

S2 — Allowed names pass unchanged: "`CONSOLE.ts`, `com10.ts`, `nul-check.ts`, `aux_`, `lpt10/a.ts`, and a lone `{`, `}` or `=` such as `a{b}.ts`, `x=y.ts`, `{a}/=b.ts`."

S3 — "The rejection happens on every OS, names the path and the reason … and emits nothing for the call." Message (orchestrator Q3): `invalid input: scaffold file name "<path>": the name "<name>" breaks the rule "<rule>" (<character>)`, reason `invalid-input`.

S4 — Q1: "check every walked entry under files/ before include/exclude filtering." Q2: "rename values and the `to` prefix are out of scope" — draft a follow-up issue.

S5 — "fix the leading-underscore key in TOKEN_INNER: `___name__.ts` must give `_{= .name =}.ts`." Tokens still translate as before (`__name__.ts`, `__name@dasherize__.svc.ts`, `__1x__name__.ts`, `__a.b__/__open.ts`, `__name@__.ts`); `__name___.ts` gives `{= .name =}_.ts`.

S6 — "REQ-FSC-05 states the check and uses the dotted `{= .name | ... =}` form."

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S6 | inline | done — RED (1 token case + missing check) → GREEN 92 pass | 3f61638, fix commit |
| T2 | all | delegated verifier (risk item 3: scaffold rejects inputs it accepted) | done — S2-S6 pass; S1 blocker (trimEnd) fixed in one correction, rechecked | — |

Route evidence: one unit, forecast under ~400 lines; no writer trigger fires.

## Log

L1 (2026-11-10, orchestrator brief, verbatim excerpt): "sdk#149 (scaffold rejects raw template syntax and names Windows refuses, per architecture A-17) comes after #150. The rule text is in project-builder-architecture bounded-contexts/authoring/rules/file-name-tokens.feature (tag v0.14.0, plus the A-19 examples merged in PR #51). Check how the engine implements it, so the SDK rejects the same names".

L2 (2026-11-10, orchestrator decisions, verbatim excerpt): "Q1: check every walked entry under files/ before include/exclude filtering. … Q2: rename values and the `to` prefix are out of scope, because A-17 covers names as written on disk. Draft a follow-up issue in English and include it in your report … Q3: use `invalid input: scaffold file name "<path>": the name "<name>" breaks the rule "<rule>" (<character>)`, with the engine's rule and character vocabulary. Also fix the leading-underscore key in TOKEN_INNER: `___name__.ts` must give `_{= .name =}.ts`. Match the engine's CheckPortableName exactly. … Leave CONIN$/CONOUT$ alone until architecture#52 is decided."

L3 (2026-11-10, design): the SDK has no architecture pin or Gherkin runner, so the A-17 `@sdk` example tables are ported as bun tests. `<path>` is the walked path relative to `from`.

L4 (2026-11-10, evidence): full suite 3967/0, typecheck clean, build (runner manifest) clean at 3f61638. Verifier: Go copy of engine 61f577c CheckPortableName/TranslateTokens vs SDK over 24,492 names; baseline-vs-candidate scaffold output identical except the intended underscore-run key change (also affects `to` and rename values, matching the engine) and the new rejections.

L5 (2026-11-10, verifier blocker): `trimEnd()` strips all Unicode whitespace while the engine (`strings.TrimRight(stem, " ")`) and A-17 strip only spaces, so `CON\u00A0.ts` over-rejected. Fixed with `replace(/ +$/, "")`. Recheck: parity mismatches 127 → 36, all lone-surrogate probe artifacts (Go JSON turns U+D800 into U+FFFD); full suite 3969/0.

L6 (2026-11-10, orchestrator, verbatim excerpt): "Rebase feat/scaffold-file-name-check onto origin/main 5ce2027. … Add a separate chore(release): 0.14.0 commit … On the walk-order advisory: make the reported name the first in byte-wise sorted order, as the engine does, only if it's a small change." Done: `checkSourceNames` sorts by code point (UTF-8 byte order; the default sort compares UTF-16 code units). RED 1 (missing export) → GREEN. Full suite 3974 pass / 1 fail: FIT-42N REQ-FCG-01.4 times out at 5000ms; it also times out on origin/main 5ce2027 in a scratch copy (load average 16.8 on 16 cores), so environmental.
