# QA Adversarial Review — mutation escapes and test vehicles (runner-integrity-manifest)

**Phase**: spec (V1 review, folded into V2) · **Lens**: qa-engineer (opus, blind) · **Date**: 2026-07-25

> **Why this file exists**: spec V2's REQs record WHAT to test; this file records WHY each exists —
> which wrong implementation it kills. At build time, "this REQ looks redundant" is answered here.
> Deleting a REQ without reading its escape below re-opens the hole it was written to close.

---

## Test vehicle tiers (ratified — design must honour)

A full-tree build per red-proof is **not viable**: 18 red-proofs × one `tsc` build each is minutes of
suite time, and several plants (RP-3/4/5/7) would have to land in `src/**`, which this change declares
a zero-diff zone, leaving the repo dirty on any crashed run.

| Tier | Vehicle | Covers | Cost |
|---|---|---|---|
| **A** | `mkdtempSync` root + 3–5 tiny `.js` files forming a closure + a `package.json`; call `deriveRunnerClosure(root, entry)` **directly** | most red-proofs | milliseconds, hermetic |
| **B** | copy built `dist/` + `package.json` to a temp root, plant **in the copy**, run the generator as a **subprocess**, assert exit≠0 + stderr + no manifest | exactly ONE real-tree negative | one memoized `ensureTscBuild()` + one `cp -R` |
| **C** | one `npm pack` → extract → verify; the install step (`npm install ./<tarball>`) on top | all PMF scenarios | seconds — worth every one |

- **Tier A REQUIRES root-parameterised derivation** (REQ-RCD-00). This is the single design constraint
  the whole test plan hangs on.
- Tier A proves the **derivation function**, not the **build wiring**. Accept that, and cover the wiring
  once, in Tier B — the only proof that fail-closed actually reaches the process exit code.
- **REJECTED — mutate-and-restore in a `finally`**: a killed run leaves a corrupted `dist/`, and within
  one `bun test` process nothing rebuilds it (`ensureTscBuild` is memoized). Never mutate shared state
  a memoized fixture guards.
- **REJECTED — injecting fake nodes into the walk**: tests the injection point, not the walk.

---

## Mutation escapes (wrong implementation → passes anyway → the scenario that kills it)

### RCD — was the weakest capability in V1

| # | Wrong implementation that passed V1 | Killed by |
|---|---|---|
| **1** | **The baseline is the only oracle.** A generator that reads `runner-closure-graph-baseline.json` (or hard-codes 23 paths) passed RCD-01.1, RCD-02.1, RCD-02.2, RCD-04.1 and every RME/RMD scenario. Nothing forced the derivation to run against a graph it had not seen. | **RCD-01.2** (synthetic tree; `D` present but unimported, asserted absent by name). *The most important single addition in V2 — and it also forces root-parameterisation.* |
| 2 | **Glob, not walk**: `dist/{bin,transport,core}/**/*.js` minus a hard-coded exclusion list. `dist/core/` has ~12 files of which 7 are in the closure, so the naive form dies on the count — but `glob(baseline dirs) ∩ baseline` survived. | RCD-01.2 |
| 3 | **Silent skips on unresolvable edges.** The repo's own `test/support/import-scan.ts:walkReachable` does `catch { continue }` on an unreadable file. Copy that idiom and a typo'd or query-suffixed specifier silently drops a subtree: the closure is a subset, all 23 still hash, everything is green, **and the engine's lemma is void**. V1's RCD-03 covered *unclassifiable* constructs, not *classified-but-unresolvable* ones. | **RCD-03.2** |
| **4** | **Regex scanning cannot honour "zero silent skips" — VERIFIED day-one failure.** `removeComments` is unset, so JSDoc survives into `dist`. `src/core/authoring-error.ts:229` carries `import { AuthoringError } from "@pbuilder/sdk/commons"` inside an `@example` → **false Constraint-3 alarm on the first build**. `src/core/context.ts:352` carries `import type { Input } from "./schema.generated.ts"` → **phantom closure node**. Both files are in the 23. Regex comment-stripping is not a fix either: `/\/\/.*$/gm` truncates any line containing `file://`. | **R1 (ts-morph)** + **RCD-03.3** and **RP-12**, which pin both files **by name** so deleting the examples cannot "fix" it |
| 5 | **Hard-coded builtin list is a future false alarm.** Pinning the literal six means a legitimate future `node:buffer` turns the build red. The enforced property is *`node:`-prefixed ⇒ excluded*; the identity of the six belongs in the regenerable baseline. | **RCD-04.1** (baseline row, not literal) |

