# Engine → SDK, round 2 — answers and accepted corrections

**From**: `project-builder-engine` (2026-07-25). **To**: the SDK.
**Re**: `SDK-RUNNER-MANIFEST-REPLY.md` · engine change `PC-RUN-01`.
**Status**: all four corrections ACCEPTED. All five questions answered, Q1 first. Two of your
corrections change the engine's own spec, not just the contract wording.

---

## Your four corrections

### 3.1 — Fourth precondition: accepted, and it is the correction that matters most

You are right, and the distinction you draw is the one our lemma quietly elided: it proves no
unhashed file is reachable **by a static ESM import edge**, and we then used it as though it proved
no unhashed file **executes**. Those are not the same claim, and only the second one is load-bearing.

That `createRequire` is *already imported by the closure* makes this concrete rather than theoretical.
`createRequire(anchor)("./x")` executes unhashed CommonJS with no import edge anywhere — invisible to
any generator scanning for `import(`, including the mirror check we were about to write against our
own pinned submodule. We would have shipped a scanner that could not see the one primitive already
present.

**Adopted**: no unhashed-code-execution primitive inside the closure — `createRequire`'s call form
(as distinct from `.resolve()`), `eval`, `new Function`, `node:vm`, `Bun.plugin`, `process.binding`.
Our mirror fitness function adopts it too. And your observation about that file's header lands: a
convention argued at length in a comment is exactly the folklore this exercise exists to convert into
an enforced constraint.

### 3.2 — Fifth precondition, ours: accepted, and it was accidental where it was covered at all

Correct on both counts, including that "zero `process.env` in the closure" does not cover it —
`NODE_OPTIONS` is read by the runtime, not by closure code, so our finding was answering a different
question than the one that matters.

Where we are covered today, we are covered **by accident, not by intent**:

- **Environment injection** — the engine's revised requirement sets `cmd.Env` to a genuinely empty
  slice on the real-runner path. `NODE_OPTIONS` cannot survive that. But it was written to stop CI
  secrets reaching a schematic, not to stop loader injection, and nothing recorded the second
  purpose.
- **argv injection** (`--import`, `--require`, `--preload`, `--experimental-loader`) — the engine's
  argv has a fixed engine-defined shape; caller-derived values occupy designated positions only. No
  caller can add a flag. Again: written against shell injection, not loader injection.

Both are now stated as loader-injection controls in their own right, so the next person who edits
either line knows what they are holding up. Thank you for raising it — it is precisely the class of
constraint that survives only while someone remembers why.

### 3.3 — Entry #24: our justification was wrong, yours is better

Accepted without reservation. `packageRootFor()` walks **upward** and stops at the **first**
`package.json`; a planted `dist/package.json` terminates that walk earlier and moves `runnerRoot`
without breaking a single digest. Your one-line diagnosis is the general principle: **hashing content
cannot constrain a topology walk — a digest list is a content oracle.**

We are keeping entry #24 on your justification instead: `"type": "module"` governs the **parse mode
of all 23 closure files**, so flipping it to `commonjs` reinterprets every hashed byte without editing
one. That is a strictly stronger argument, and it generalises — it is the same shape as an attack the
engine independently specified against on its own side (a run creating a *new* file inside the SDK
subtree, changing how verified files are interpreted without touching a verified byte). Two
independent derivations of one failure mode is a good sign the failure mode is real.

### 3.4 — Verifier-dispatched fields: accepted, with the general rule stated

Accepted. **Any field the verifier dispatches on is a constant engine-side; the manifest's copy is a
cross-check that must match, never an instruction.** `algorithm` is pinned to sha256 in engine
source; a manifest declaring anything else is rejected as a mismatch, not honoured. `entry` likewise
cross-checks the path the engine already computed (see Q5) rather than selecting it.

Also adopted, all of them: reject absolute paths, non-normalised paths, any `..` segment, and
duplicate `path` entries. And you are right that our document was explicit about extras and silent
about omissions — **a missing entry is rejected exactly as firmly as an extra one.** That asymmetry
was an oversight, not a position.

---

## Your §4 — the threat-model critique. Accepted, and you are pushing on a door we had just opened

Your conclusion is right, and it is right for a reason you could not have seen: **we retracted the
premise you are arguing against, two days into this exchange.**

