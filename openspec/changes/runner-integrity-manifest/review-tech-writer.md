# Tech-Writer Review — drafted prose and naming (runner-integrity-manifest)

**Phase**: spec (V1 review, folded into V2) · **Lens**: tech-writer (opus, blind) · **Date**: 2026-07-25

> **This file is BUILD INPUT, not commentary.** The paragraphs in §2 and §3 and the messages in §5 are
> finished text to be used verbatim (or near-verbatim) by `sdd-apply`. Per the
> `test/docs/security-authoring-guard.test.ts` precedent, the source of truth for frozen strings is
> `design.md`; the docs page and the guard test both copy from there. Freeze 1–3 sentences per REQ,
> never whole passages — a fully frozen page cannot be improved without a test edit, and pages that
> are painful to edit rot.

---

## 1. Documentation homes

| Content | Home | Why |
|---|---|---|
| IID-01..08 — five Constraints, scope boundary, justification, entry-#24 reason, `bun link` guarantee, portability answer, known gaps | **`docs/runner-integrity-invariants.md`** (new; listed in `docs/README.md` → *Contributor notes*) | Same audience and shape as `docs/engine-sdk-wire-spec.md`, the existing cross-repo normative doc. Splitting seven REQs across five files guarantees drift; the engine's acceptance box wants ONE recordable artefact. |
| The four *decisions* | `openspec/decisions/00NN-*.md` | ADRs record **why we chose this**; the doc records **what must stay true**. ADRs link to the doc and never restate the Constraint list — two copies of a five-item list is the drift mechanism. |
| Header sentences | `src/transport/runner.ts`, `src/transport/single-instance-probe.ts`, `scripts/derive-runner-closure.ts` | Strongest live convention in this repo: headers state the non-obvious WHY and name the enforcing test. |
| Three sentences, scope-limiting only | `SECURITY.md`, new `## Runner integrity manifest` | It is the file a security researcher opens. Omit it and someone eventually cites the manifest as "the SDK verifies its own runtime integrity". |
| Verbatim-string guard | `test/docs/runner-integrity-docs.test.ts` | Precedent: `test/docs/security-authoring-guard.test.ts`. |

**`SECURITY.md` entry — drafted, to be guarded verbatim:**

> ## Runner integrity manifest
>
> Published releases carry `dist/runner-manifest.json`, which lets the engine check that the runner's
> pre-factory bootstrap — 23 files plus `package.json` — is the code we published. It is not a
> sandbox, not a signature, and not a check on the dialect, op-pack, or `node_modules` code that
> loads afterwards; those remain governed by the trust model above. See
> [docs/runner-integrity-invariants.md](./docs/runner-integrity-invariants.md).

**On `single-instance-probe.ts`'s header** (REQ-IID-08): its current eleven lines argue that `.resolve()`
keeps the call resolution-only. The fix is NOT to delete the argument — it is to add one sentence
converting it from an argument into a pointer:

> `Constraint 4 (docs/runner-integrity-invariants.md) makes this ENFORCED, not conventional: calling the require function returned by createRequire() fails the build (fit-42).`

A header that names its enforcing test survives; a header that merely argues gets edited away.

---

## 2. The honest scope paragraph — DRAFTED (REQ-IID-02)

Section heading: `## What the manifest covers — and what it does not`

> `dist/runner-manifest.json` lists 24 files: the 23 emitted `.js` files in the runner's static import
> closure, plus the package's root `package.json`. Those 24 are the code that runs **before** the
> runner imports the author's factory — the *pre-factory bootstrap*, and nothing beyond it. They are
> not "the runner" in the sense a reader is likely to assume, and they are certainly not "the SDK".
> `dist/commons/**`, `dist/dialects/**`, `dist/conformance/**`, `dist/testing/**` and everything under
> `node_modules/**` are absent from the manifest by design, and they load into the same process, at the
> same privilege, moments later — after the bootstrap has been checked and the factory import has
> begun. Their absence is deliberate, not an oversight: they are reachable only through the factory's
> dynamic import, which is the boundary of the accepted user-code threat model.
>
> A manifest that verifies therefore means one specific thing: **the bytes that bootstrap the run are
> the bytes we published**. It does not mean the run is verified, the SDK is verified, or that the code
> with the largest attack surface has been checked. Most of that code is outside the manifest on
> purpose.
>
> If a one-line form of this is needed elsewhere, use this one rather than composing a new one: *the
> manifest covers the runner's pre-factory bootstrap — 23 closure files plus `package.json` — and
> nothing that loads after it.*