### RME

| # | Wrong implementation | Killed by |
|---|---|---|
| 6 | **"Independent SHA-256" was not independent.** If the test imports the generator's own `sha256File()`, RME-02.1 asserts `f(x) === f(x)` — surviving a wrong read mode, a BOM strip, a normalisation. | **RME-02.2** (known-answer: `e3b0c442…b855` for zero bytes, `01ba4719…0b` for `\n`) |
| 7 | **`localeCompare` passed RME-05.1.** V1's RME-05.2 named no concrete pair, so an implementer picks one that does not discriminate. | **RME-05.2** with pinned pairs (`dist/Z.js` vs `dist/a.js`; `dist/a-b.js` vs `dist/aB.js`) + **RMD-01.2** (`LC_ALL=C` vs `tr_TR.UTF-8` in a child process) |
| 8 | **"Indentation matches the pinned form" is unassertable prose.** | **RME-06.1** round-trip identity: `raw === JSON.stringify(JSON.parse(raw), null, 2) + "\n"` — kills 4-space, tabs, CRLF, missing trailing newline and key reordering in one line |
| 9 | **Extra top-level fields passed everything.** A `generatedAt` field slipped past every V1 scenario — and engine parser strictness was an open question, i.e. exactly the field that could fail closed on 100% of installs. | **RME-01.3** (exact key sets, top level and per file record) |

### RMD

| # | Wrong implementation | Killed by |
|---|---|---|
| 10 | **`newLine: "lf"` asserts the wrong mechanism.** It governs only tsc-*emitted* terminators; newlines inside **template literals** (30+ closure sources) pass through verbatim from source. Delete `.gitattributes` and RMD-02 breaks while RMD-03.1 stays green. | **RMD-03.3** (`.gitattributes` normalises `src/**` to LF, no `-text` exception) |
| 11 | **BOM.** `tsc` preserves a source BOM into the emitted file: invisible in review, changes the digest, same false-alarm family as CRLF. | **RMD-03.4** |

### BPI

| # | Wrong implementation | Killed by |
|---|---|---|
| 12 | **BPI-02.1 was vacuous.** `prebuild: rm -rf dist` deletes any prior manifest before the build starts, so "no manifest survives a failed derivation" passed **without the generator ever being fail-closed**. | **BPI-02.1** rewritten to invoke the generator **directly against a prepared root that already contains a manifest** |
| 13 | **No atomicity requirement.** A generator that opens the output stream, writes records, then throws leaves a **truncated manifest** — the engine then either fails on a parse error or, worse, verifies a short list. | **BPI-02.2** (hash-all-then-write-once, or write-then-rename) |
| 14 | **Generator ordering.** If it runs before `build:codegen` and that step then fails, a valid-looking manifest sits on a broken tree until the next `prebuild`. | **BPI-01.2** (generator is LAST) |
| 15 | **"Stable machine-parseable form" is not a form.** | **BPI-04.1** pins the two literal lines |

### CST — the realm was unresolved (became ambiguity J)

| # | Wrong implementation | Killed by |
|---|---|---|
| 16 | **CST-02 is a subset of CST-01**, so an implementation where "everything fails" passed both. RP-5's stated purpose (a name allowlist would wrongly pass `"fs"`) only discriminates if the same fixture also contains `node:fs` and **only `"fs"` is named**. | **RP-5 amended** (both in one fixture; exactly ONE violation) |
| **17** | **`createRequire` detection defeated by one variable.** `const req = createRequire(url); req("./x")` is invisible to any direct-call pattern, as is the namespace form `import * as m from "node:module"; m.createRequire(url)(…)`. V1's RP-7 planted the *direct* form only — so the check that passed RP-7 let the real thing through. | **R3** (outright ban, anchored exemption) + **CST-04.4** + **RP-7b** (indirect + namespace forms) |
| 18 | **"Stable anchor" was undefined** and therefore unimplementable. | **CST-03.3**: the count of dynamic `import()` in `dist/transport/runner.js` is exactly 1 and 0 elsewhere; marker `SANCTIONED-FACTORY-IMPORT`. *CST-03.2 falls out of the count for free.* |