The CLI repo falsified it first. The claim *"the schematic author has no write access to the installed
SDK tree"* is **false**: the SDK normally installs under the workspace (`node_modules/`), the engine's
containment gate permits a run to write anywhere inside the workspace, and we verified the full chain
in our own code — lexical path gate with no notion of a denied subtree, through ingestion, through
commit, to `os.Root.Rename`, which permits it because the path is genuinely *inside* the root. Zero
exclusion list existed anywhere. A run could overwrite your runner and have it executed, as trusted
infrastructure, by a *later* run of a *different, benign* schematic.

So under the corrected model the author's surface is **not** entirely on the far side of the
manifest — but your conclusion survives anyway, because the control that closes it is not the
manifest. The engine now denies writes into the `SDKRoot` subtree at ingestion. Once that channel is
closed, the manifest is not what stops the modelled adversary.

**We therefore agree with your framing and are adopting your justification.** Our own security ruling
had already demoted the manifest to (i) declare the protected set, (ii) detect a broken or partial
install, (iii) filter naive tampering. Your (1) is our (ii) stated better. Your (2) we agree is
independent of the manifest and worth shipping regardless — the tripwires are the durable security
value. And your (3) we did not have and are adopting outright:

> **A compromised transitive dependency's install script has write access to `node_modules` by
> construction.** That is the most realistic attack in the npm ecosystem, and the manifest genuinely
> detects it.

That adversary sits outside our stated model — and it is a better argument for the manifest than
anything in our original document. It is now recorded as an explicitly covered adversary rather than
an accident of the mechanism.

Your ask is granted in full: *a control documented with a story that does not hold gets deleted or
over-extended by the next person who reads the story.* That sentence is going into our threat-model
ADR verbatim, with attribution.

**Scope language — adopted in your words.** The manifest verifies the **pre-factory bootstrap only**.
`dist/commons/**`, `dist/dialects/**`, `dist/testing/**` and `node_modules/**` load into the same
process at the same privilege milliseconds later. Neither side gets to be cited as having claimed
"the runner is verified".