**Three deliberate choices** (preserve them on any edit): (a) the negative shares a sentence with the
positive throughout, so no clause is quotable on its own as "the runner is verified"; (b) the register
is flat and mechanical — nothing that reads as a confession; (c) the last line supplies the pull-quote,
because people paraphrase whether we give them a sentence or not, and a supplied sentence is the only
way to control the paraphrase.

---

## 3. The justification paragraph — DRAFTED (REQ-IID-03)

Section heading: `## Why this exists`

> The obvious story — "it stops a malicious schematic author tampering with the SDK" — is not the
> story, and pretending otherwise would not survive the first person who checked. That adversary, as
> the engine's threat model defines them, has no write access to the installed SDK tree; their entire
> surface (the factory module, `schema.json`, argv) sits on the far side of the boundary this manifest
> draws. Hashing our own 24 files does not constrain them. This paragraph says so plainly on purpose:
> an engineer who works that out independently, six months from now, with nothing on the page to
> explain it, will reasonably conclude the mechanism is ceremony and delete it.
>
> It is not ceremony. It earns its place three ways, none of which is the story above.
>
> **1 — Wrong-artefact detection.** A partial install, a truncated extraction, an engine/SDK version
> skew, a stale `bun link` pointing at a tree built from different sources: ordinary, frequent, and
> today invisible until they surface as a confusing failure deep inside a run. The manifest converts
> them into one deterministic failure at the boundary, naming the file that disagrees. This is an
> availability and compatibility control, and it is the value users will actually collect, most weeks.
>
> **2 — The closure-sealing tripwires.** The build-time rules — no bare specifier, no unprefixed
> builtin, exactly one sanctioned dynamic `import()`, no unhashed-code-execution primitive — are where
> the durable security value lives, and they are worth keeping even if the manifest itself were retired
> tomorrow. They hold the runner's executed surface small, static and reviewable, and they fail the
> build on the day someone widens it rather than on the day someone exploits it. They are enforced by
> `fit-42`; they do not depend on the manifest existing.
>
> **3 — An adversary the stated model excludes.** The threat model is drawn around the schematic
> author. The most common real-world npm attack is not that one: it is a compromised transitive
> dependency or a `postinstall` script mutating an already-installed tree. The manifest does constrain
> that adversary — narrowly, for the bootstrap only (see *What the manifest covers*), but genuinely,
> and at no additional cost.
>
> The honest summary: this mechanism's **security** contribution is modest and bounded; its
> **correctness** contribution is large and routine; and the invariants it forced us to write down are
> worth more than the digests. Weigh all three before removing any part of it.

**Register note** (preserve on edit): the strongest concession goes first and is never repeated, so the
reader's scepticism is spent by the end of paragraph one and paragraphs 2–4 read as findings rather
than defence. "Most weeks" and "at no additional cost" do the anti-deletion work without a single
load-bearing adjective.

> **Update, engine round 2**: the engine has since RETRACTED the premise this paragraph argues against
> — the CLI proved a schematic author CAN write to the installed SDK tree (workspace `node_modules` +
> a containment gate with zero exclusion list). They now deny `SDKRoot`-subtree writes at ingestion.
> The paragraph's conclusion survives (the control that closes it is not the manifest), but the first
> sentence should be checked against their updated threat-model ADR when it lands, so the two documents
> do not contradict each other.

---

## 4. Naming (ratified into spec V2)

