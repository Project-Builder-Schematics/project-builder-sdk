# Runner integrity invariants

`dist/runner-manifest.json` is a versioned (`manifestVersion: 1`) cross-repo contract: the engine
reads it before every spawn and verifies the bytes it is about to execute. This page records what
that covers, why it is worth having, the five properties the guarantee rests on, and the gaps we
know about. It is the contributor-facing counterpart to
[the engine ↔ SDK wire spec](./engine-sdk-wire-spec.md).

## What the manifest covers — and what it does not

`dist/runner-manifest.json` lists 24 files: the 23 emitted `.js` files in the runner's static import
closure, plus the package's root `package.json`. Those 24 are the code that runs **before** the
runner imports the author's factory — the *pre-factory bootstrap*, and nothing beyond it. They are
not "the runner" in the sense a reader is likely to assume, and they are certainly not "the SDK".
`dist/commons/**`, `dist/dialects/**`, `dist/conformance/**`, `dist/testing/**` and everything under
`node_modules/**` are absent from the manifest by design, and they load into the same process, at
the same privilege, moments later — after the bootstrap has been checked and the factory import has
begun. Their absence is deliberate, not an oversight: they are reachable only through the factory's
dynamic import, which is the boundary of the accepted user-code threat model.

A manifest that verifies therefore means one specific thing: **the bytes that bootstrap the run are
the bytes we published**. It does not mean the run is verified, the SDK is verified, or that the
code with the largest attack surface has been checked. Most of that code is outside the manifest on
purpose.

If a one-line form of this is needed elsewhere, use this one rather than composing a new one: *the
manifest covers the runner's pre-factory bootstrap — 23 closure files plus `package.json` — and
nothing that loads after it.*

## Why this exists

The obvious story — "it stops a malicious schematic author tampering with the SDK" — is not the
story, and pretending otherwise would not survive the first person who checked. That adversary's
declared surface (the factory module, `schema.json`, argv) sits on the far side of the boundary this
manifest draws. One route did reach the installed SDK tree in practice — a workspace `node_modules`
write the containment gate did not exclude — and the engine now denies `SDKRoot`-subtree writes at
ingestion: closed by a containment rule, not by any digest of ours. Hashing our own 24 files does
not constrain them. This paragraph says so plainly on purpose: an engineer who works that out
independently, six months from now, with nothing on the page to explain it, will reasonably conclude
the mechanism is ceremony and delete it.

It is not ceremony. It earns its place three ways, none of which is the story above.

**1 — Wrong-artefact detection.** A partial install, a truncated extraction, an engine/SDK version
skew, a stale `bun link` pointing at a tree built from different sources: ordinary, frequent, and
today invisible until they surface as a confusing failure deep inside a run. The manifest converts
them into one deterministic failure at the boundary, naming the file that disagrees. This is an
availability and compatibility control, and it is the value users will actually collect, most weeks.

**2 — The closure-sealing tripwires.** The build-time rules — no bare specifier, no unprefixed
builtin, exactly one sanctioned dynamic `import()`, no unhashed-code-execution primitive — are where
the durable security value lives, and they are worth keeping even if the manifest itself were retired
tomorrow. They hold the runner's executed surface small, static and reviewable, and they fail the
build on the day someone widens it rather than on the day someone exploits it. They are enforced by
`fit-42`; they do not depend on the manifest existing.

**3 — An adversary the stated model excludes.** The threat model is drawn around the schematic
author. The most common real-world npm attack is not that one: it is a compromised transitive
dependency or a `postinstall` script mutating an already-installed tree. The manifest does constrain
that adversary — narrowly, for the bootstrap only (see *What the manifest covers*), but genuinely,
and at no additional cost.

The honest summary: this mechanism's **security** contribution is modest and bounded; its
**correctness** contribution is large and routine; and the invariants it forced us to write down are
worth more than the digests. Weigh all three before removing any part of it.

## The five Constraints

The engine's closure-sealing lemma — their argument that verifying 24 digests is equivalent to
hashing the executed tree — holds only while all five of the properties below hold. Each is named
and numbered, never cited by bare number, because the two repos number independently and a silent
divergence would be invisible. Each carries an `enforced-by:` field naming the mechanism that
actually holds it, which a test resolves against the filesystem.

### Constraint 1 — no bundler and no code-splitting over the closure

- enforced-by: fit-42