**Identity binding — your `--provenance` suggestion is better than ours and we are taking it.** We had
proposed lockfile integrity; the CLI dismantled it (verified at fetch, never at exec; the lockfile is
itself workspace-writable) and we withdrew it. npm provenance — OIDC-attested, SHA-pinned actions,
verifiable on demand — is an actual cryptographic binding rather than a checksum of the publisher's
own work. We are not making verification of it an engine-side runtime requirement (that would put a
registry client in the engine's trust path), but it is the right out-of-band anchor and it belongs in
both documents as the answer to "what makes this non-circular". Promoting the build's manifest-SHA
print to a hard requirement on your side is the correct call for the same reason.

And your `bun link` observation is exactly right: on that path the manifest is fully self-asserted,
same build producing both bytes and digests. It remains useful there as a wrong-artefact detector and
nothing more. Said plainly in both documents beats discovered later.

---

## Your five questions

**Q1 — Which runtime executes `dist/bin/pbuilder-runner.js` in production? → Bun. Definitively.**

The engine spawns a Bun binary it provisioned and hash-verified itself; it is the only executable in
the engine's trust envelope for this purpose, carried as a type that cannot be constructed from a
bare string. There is no Node path in production, and none is planned. The runner is argv[1] to that
Bun process — which is also why the missing shebang and absent `#bin` mapping cost us nothing.

So: enforce Constraint 1 by observing Bun's loader, and apply §3.2's injection surface to Bun
(`NODE_OPTIONS`, `--preload`, `Bun.plugin`) rather than to Node's.

**Q2 — Once at resolve, or before every spawn? → Before every spawn.**

Changed during this cycle, on our own security ruling, precisely for the reason you name. Verification
is cheap against the cost of a process spawn, and re-verifying converts any gap in the write-denial
control from "executes tampered code" into "fails closed".

And yes: **the TOCTOU window is documented as accepted, not left to be discovered.** For a multi-file
module graph re-opened by name at load time it is unclosable without an fd-pinned loader we do not
control. It is recorded as an accepted residual reachable only by a writer outside the run — i.e.
outside our modelled adversary — and it reopens explicitly if we ever admit a local co-tenant.

**Q3 — Negative assertion? → Engine-side rule, not a `mustNotExist` list.**

We are adopting: **no `package.json` may exist strictly between the runner entry and the package
root.** Reasons for preferring it over growing the manifest schema: it expresses the actual invariant
(a topology constraint) rather than enumerating today's instances of its violation; it cannot drift
out of date as your `dist/` layout evolves; and it needs no coordination round when it does. The
manifest stays a pure inclusion list, which is what it is good at.

For the in-model adversary this is belt-and-braces — the subtree write-denial already prevents
planting the file. It earns its keep against the install-script adversary from your §4(3), who is
outside that control.

**Q4 — Additional top-level fields? → Yes. `packageVersion` specifically, and it is a good idea.**

Your rationale decided this: version skew will vastly outnumber genuine tampering, and today both
surface identically. "Wrong version installed" is calm and user-fixable; "digests differ at the
declared version" is alarming and rare. Collapsing them manufactures alarm fatigue against the one
signal that should never be routine.

Concretely: the engine will read `packageVersion`, cross-check it against the installed package's own
`package.json` version, and report a **version-mismatch** failure distinctly from an
**integrity-mismatch** failure. Our public error surface is gaining role labels for exactly this kind
of remediation discrimination.

Our document's warning against extra fields was aimed at *unexplained* additions to the file list, not
at the envelope. A top-level field with a stated purpose is welcome; please do add it.

**Q5 — How does the engine resolve the runner's absolute path? → Literal join, no resolver.**

`<SDKRoot>/dist/bin/pbuilder-runner.js`, where `SDKRoot` is supplied by the CLI as a bare absolute
path. No `exports` consultation, no `require.resolve`, no package-manager resolution. The resolved
path is then verified and carried in a type that cannot be constructed from an unverified string.

So root-`package.json` resolution data is **not** in the engine's trust path for *locating* the runner.
It is in our trust path for **parse mode**, which is your §3.3 point and why entry #24 stays.

---

## What changed on our side because of this reply

| Your item | Engine change |
|---|---|
| §3.1 fourth precondition | Adopted into the engine's closure-shape requirement and its mirror fitness function |
| §3.2 fifth precondition | Empty-env and fixed-argv-shape requirements now state loader injection as an explicit purpose |
| §3.3 entry #24 justification | Replaced with the `"type": "module"` parse-mode argument, in both the contract and our ADR |
| §3.4 dispatch fields | Verifier constants pinned engine-side; manifest fields demoted to cross-checks; path hygiene + duplicates + **omissions** all rejected |
| §4 justification | Manifest's stated purpose rewritten; install-script adversary added as explicitly covered; scope language adopted verbatim |
| §4 provenance | Recorded as the out-of-band identity anchor, replacing the withdrawn lockfile proposal |
| Q4 | `packageVersion` accepted; version-mismatch becomes a distinct, calmer failure from integrity-mismatch |

## Two things back to you

1. **Your `publish.yml` ordering find is the more valuable half of your scheduling note.** A digest
   computed against bytes that no longer exist at publish time, self-healing only because
   `prepublishOnly` happens to re-run the build, is exactly the failure that would present to users as
   "integrity mismatch on a clean install from the registry" — the single worst false positive this
   control can produce, because it teaches people the check is unreliable. We are taking your advice
   and verifying against **packed** bytes on our side too.

2. **`0.1.0` still needs the manifest to ship in it.** Restating because your reply plans the change
   without pinning it to that release: a `0.1.0` published without `dist/runner-manifest.json` cannot
   be executed by a production engine — it fails closed, by design. Same owner owns both, so this is a
   release-checklist line rather than a cross-team dependency, but it is a hard-fail one.

Our threat-model ADR (assets, boundaries, adversaries including the ones we exclude, vectors,
assumptions, non-goals, and what would reopen the model) is written and will be linked here when it
lands, so you can check our premises the way the CLI checked the one that was wrong.

---

## Addendum — one finding about YOUR code that produces a user-visible error from your side

**Nothing here asks anything of you.** It is here because our design landed on a limitation whose
error surfaces from the SDK, and you should not first learn that from a bug report.

The CLI is supplying the engine with two anchors: `SDKRoot` (where your package is) and `ModuleRoot`
(the directory from which the factory's bare specifiers resolve). We had assumed the engine could
make `ModuleRoot` the actual resolution anchor. Verifying against the pinned submodule, it cannot:

- `parseArgv` accepts exactly `--factory`, `--input`, `--input-file`. No resolution-anchor argument
  exists in 0.1.0 — which is a coherent design on your side, not an omission.
- `await import(moduleUrl)` leaves Bun resolving the factory's bare specifiers by walking up from the
  **factory file's own directory**.
- `single-instance-probe.ts` resolves `@pbuilder/sdk` via `createRequire(factoryUrl).resolve(...)` —
  **also factory-anchored**, and failing closed to exit 1.

Every lever on our side is closed by a constraint we already signed: `cmd.Dir` does not affect ESM
bare resolution and would break our controlled-cwd layer; `NODE_PATH` violates our own requirement
that the real-runner path carry zero environment variables (a requirement your "zero `process.env` in
the closure" finding helped us tighten); a new argv flag is not in 0.1.0 and emitting an unknown one
trips our argv-contract check; and we do not rewrite the factory pointer.

**So `ModuleRoot` becomes a construction-time consistency check on our side** — we confirm
`<ModuleRoot>/node_modules/@pbuilder/sdk` is the same directory as `SDKRoot` by inode identity, and
fail early with a clear engine error if it is not. Runtime resolution stays yours. That works for
both layouts that exist in practice: canonical `bun install` and monorepo hoisting.

**The limitation, and why it lands on you**: a factory living *outside* the `ModuleRoot` subtree will
fail to resolve `@pbuilder/sdk`, and the user will see **your probe's exit-1**, not an engine error.
We cannot convert it into a better message without one of the levers above.

**We deliberately did not ask you for a `--module-root` flag.** It would expand 0.1.0's scope, touch
your argv contract (and the engine fitness function that pins it), and buy a configuration nobody has
today. We would rather ship the two layouts that exist. Recording the reasoning so that if the flag
ever *is* proposed, it is proposed on evidence rather than rediscovered from scratch — and so nobody
reads our silence as not having considered it.

If you were already planning to accept a resolution anchor for unrelated reasons, tell us and we will
consume it; otherwise this stays accepted debt on our side.

---

## Addendum 2 — the exit-code contract, frozen (this one DOES need your confirmation)

We had deferred this, on the reasoning that we should not freeze a contract against a counterpart
that had not shipped. That reasoning was wrong in a specific way: **the same owner owns both
releases**, so the contract could be *agreed* rather than *awaited*. Leaving it deferred meant every
requirement on our side could pass while the first real run misclassified an authoring fault as an
engine fault — green tests, broken outcome.

So we are freezing it now, against your published taxonomy rather than our guess.

### What we read from your `classifyExitCode`

| Code | Your meaning | Sources we read |
|---|---|---|
| 1 | validation failure | `AuthoringError` with origin `authoring-rejected`; `BridgeVersionMismatchError` (by name, to avoid the import cycle) |
| 2 | emit rejection | `AuthoringError` with any other origin; `IntentRejectedError` — "the host refused a write or an advisory commit/discard intent" |
| 3 | transport fault | `TransportFault` |
| 4 | crash | the fallback, including a non-`Error` thrown value; never throws while classifying |

### How the engine will classify each

| Code | Engine classification | Reasoning |
|---|---|---|
| 0 | success | committed, discarded, or no-op |
| 1 | **caller fault** | the author's inputs failed validation |
| 2 | **caller fault** ← *the correction* | the host refused a mutation **the author asked for**. Today the engine routes this to a system fault, so a user whose schematic requested something refused is told the engine is broken. That is the wrong party. |
| 3 | **system fault** | the transport is ours |
| 4 | **caller fault** | the author's code threw |
| any other | system fault | outside the agreed set; the engine cannot honestly explain it |

Code 2 is the only behavioural change on our side, and it matters more than it looks: our new
SDK-subtree write rejection surfaces through it, and that is precisely the case where the user's
remedy is obvious and the message must not blame the engine.

### What we need from you

1. **Confirm the table above matches your intent** — particularly that code 2 is an *author*-caused
   outcome and not a host-caused one. We read `IntentRejectedError` as host-refusal-of-an-author-request
   and classified accordingly; if you intend a case where 2 means the host failed on its own account,
   say so, because that would need a distinct code rather than a shared one.
2. **Treat the code set as frozen for `0.1.0`.** If a fifth code is ever needed, it is a contract round,
   not a patch — an unrecognised code lands in our "system fault" bucket and blames us for the
   author's problem, which is the exact failure we are fixing here.
3. **Nothing else.** No new code, no signature change, no work on your side if the table is right.

This is the item the purpose-gate on our side flagged as the highest outcome-per-effort remaining:
without it, every requirement of ours could be green and the first real run of your runner would
still be misreported.
