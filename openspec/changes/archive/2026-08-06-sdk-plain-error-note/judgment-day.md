# Judgment Day — `sdk-plain-error-note`

Blind adversarial review, fired because `sdd-verify --mode=final` returned
`adversarial_review: required`. Two judges per round, launched in parallel, each given the diff and
the two signed specs **only** — explicitly barred from reading `design.md`, `slices.md`,
`apply-progress.md` or any prior review, so neither could inherit the builders' reasoning.

Target: `git diff b5d4339..HEAD` on `feat/sc1-evaluate`.

## Round 1 — verdict

| Finding | Judge A | Judge B | Severity | Status |
|---|:--:|:--:|---|---|
| Whitespace ends the match — a path with a space in any segment is scrubbed only up to the space, tail reaches stderr verbatim | ✅ | — | CRITICAL | **reproduced by the orchestrator** |
| Single-segment POSIX paths (`/root`, `/etc`, `/tmp`) never match — no second `/` for the mandatory `(?:seg/)+` | — | ✅ | CRITICAL | **reproduced by the orchestrator** |
| Every test input is multi-segment and space-free, so both bypasses pass 100% of the suite | ✅ | ✅ | WARNING (real) | **confirmed by both** |
| Single leading backslash without a drive letter (`\Users\…`) | — | ✅ | WARNING (theoretical) | registered |
| Drive letter glued to a preceding word character | ✅ | — | WARNING (theoretical) | already a documented gap |

Executed evidence:

```
'/home/alice/Application Support/CANARY/file.ts' -> '../home/alice/Application Support../CANARY/file.ts'
'C:\Users\dev\Program Files\CANARY\file.ts'      -> '<outside-project> Files\CANARY\file.ts'
"mkdir '/root'"                                  -> "mkdir '/root'"     (unchanged)
```

Both judges worked independently and found **different** bypasses in the same mechanism. Neither
needed an adversarial construction: `Application Support` and `Program Files` are OS defaults, and
`/root` / `/etc` / `/tmp` are ordinary `fs` error subjects.

The whitespace case fails in **both** directions at once — it leaks the tail *and* garbles the
message (`Support../CANARY`), so it breaks the disclosure control and the legibility this change
exists to deliver simultaneously.

## Fix (`cd7551c`)

Regexes redesigned and validated against a 15-case matrix before implementation:

```js
const WINDOWS_UNC_ABS_PATH = /(?:(?<![A-Za-z0-9_])[A-Za-z]:[\\/]|\\\\)(?:[^\s'"<>]|[ ](?=[^\s'"<>]*[\\/]))*/g;
const POSIX_ABS_PATH = /(?<![A-Za-z0-9_])\/(?:[^\s'"<>]|[ ](?=[^\s'"<>]*\/))+/g;
```

A space is consumed only when a lookahead proves the path continues; POSIX gained the negative
lookbehind the Windows branch already had, which is what lets the segment requirement drop to a
single segment without `and/or` and `24/7` becoming false positives.

Eight new test cases, written first and **observed failing** against the pre-fix code. Suite
2676 → **2684 pass / 0 fail**, no regressions in any pre-existing assertion.

## Round 2 — verdict

| Finding | Judge A | Judge B | Severity | Introduced by the fix? |
|---|:--:|:--:|---|---|
| URLs mangled — `https://…` → `https:../…`; `file:///abs` → `file:…` | ✅ | ✅ | WARNING (real) | **No — pre-existing** |
| Absolute path with no separator before it is not scrubbed | ✅ | — | CRITICAL | **YES — regression** |
| Bare `\\` in prose → `<outside-project>` | ✅ | ✅ | WARNING (real / theoretical) | **No — pre-existing** |
| Four e2e canary assertions cannot detect a total failure | ✅ | ✅ | WARNING (real / theoretical) | No |
| Cap-discipline fixture has no path content, so scrub-driven length growth vs the ceiling is untested | ✅ | — | SUGGESTION | No |

Attribution was measured, not assumed — each round-2 finding was run against both the pre-fix and
post-fix regexes to establish which the fix caused:

```
in : loaderror/home/user/project/secret.json
old: loaderror../home/user/project/secret.json   <- pre-fix code scrubbed it
new: loaderror/home/user/project/secret.json     <- the fix leaks it
```

The lookbehind that enables single-segment matching is the same lookbehind that blocks this case.
**The fix closed two shapes and opened a third.**

A candidate repair — split the rule so only the single-segment branch carries the lookbehind — was
prototyped and **fails**: the space-tolerance lookahead then lets `/or, 24/7` match, mangling
ordinary prose (`use and<REL> support`).

## Resolution — owner ruling

Keep the fix; register the residuals; defer the mechanism change.

Rationale, on frequency: what the fix **closed** are OS defaults (`~/Library/Application Support`,
`C:\Program Files`) and ordinary top-level `fs` errors. What it **opened** requires a missing
separator in author formatting (`` `Cannot resolve module${path}` ``). Net better than what `main`
carries today — but net better is not correct, and it is written down as such rather than presented
as closure.

Round 3 was **not** run. Three independent attempts at this matcher (S-002's, the round-1 fix, and
the candidate repair above) have each closed some shapes and opened others. Non-convergence is now
demonstrated in this function, not argued by analogy to `runner-tripwire-invariants`.

## What the process failure teaches

Every bypass in both rounds **passed 100% of the suite** at the moment it was found. Four review
passes — the in-loop verify, the simplify gate, the final verify, and the orchestrator's own
spot-check of the matcher — all used multi-segment, space-free, URL-free inputs. The blind judges
found in minutes what four sighted passes missed, because they did not inherit the corpus everyone
else had been reasoning from.

The corpus was the blind spot, not any individual reviewer. That is why the e2e assertion-strength
item is registered ahead of the mechanism change: until an assertion can fail, no later fix to this
function is verifiable.

## Registered

- [#69](https://github.com/Project-Builder-Schematics/project-builder-sdk/issues/69) — `error-text-prefix-anchored-scrub`, the mechanism change
- [#70](https://github.com/Project-Builder-Schematics/project-builder-sdk/issues/70) — the four residuals with executed evidence, including the regression
- `openspec/pending-changes.md` — `error-text-prefix-anchored-scrub` (L, architecture) and `error-text-e2e-assertion-strength` (S, test-coverage)