Constraint 1 is enforced in CI, not by the build: a bundler that rewrote the module graph would
still produce a derivable closure, so the generator has nothing to fail on. `fit-42` compares
against the committed closure-graph baseline instead. Bundler invocations outside
`package.json#scripts` — workflow steps, `Bun.build({ outdir })`, calls from `scripts/*.ts` — are
out of scope for the disjointness check.

The realistic drift is not "someone adopts a bundler" — one already runs in this build, writing
`dist/bin/pbuilder-codegen.js` legitimately. It is "someone points the bundler already here at the
runner for startup performance."

### Constraint 2 — exactly one sanctioned dynamic `import()`, sanctioned per SITE and not per file

- enforced-by: fit-42

The closure contains exactly one dynamic `import()`: the author-factory import in
`src/transport/runner.ts`, marked `SANCTIONED-FACTORY-IMPORT`. That one site is the deliberate
author-code boundary. The sanction attaches to the site, not to the file — a second `import()`
inside `runner.ts` fails the build exactly as one anywhere else would, because living in the
sanctioned file does not make a call sanctioned.

### Constraint 3 — no bare third-party specifier, and every builtin `node:`-prefixed

- enforced-by: fit-42

A bare specifier resolves into `node_modules/`, which the manifest does not cover, so it would
execute unverified during the bootstrap. The builtin rule (3a) is on the **prefix**, not on a list
of builtin names: `"fs"` is an ordinary package name a `node_modules/fs` package can shadow, and
`"node:fs"` cannot be. Adding a name to an allowlist is never the fix.

### Constraint 4 (SDK-added) — the closure may RESOLVE, never EXECUTE

- enforced-by: fit-42

`createRequire(anchor)("./x")` executes unhashed CommonJS with no import edge anywhere — invisible
to the closure walk and covered by no digest. Any `createRequire` reference in a closure file is a
violation, with a single anchored exemption in `src/transport/single-instance-probe.ts`, whose use
is resolution-only. The same scan covers `eval`, `new Function`, `node:vm`, `Bun.plugin` and
`process.binding`.

This one is **SDK-added**: it is broader than the engine's original wording, which is why the
marker matters here. The engine adopted it into their own mirror check.

### Constraint 5 (engine-owned) — no loader injection at spawn

- enforced-by: engine-owned

Verifying bytes on disk says nothing if the process that executes them is started with a loader,
a preload hook or an import map that substitutes different code. That control sits entirely on the
engine's side of the boundary; this repo has no mechanism for it and does not claim one. It is
listed here so the lemma's preconditions are complete, not because we enforce it.

## Why `package.json` is entry #24

`package.json` is entry #24 because its `"type": "module"` field governs the parse mode of all 23
closure files: flipping it to `"commonjs"` reinterprets every hashed byte without editing one. It is
**not** included because of `packageRootFor()` — hashing content cannot constrain a topology walk.

## Portability

One manifest per published package, no per-platform map. The build is plain `tsc`, 1:1
file-per-source, with no platform conditionals, no env branching and no conditional subpath
resolution inside the closure.

## What a `bun link` install can and cannot tell you

On a `bun link` install the manifest is fully self-asserted — the same build produced both the bytes
and the digests — so verification degrades to a build-consistency check: a wrong-artefact detector
and nothing more.

## Known gaps

### The `dist/package.json` residual

A planted `dist/package.json` terminates `packageRootFor()`'s upward walk early and reinterprets
parse mode with **zero digest change**: a manifest is an inclusion list and cannot express absence.
The engine closed this on their side with a rule that no `package.json` may exist strictly between
the runner entry and the package root; `fit-42` stops the SDK being the source of the file.

### Graph-preserving emit rests on a convention, not a compiler flag

`fit-42` compares each emitted file's relative-specifier multiset against its source's, modulo
type-only erasure. That comparison assumes this repo's convention of writing erased imports as
explicit `import type` — and `tsconfig.build.json`, the config that actually produces `dist/`, does
not set `verbatimModuleSyntax` (only the separate typecheck config does), so nothing structurally
enforces the convention. A value-syntax import whose bindings are used only in type position would
therefore raise a spurious alarm. The failure direction is the safe one: it costs a CI alarm on a
benign refactor and can never hide a rewritten graph, because the detection that matters — an
emitted specifier with no source counterpart — is unaffected. The fix, if it fires, is to make the
source import `import type`; never to weaken the check.

### Loader observation for Constraint 1

Constraint 1 ships structural — correspondence, baseline, and disjointness — rather than by
observing what the runtime actually loads. Bun is confirmed as the production runtime, so runtime
observation is feasible and is registered as a followup; it is not implemented here.
