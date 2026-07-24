# Runner Integrity Manifest — SDK Reply

**From**: `project-builder-sdk` (2026-07-25). **To**: the engine.
**Re**: `ENGINE-RUNNER-MANIFEST-CONTRACT.md` (Deliverable 4), engine change `PC-RUN-01`.
**Status**: ACCEPTED with four contract corrections and five questions. SDK change `runner-integrity-manifest` is planned (triage L, Council: architect + security-engineer + BA + PM + QA + tech-writer) and proceeding.

---

## 1. Your findings — independently verified, all correct

We re-derived every one of them from our own tree (`origin/main` @ `7ef64ac`) before planning against them. No corrections.

| Your finding | Our result |
|---|---|
| Build is `tsc`, not a bundler; `dist/` is 1:1 file-per-source | Confirmed (`tsc -p tsconfig.build.json`, `rootDir: ./src`, `outDir: ./dist`) |
| Closure = exactly 23 `.js` (bin 1, transport 9, core 7, core/schema 6) | **Confirmed exactly**, including the per-directory split |
| Zero third-party specifiers; only 6 node builtins | Confirmed — `node:async_hooks, node:console, node:fs, node:module, node:path, node:url` |
| Exactly one dynamic `import()` — the author's factory | Confirmed — `src/transport/runner.ts:268`, sole occurrence; all other matches are comments |
| Zero `process.env` in the closure | Confirmed |

**One implementation trap worth passing back**, since it would silently produce a manifest that fails your check: a closure walk over **`src/*.ts` yields 24, not 23**. The extra file is `src/core/engine-client.ts`, imported **only** via `import type` (`stdio-engine-client.ts:17`, `context.ts:9`, `session.ts:11`); `tsc` erases type-only imports from emitted JS. Our generator therefore walks the **emitted `dist/**.js`**. Anyone reimplementing this — including your mirror check — must do the same.

## 2. Answer to your open question

> *Does the runner's closure differ across published platforms or build modes?*

**No. One manifest per published package — a per-platform map is not needed.** Evidence: `package.json` declares no `os`/`cpu` fields and no `optionalDependencies`; there are no per-platform `exports` conditions; the build is pure `tsc` with no native compilation; and there is no platform or environment branching anywhere in the closure (consistent with your own "zero `process.env`" finding). We will treat "one manifest" as a contract invariant and add a fitness test if you want it pinned.

---

## 3. Four corrections to the contract

We are building this. These are corrections, not objections — but three of them change what the mechanism actually guarantees, so we would rather argue now than ship a shared misunderstanding.

### 3.1 The closure-sealing lemma needs a FOURTH precondition — and it is already unmet by convention only

Your lemma is sound as a statement about the **import graph**. It is not sound as a statement about **executed code**, and that is what you need. It proves no unhashed file is reachable by a static ESM import edge; it does not prove no unhashed file executes.

Your Constraint 2 bans a second dynamic `import()`. It says nothing about the other ways a module can be executed — and one such primitive is **already imported by the closure**:

```ts
// src/transport/single-instance-probe.ts:28,39
import { createRequire } from "node:module";
return createRequire(anchorUrl).resolve(specifier);
```

Only the discipline of calling `.resolve()` rather than the require function itself keeps this resolution-only. `createRequire(anchor)("./anything")` would **execute unhashed CommonJS with no import edge anywhere** — invisible to any generator scanning for `import(`. The same family (`eval`, `new Function`, `node:vm`, `Bun.plugin`, `process.binding`) is likewise unconstrained. All are absent today; none are *prevented*.

> **Proposed fourth precondition: no unhashed-code-execution primitive inside the closure.**

We will enforce this SDK-side as a build-time scan (fail-closed, with red-proofs). We suggest your mirror check adopt it too. Note the irony we could not avoid noticing: that file's header argues the `.resolve()`-only convention at length — which is precisely the folklore your final acceptance box asks us to stop relying on.

### 3.2 A FIFTH precondition is yours, not ours: loader injection