| Thing | Name | Rejected |
|---|---|---|
| Generator | `scripts/generate-runner-manifest.ts` | `emit-runner-manifest.ts` — "emit" is saturated here (`ir.emit`, `emitRejectionCode`) |
| npm script | `build:manifest`, chained **LAST** | — (last is the fail-safe order) |
| Shared module | `scripts/derive-runner-closure.ts` | `runner-closure.ts` — noun-only, no realm signal |
| Fitness pair | `test/fitness/fit-42-runner-closure-integrity{,.negative}.test.ts` | `fit-42-runner-manifest` — the manifest is the artefact; closure integrity is the invariant, and the tripwires must fire even when no manifest is written |
| Baseline | `test/fitness/runner-closure-graph-baseline.json` (`{nodes, edges}`) | `runner-closure-baseline.json` — without "graph" a reader assumes a flat path list and "simplifies" the edges away, which is exactly the data RP-2/RP-2c need |
| Docs page | `docs/runner-integrity-invariants.md` | `docs/runner-manifest.md` (reads as usage docs; invites deletion if the manifest is superseded); `docs/engine-sdk-runner-integrity.md` (the invariants outlive the counterparty — don't bind the filename to the engine) |
| Docs guard | `test/docs/runner-integrity-docs.test.ts` | — |
| Anchor | source marker `SANCTIONED-FACTORY-IMPORT` | — (makes prose, source marker and error message the same three words) |

**Collision flags:**

1. **`test/support/import-scan.ts` already contains a source-realm closure walker** (FIT-15/FIT-21). Two
   walkers over two realms is a standing confusion hazard — and the 24-vs-23 trap IS a realm confusion.
   Required mitigation, header first line of the new module:
   > `Walks the EMITTED dist/**.js graph — never src/**.ts (a source walk yields 24: engine-client.ts is import-type-only and tsc erases it). The source-realm walker is test/support/import-scan.ts (FIT-15/FIT-21); they are not interchangeable.`
2. **`fit-42` imports from `scripts/`, and `fit-27` asserts `scripts/regen-corpus.ts` is NOT reachable
   from the test-imported graph.** FIT-27's rule is corpus-specific so this is not a violation — but
   `fit-42`'s header must state that the import is sanctioned and why FIT-27's rule does not extend to
   it. Keep the module in `scripts/`: the build owns it, the test consumes it.
3. **Do not create new homes** for BPI-03 (→ existing `fit-23-publish-workflow-guard.test.ts`) or
   PMF-03 (→ existing `fit-14-package-surface.test.ts`).
4. **`openspec/specs/publish-pipeline-hardening` already exists** — add a cross-reference at archive.
5. **The manifest's field names are the engine's** (`manifestVersion`, `algorithm`, `entry`, `files`,
   `path`, `sha256`) — not ours to improve.

---

## 5. Error messages — DRAFTED (REQ-CST-01..04, RCD-03, BDI-03, BPI-04)

**Conventions**: prefix `runner-manifest:`; every message names the **`src` path to EDIT** (emitted
counterpart second only when they differ — ambiguity J); project-relative paths always (CI logs are
public artefacts and absolute paths leak the runner's home directory and username); **no character
ceiling** — REQ-WPS-07's 2000-char budget governs text crossing the wire, not a build message read by a
maintainer in a CI log; cap by offender count (`… and N more`) instead.

### Bare specifier (CST-01)
```
runner-manifest: src/transport/runner.ts:12 — bare specifier in the runner closure.
  found: import { Project } from "ts-morph"     (emitted: dist/transport/runner.js)
  rule:  Constraint 3 — no bare third-party specifier inside the closure.
  why:   "ts-morph" resolves into node_modules/, which the manifest does not cover, so it
         would execute unverified during the bootstrap.
  fix:   move the code that needs "ts-morph" behind the factory import, or into a module
         outside the runner closure (src/commons/**, src/dialects/**). If the runner must
         genuinely depend on it, the closure contract has changed — read
         docs/runner-integrity-invariants.md#constraint-3 and agree it with the engine
         before regenerating any baseline.
No manifest was written; dist/runner-manifest.json does not exist.
```

### Unprefixed builtin (CST-02)
```
runner-manifest: src/transport/single-instance-probe.ts:31 — builtin imported without the
`node:` prefix.
  found: import { readFileSync } from "fs"
  rule:  Constraint 3a — every builtin in the closure is written `node:`-prefixed.
  why:   "fs" is an ordinary package name that a node_modules/fs package can shadow;
         "node:fs" cannot be shadowed. The check is on the PREFIX, not on a list of builtin
         names — adding "fs" to an allowlist is not the fix.
  fix:   change the specifier to "node:fs".
No manifest was written; dist/runner-manifest.json does not exist.
```
*The "adding it to an allowlist is not the fix" clause is the point of this message: the prefix rule is
load-bearing and the wrong repair is more likely than the right one.*

### Dynamic import outside the sanctioned site (CST-03.1)
```
runner-manifest: src/transport/session.ts:88 — dynamic import() outside the sanctioned
factory-import site.
  found: await import(specifier)
  rule:  Constraint 2 — the closure contains exactly one dynamic import(): the author-factory
         import in src/transport/runner.ts, marked SANCTIONED-FACTORY-IMPORT.
  why:   a dynamic import() admits code no digest covers into the bootstrap; the one
         sanctioned site is the deliberate author-code boundary.
  fix:   use a static import if the target is already in the closure, or move the lazy load
         to the far side of the factory boundary. A second boundary is a contract change:
         docs/runner-integrity-invariants.md#constraint-2, agreed with the engine first.
No manifest was written; dist/runner-manifest.json does not exist.
```

### Second dynamic import INSIDE runner.ts (CST-03.2 — ambiguity D)
```
runner-manifest: src/transport/runner.ts:301 — second dynamic import() inside the
factory-import file.
  found: await import(pluginUrl)
  sanctioned site: src/transport/runner.ts:268, marked SANCTIONED-FACTORY-IMPORT — that one
         site is the author-code boundary; this is a different one.
  rule:  Constraint 2 — the sanction is per-SITE, not per-file. Living in runner.ts does not
         make an import() sanctioned.
  fix:   remove this import(), or route the work through the sanctioned site. If the runner
         needs a second dynamic boundary, that is a contract change:
         docs/runner-integrity-invariants.md#constraint-2, agreed with the engine first.
No manifest was written; dist/runner-manifest.json does not exist.
```
*The `sanctioned site:` line and the per-SITE clause make the message teach ambiguity D's resolution at
the exact moment someone has bumped into it — worth more than the same sentence in a document.*

### Unhashed-code-execution primitive (CST-04)
```
runner-manifest: src/transport/single-instance-probe.ts:39 — unhashed-code-execution
primitive in the closure.
  found: createRequire(anchorUrl)(specifier)   — the require function is CALLED
  rule:  Constraint 4 — the closure may RESOLVE, never EXECUTE.
         permitted: createRequire(...).resolve(...) at the anchored site
         forbidden: calling the require function itself, eval, new Function, node:vm,
                    Bun.plugin, process.binding
  why:   calling require() executes a CommonJS module with no import edge anywhere — it is
         invisible to the closure walk and covered by no digest. This precondition is not in
         the engine's original contract; we added it. See
         docs/runner-integrity-invariants.md#constraint-4.
  fix:   call .resolve(specifier) and load the result through a static import, or move the
         work outside the closure.
No manifest was written; dist/runner-manifest.json does not exist.
```
*For the CST-04.2 family only the top three lines change (`found: new Function(body)` /
`rule: Constraint 4 — forbidden primitive: new Function`). Same skeleton, so substring assertions stay
stable.*

> **Note vs signed spec**: R3 made Constraint 4 an **outright ban** on `createRequire` with the
> legitimate site exempted by anchor, so this message's `found:` line should read as a `createRequire`
> **reference** at a non-anchored site rather than specifically a call. Adjust at build; the skeleton
> and the `rule:`/`why:`/`fix:` structure stand.

### Unclassifiable construct (RCD-03.1)
```
runner-manifest: src/transport/frame-reader.ts:57 — import construct could not be classified.
  found: export * from moduleNameFor(kind)
  rule:  Zero silent skips — every import-like construct must classify as exactly one of
         { relative specifier, node:-prefixed builtin, the sanctioned factory-import site }.
  why:   an unclassifiable construct fails the build rather than being skipped, because a
         skipped edge is a hole in the closure that nothing downstream would notice.
  fix:   write the specifier as a string literal. If the construct must stay, the walker has
         to learn it — that is a change to scripts/derive-runner-closure.ts AND to
         docs/runner-integrity-invariants.md, not a special case here.
No manifest was written; dist/runner-manifest.json does not exist.
```

### Closure-graph baseline drift (BDI-03) — the message maintainers meet MOST often
```
fit-42: the runner closure changed.
  25 files are reachable from dist/bin/pbuilder-runner.js; the committed baseline has 23.
  added node:  dist/transport/retry-queue.js
  added edge:  dist/transport/session.js -> ./retry-queue.js   (src/transport/session.ts:14)
  removed:     (none)

This is not automatically wrong — the closure is allowed to grow. It is wrong if you did not
mean to change it. If you did mean it:
  1. check the new file against the constraints in docs/runner-integrity-invariants.md,
  2. regenerate: bun run build && bun run regen:closure-baseline,
  3. commit test/fitness/runner-closure-graph-baseline.json in the SAME commit, and say in
     the commit message why the closure grew — the engine verifies whatever we publish.
```
*Register matters more here than anywhere: the design is permissive-biased because a false alarm is
unrecoverable, so a legitimate closure change must not read as a security incident.*

### Manifest digest line (BPI-04.1)
```
runner-manifest: 24 files -> dist/runner-manifest.json
runner-manifest-sha256: 3f2a…{64 lowercase hex}
```
*Second line on its own, one key, `grep -o` friendly. The key must contain `manifest` — the failure mode
is a release note pasting one of the 24 file digests instead of the digest **of** the manifest.*

---

## 6. Terminology — canonical set

| Term | Means | Rule |
|---|---|---|
| **runner closure** | the 23 emitted `dist/**.js` reachable from the entry by static import edges | Define once as "static import closure"; use "runner closure" after. **Retire "import closure"** |
| **closure edge** | one static import relation between two closure files | The baseline holds nodes AND edges; the vocabulary must say so |
| **pre-factory bootstrap** | the 23 + `package.json`, as executed code | Neither "the runner" nor "the SDK". Every scope sentence uses it |
| **Constraint N — `<name>`** | one of the five properties the lemma requires | **Always name AND number**; never cite a bare number |
| **tripwire** | the build-time check enforcing a Constraint | Constraint = the rule; tripwire = the check |
| **invariant** | a property held by a permanent fitness test | Constraint 5 is engine-owned and is NOT an invariant of this repo — label it |
| **closure-sealing lemma** | the engine's argument that 24 digests ≡ hashing the tree | Their term. Use verbatim, attribute, coin no derivatives |
| **manifest digest** | the SHA-256 of `dist/runner-manifest.json` itself | One phrase, never "manifest identity"/"manifest SHA" |
| **wrong-artefact detection** | value #1 in the justification | Never write bare "tamper detection" — the overclaim the doc exists to prevent |
| **covers / attests** | what a manifest does | **The engine verifies; the manifest covers** |

**Inconsistencies found (all fixed in spec V2 except #1):**

1. **`entry` collides with "entry".** The manifest has a field named `entry` AND 24 members of `files`
   called entries. Resolution: reserve **`entry`** (code font) for the JSON field; call members **file
   records**. *Applied in spec V2; carry through design and code.*
2. "Constraint" vs "precondition" — canonical is **Constraint N**, the engine's vocabulary. Retain
   "precondition" only inside the lemma's own statement. **Numbering-collision hazard**: if the engine
   later adds *their* Constraint 4, our numbers silently disagree — hence "never cite a bare number"
   and "mark 4/5 SDK-added / engine-owned on first use" (REQ-IID-01.3).
3. Four names for one site → **the sanctioned factory-import site**.
4. Three names for the baseline → **closure-graph baseline**.
5. REQ-IID-01.1 restated Constraint 2 in the engine's UNRESOLVED wording ("no dynamic import on an
   infrastructure path"), contradicting ambiguity D — **a spec bug, fixed in V2 as IID-01.2**.
6. IID-02.1 omitted `dist/conformance/**` which RME-03.1 excludes — **fixed in V2**.

---

## Open questions carried to design

1. Is `runner-manifest:` the agreed message prefix? It will be frozen in `fit-42`'s substring assertions.
2. Does REQ-WPS-07's 2000-char ceiling extend to build tooling? *Recommendation: project-relative paths
   yes, character ceiling no.*
3. Does `SECURITY.md` get the three-sentence subsection? *Recommendation: yes.*
4. Where is the source of truth for the frozen strings — which numbered `design.md` section?