### BDI

| # | Wrong implementation | Killed by |
|---|---|---|
| 19 | **BDI-02.1 was near-vacuous.** `dist/x/y.js → src/x/y.ts` is a string transform; "exactly one `.ts` exists" can only fail if the source was deleted, which fails the build anyway. It did **not** detect the thing it exists to detect (a bundler rewriting the graph). | **BDI-02.1** replaced with specifier-**multiset** equality modulo type-only erasure, plus **BDI-02.2** (a type-only import must NOT be flagged — else `session.ts`/`stdio-engine-client.ts` false-alarm immediately) |
| 20 | **BDI-01 scoped to `package.json#scripts` only** — a bundler invoked from a workflow step, from a `scripts/*.ts`, via `Bun.build({outdir})`, or with `-o` short form was invisible. RP-8 planted exactly the form the impl parses. | **BDI-01.1** (`--outdir` by directory containment + `-o`) and **BDI-01.2** (non-`scripts` surfaces explicitly out of scope, so the requirement does not read stronger than it is) |
| **21** | **A node-only baseline passed a redirected edge.** An attack that repoints `A → C` instead of `A → B`, node set unchanged, is **exactly the closure-sealing case**. V1's table had add and remove only. | **RP-2c** — the highest-value missing red-proof in V1 |

### PMF — the highest-consequence escapes

| # | Wrong implementation | Killed by |
|---|---|---|
| **22** | **PMF-02.2 could not fail.** With `--ignore-scripts`, the packed `package.json` **is** the working-tree one the manifest hashed, so the digest matched trivially. The C1 failure mode — `npm version` mutating `package.json` between build and pack — was never simulated. **The publish-ordering property therefore had no behavioural red-proof**, only a YAML-shape assertion on a file this change declares out of scope for editing. | **PMF-02.2** rewritten: build → rewrite version → pack → extract → assert entry #24 **MISMATCHES** |
| **23** | **"Extracted tarball" ≠ "installed tree", and V1's "retired" note lulled the reader past it.** The empirical check proved *pack-time* identity. `npm-normalize-package-bin` is a known rewriter and **this package has a `bin` field**; the release target makes a registry install the production path. Nothing tested the install boundary. | **PMF-02.3** (`npm pack` → `npm install ./<tarball>` → recompute against `node_modules/@pbuilder/sdk/package.json`) |
| 24 | **Packer ambiguity.** The spec used `npm pack`, FIT-14 uses `bun pm pack`, and the workflow publishes with `npm`. Packing with one and releasing with the other proves the wrong thing. | **`npm pack` declared normative** for PMF; `package/` prefix stripped explicitly |

### IID

| # | Wrong implementation | Killed by |
|---|---|---|
| 25 | **Every scenario was a substring assertion on prose** — all seven passed against a document that says the right words while the code does something else, and all seven went red when someone reworded a sentence. Zero mutation resistance, high false-alarm rate. | **IID-01.1**: the five Constraints are a structured list where each carries `enforced-by:` naming **either a FIT id that exists as a file on disk, or the literal `engine-owned`**. *Worth more than the other six substring scans combined.* |

---

## Missing negative cases (folded into V2 where a REQ exists; the rest are build-time watch-outs)