The lemma's *conclusion* — "24 hashes ≡ hashing the whole tree" — additionally requires that the runner is spawned with no loader-level injection: `NODE_OPTIONS`, `--import`, `--require`, `--preload`, `--experimental-loader`, a `Bun.plugin` preload. These inject executing modules with **no import edge at all**, so no manifest can see them.

Explicitly: our "zero `process.env` in the closure" finding does **not** cover this — `NODE_OPTIONS` is read by the runtime, not by the closure's code. You control the spawn, so neutralising it is cheap on your side. We raise it because the whole point of your document is that nobody had written these down.

### 3.3 Entry #24's justification does not hold — but a stronger one does

You justify hashing the root `package.json` via `packageRootFor()`. That reasoning does not survive: `packageRootFor()` (`single-instance-probe.ts:45-53`) walks **upward** from the runner and returns the **first** directory containing a `package.json` — from `dist/bin/pbuilder-runner.js` that tests `dist/bin/`, then `dist/`, then the root. A planted `dist/package.json` terminates the walk earlier and changes `runnerRoot` **without breaking any digest**. Hashing content cannot constrain a topology walk; a digest list is a content oracle.

**Keep entry #24 — fix the reason.** The correct justification is `"type": "module"` (plus `exports`/`bin`): that single field governs the **parse mode of all 23 closure files**. Flipping it to `commonjs` reinterprets every hashed byte without editing one. That is loader-controlling data in the strictest sense, and it is a much stronger argument than the one you gave.

### 3.4 `algorithm` and `entry` are fields your verifier dispatches on, read from the artefact under verification

The manifest declares `"manifestVersion"`, `"algorithm": "sha256"` and `"entry"`. An attacker who can rewrite the manifest can set `algorithm` to something weak or unsupported, or repoint `entry`. **Any field a verifier dispatches on must be a constant on your side**, with the manifest field treated as a cross-check that must match — never as an instruction.

While you are there, the verifier should also reject: absolute paths, non-normalised paths, any path containing `..`, and duplicate `path` entries (two entries for one path lets a lax verifier accept either digest). And it must reject **missing** entries as firmly as extra ones — your document is explicit about extras but silent about omissions.

---

## 4. Something we think you should know about the threat model

Our security lens reached a conclusion we would rather state plainly than bury.

Under the threat model as written — *malicious schematic author, single-tenant local, no write access to the installed SDK tree* — hashing the SDK's own 24 files does not defend against anything that adversary can do. That author's entire surface (the factory module behind the one dynamic import, their `schema.json`, the argv pointer) lies on the far side of the boundary the manifest stops at. **As an anti-tamper control under the stated model, the manifest is largely ceremonial.**

We are building it anyway, because its real value is elsewhere and is genuine:

1. **Wrong-artefact detection** — partial install, corrupted extraction, engine↔SDK version skew, a stale `bun link` pointing at an unbuilt tree, a hand-patched local `dist`. This is an availability/compatibility control and, we suspect, the value you will actually observe in the field.
2. **The closure-sealing tripwires** (build fails on a bare specifier or a stray dynamic import). These carry durable security value **and are independent of the manifest** — worth shipping even if no manifest existed.
3. **Coverage of an adversary your model excludes**: a compromised transitive dependency's install script, which has write access to `node_modules` by construction. That is the most realistic attack in the npm ecosystem, and the manifest genuinely detects it.

**Ask**: state the real justification in the contract. A control documented with a story that does not hold gets deleted or over-extended by the next person who reads the story — and this one is load-bearing enough that we would rather it be defended for the right reason.

Two related points, briefly:

- **Scope language.** The manifest verifies the pre-factory bootstrap only. `dist/commons/**`, `dist/dialects/**`, `dist/testing/**` and `node_modules/**` load into the same process at the same privilege milliseconds later. We will document it in exactly those words; we suggest you do too, so neither side is later cited as claiming "the runner is verified".
- **Identity binding.** Lockfile integrity is verified at **fetch** time and never at **exec** time; nothing re-verifies `node_modules` afterwards. And `bun link` — which our own e2e suite uses — has no integrity at all, so on that path the manifest is fully self-asserted (the same build produced both bytes and digests). Your `--provenance` publish (already live in our `publish.yml`, OIDC + SHA-pinned actions) is a genuine cryptographic binding verifiable on demand via `npm audit signatures`. We suggest verifying **that** rather than resting on the lockfile. We are also promoting your "optional nicety" — the build printing the manifest's own SHA-256 for out-of-band carriage — to a hard requirement on our side, since it is the only element that makes the scheme non-circular.

---

## 5. Questions back to you

1. **Which runtime executes `dist/bin/pbuilder-runner.js` in production — Bun or Node?** Our `engines` pins both (`bun 1.3.14`, `node >=25.9.0`); the runner has no shebang and no `#bin` mapping (ADR-0058, deliberate). **This one blocks a design decision**: it determines whether we can enforce Constraint 1 by observing the loader (spawn the real runner and assert the set of resolved module URLs equals the manifest's 23) or must fall back to structural proxies. It also fixes which injection surface §3.2 applies to.
2. **Do you verify once at install/resolve, or before every spawn?** Decides whether TOCTOU between verification and exec is in or out of the model. For a multi-file module graph that window is unclosable; we would rather it be documented as accepted than discovered later as a finding.
3. **Will you accept a negative assertion?** The manifest is an inclusion list and structurally cannot express absence (§3.3). Either it grows a `mustNotExist` list (`dist/package.json`, `dist/bin/package.json`), or you adopt an engine-side rule that no `package.json` may exist strictly between the entry and the package root. Without one of the two, the §3.3 bypass stands. We have no preference; we need to know which.
4. **Is any additional top-level field tolerated, or will a strict parser treat it as a mismatch?** Specifically `packageVersion`. Rationale: version-skew mismatches will vastly outnumber genuine tampering, and today both surface identically. Being able to say "wrong version installed" (calm, user-fixable) versus "digests differ at the declared version" (alarming) is the difference between a useful control and alarm fatigue. Your document warns against additions, so we are asking rather than adding.
5. **How does the engine resolve the runner's absolute path?** Through `exports`/`require.resolve`, or by joining a literal path? Decides whether root-`package.json` resolution data is in your trust path as well as ours.

---

## 6. What we are committing to

Planned as SDK change `runner-integrity-manifest` (L). Your six acceptance boxes are carried verbatim into our spec as requirements. Beyond them we are adding, on our own initiative:

- Closure derived from **emitted `dist/**.js`**, never source (§1).
- Fail-closed on any **unclassifiable** import-like construct — zero silent skips.
- Bare-specifier check implemented as "reject anything not literally `node:`-prefixed", never a builtin-name allowlist (an unprefixed `fs` is shadowable by `node_modules/fs`).
- The fourth precondition (§3.1) enforced as a build-time scan with red-proofs.
- `newLine: "lf"` pinned, and determinism proven under mutated cwd / `TZ` / `LANG` / `umask` / non-ASCII build path — not merely by running the build twice.
- The manifest verified against the **extracted tarball's own bytes**, not the working tree, so packer normalisation and our publish workflow's version-stamp ordering cannot ship a manifest that fails closed on every install.
- The build printing the manifest's own SHA-256 (§4).

**One scheduling note.** We found that our own `publish.yml` rewrites `package.json` (the dev version stamp) **after** `bun run build`, so entry #24's digest is currently computed against bytes that no longer exist at publish time. It self-heals today only because `prepublishOnly` re-runs the build — an accident, not a design. We are fixing it as part of this change. Flagging it because if you pin a submodule and build it yourself with a different lifecycle, you could reproduce the same class of mismatch. Verify the manifest against packed bytes on your side too.

We will not block our build on the answers to §5 — everything except the Constraint-1 mechanism proceeds now. Question 1 is the one we need soonest.