| Class | Why it matters | Status |
|---|---|---|
| Cyclic import graph | a naive recursive walk never terminates | **RCD-01.3** |
| Empty closure (entry with zero imports) | boundary: must yield exactly 1, not 0, not an error | **RCD-01.4** |
| Unreadable / chmod 000 closure file | fail loud, name the path. **Skip under uid 0** or the fixture false-passes in containers | **RCD-03.5** |
| Zero-byte closure file | truthiness bug `if (!content) continue` silently drops a record | **RME-02.2** known-answer digest |
| Specifier with query/fragment (`./x.js?v=1`) | `resolve()` yields a nonexistent path → silent skip or crash | **RCD-03.4** |
| `.mjs`/`.cjs` in the closure | `module: NodeNext` can emit `.mjs`; a walker filtering `endsWith(".js")` silently loses a subtree | **RCD-02.3** |
| Symlinked closure file | `readFileSync` follows; a link out of the package root hashes foreign bytes under an in-package path. `bun link` makes this non-academic | **RCD-05.1** |
| Build fails *after* the manifest is written | valid-looking manifest on a broken tree | **BPI-01.2** |
| **Path containing a space** | `new URL("../../", import.meta.url).pathname` — this repo's own test-helper idiom — **does not percent-decode**. `/home/me/My Projects/…` breaks it. More likely in the wild than the non-ASCII case | **RMD-02.1** (space AND non-ASCII in the fixture path) |
| Concurrent builds on the same `dist/` | see Isolation §3 below | **watch-out** |
| `node:`-prefixed-but-nonexistent (`node:not-real`) | silently excluded, caught by Node at runtime, zero security delta | **not worth a scenario** — mention in the invariants doc, do not test |

---

## Isolation & ordering requirements (binding on design)

1. **RMD-04.1 must not touch the real `dist/`.** V1's wording ("one byte is appended to
   `dist/core/session.js`") corrupts a tree that `ensureTscBuild()` memoizes and that FIT-14, FIT-04,
   the dist-runner e2e and this change's own RME-02.1 all read afterwards. `bun test` file order is not
   a contract, so the failure would be intermittent and blamed on the wrong test. **Fixed in V2**:
   operate on a copied root.
2. **Every mutating scenario gets its own `mkdtemp` root + `afterEach` teardown** (`scratchDirFactory`).
   No `process.chdir`; no shared env mutation — `LC_ALL` in RMD-01.2 is passed to a **child process**,
   never set on `process.env`.
3. **Pre-existing hazard this change makes bite**: `fit-14-package-surface.test.ts` runs its own
   unconditional `beforeAll` → `bun run build` → `prebuild: rm -rf dist`. Any test holding a path from a
   memoized `ensureTscBuild()` has that tree deleted and rebuilt under it. Adding a manifest that more
   tests read against `dist/` multiplies the exposure. **Recommendation: route FIT-14's build through
   `ensureTscBuild()` too**, or accept that no test may cache anything about `dist/` across files.
4. **The permission fixture must skip under uid 0**, else it silently false-passes in containers.
5. **Digest-recompute scenarios (RME-02.1) must run against a tree no other scenario has mutated** —
   Tier A/B isolation gives this for free; nothing else does.

---

## Unobservable as written in V1 (all fixed in V2)

- **BPI-01.1 "with no additional command invoked"** — not observable from outside the build. Rewritten
  as a structural parse of `package.json#scripts.build`.
- **RMD-05.1 "no timestamp"** — unfalsifiable as a regex. Rewritten as: no `process.cwd()`, no
  `os.userInfo().username`, plus RME-01.3's exact key set (which structurally excludes a timestamp
  field). **`os.homedir()` deliberately NOT scanned**: on GitHub runners the checkout lives under
  `/home/runner`, so a homedir substring scan fires on any legitimate relative path; in a container with
  `HOME=/root` and cwd `/app` it misses one entirely.
- **RMD-02.1 (two checkouts, two full builds)** — executable but ~2 full `tsc` builds, and it need not
  be. Nothing in tsc's output can carry a path (`declarationMap: false`, no source maps) — **the
  generator is the only component that can leak one**. V2 uses the cheap equivalent (copy the built tree,
  re-run only the generator) and states the limitation explicitly.
- **RMD-03.2's "synthetic CRLF fixture"** — a committed CRLF fixture is normalised by `.gitattributes`'
  `* eol=lf` on the next `git add`. V2 requires it be **generated at test time**.
- **Every "the comparator does X" scenario** needs the module to export its pieces — **REQ-RCD-00**.

---

## Open questions carried to design

1. **Which packer is normative** — resolved in V2 as `npm pack` for PMF; FIT-14 keeps `bun pm pack` for
   its own listing. Confirm at design that the two coexisting is intentional and documented.
2. **RCD-04.1**: baseline row rather than literal — confirm the baseline file carries a `builtins` row.
3. **FIT-14's independent build** (Isolation §3) — route through `ensureTscBuild()` in this change, or
   register as a followup? *QA recommendation: this change, since it multiplies the exposure.*
