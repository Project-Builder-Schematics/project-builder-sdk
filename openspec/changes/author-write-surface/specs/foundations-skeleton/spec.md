# Delta for foundations-skeleton

**Spec version**: V4
**Status**: signed (owner, 2026-07-14 — V4 scope-reduction per foresight obs #2128)
**Change**: `author-write-surface`

(V4: owner-directed scope reduction at the post-design foresight gate (obs #2128) — the
importable `modify(handle, fn)` form is DEFERRED (`typescript-dialect` REQ-TSD-12 tombstoned),
so `dialect-authoring-standards` REQ-DAS-01 no longer mandates that doc content to exist. The
`modify(` sweep's V3 `modify(handle` exclusion clause is now MOOT — removed below. The sweep's
other two exclusions (`.modify(` chained, `factory.modify(`) are unaffected. Also fixes, in
passing (co-located edit), the exclusion-list parenthetical grammar nit carried from V3 (obs
#2125, nit 3): the "(not preceded by `.`...)" qualifier was mis-attached to `.modify(fn)` itself
— it now correctly qualifies the FREE-call predicate being targeted.)

## Glossary (pinned once, referenced by all domains)

- **`replaceContent(content)`** — the wholesale-replace verb: replaces a file's ENTIRE text in
  one shot. String-only; never a function argument.
- **`.modify(fn)`** — the AST escape hatch: a callback that mutates the SAME already-parsed,
  already-live AST instance a dialect handle's named ops mutate, in place. Function-only; never
  a string argument.

These two names are never interchangeable and never overloaded onto one method. Every domain
spec in this change uses "wholesale-replace" as the fixed adjective for `replaceContent` — never
"wholesale-text-replace", "wholesale string replace", or "wholesale-string-replace" (V1 drift,
corrected in V2 across `dialect-generics` and `authoring-error-contract`).

## MODIFIED Requirements

### REQ-KIT-03: `DirectiveFactory` — pure, ADR-0028 shapes, AST-blind

`DirectiveFactory` MUST expose one pure method per wire op returning the exact ADR-0028 directive; it MUST NOT render templates or touch an AST.

(Previously: the author-facing wholesale-replace verb was named `modify(path, content)`. Renamed to `replaceContent(path, content)` — the honest name for wholesale replacement — freeing `modify` for the AST-escape-hatch verb on dialect handles, `dialect-generics` REQ-DG-03. `DirectiveFactory`'s own internal pure method stays named `factory.modify(...)`: it is kit-internal, never author-facing, and produces the unchanged wire op `{op:"modify"}` — only the AUTHOR-facing verb renames, not the internal factory method or the wire op. V2: added the full doc/JSDoc-migration coverage the V1 rename left unstated — see the NEW bullets below.)

- GIVEN `create({pathTemplate, template, options})`, THEN it returns `{op:"create", create:{pathTemplate, template, options}}` with `template` byte-identical (unrendered).
- `remove(a)` emits wire op **`delete`** (`{op:"delete", delete:{path}}`) — author verb `remove` ≠ wire op `delete` (ADR-0028 vocabulary); the golden asserts `op:"delete"`.
- **Author surface (frozen public API — positional + trailing options)**: `find(path): FoundHandle` · `create(path, {template, options, force?}): WritableHandle` · `replaceContent(path, content): WritableHandle` · `remove(path): void` (also `find(path).remove()`) · `rename(path, newName, {force?}?): WritableHandle` · `move(path, toDir): WritableHandle` · `copy(from, to, {force?}?): WritableHandle`.
- **Author→factory mapping**: `create(path,{template,options,force?})`→`factory.create({pathTemplate:path,template,options,force})`; `replaceContent(path,content)`→`factory.modify({path,content})` (internal factory method name unchanged, see Previously note); `remove(path)`→`factory.remove({path})`→`op:"delete"`; `rename(path,newName,{force?})`→`factory.rename({path,newName,force})`; `move(path,toDir)`→`factory.move({path,toDir})`; `copy(from,to,{force?})`→`factory.copy({from,to,force})`.
- GIVEN `FoundHandle`/`WritableHandle` (the commons handle types), WHEN their shape is inspected, THEN they expose `.replaceContent(content: string)` and NEVER `.modify` — a compile-time negative pin (`handle.modify` fails to typecheck) proves commons handles carry only the string-replace verb; the AST-fn verb `.modify(fn)` exists exclusively on dialect handles (`dialect-generics` REQ-DG-03), never on commons handles.
- GIVEN the top-level commons verb after rename, WHEN `replaceContent("src/config.json", content)` is called inside a run, THEN it schedules the SAME wire directive `{op:"modify", modify:{path,content}}` the old `modify(path,content)` scheduled — byte-identical wire shape, only the author-facing call name changed (inherited author-visible outcome, carried forward from the pre-rename behaviour, now under the new name).
- NEW (V2, item 22 — confirming the inherited author-visible outcome explicitly): GIVEN an existing file at `path` with arbitrary prior content, WHEN `replaceContent(path, newContent)` flushes, THEN the file's content becomes BYTE-EXACT `newContent` — a full wholesale replacement of the entire prior content, never a merge or partial patch — the SAME outcome the pre-rename `modify(path, content)` produced, now reachable only under the new name.
- NEW (V2, doc/JSDoc-migration coverage — every author-facing `modify(content)`/`modify(path, content)` surface enumerated, each a RED-guard obligation, not a bare rename):
  - `docs/authoring-verbs.md`: the verb-list bullet (`- **\`modify(path, content)\`**` and its code fence, line ~27-34) reads `replaceContent(path, content)`; the "seven verbs" summary line (line ~9) lists `replaceContent` in place of `modify`; the read-trichotomy example's two calls (lines ~102, ~104) both read `replaceContent(...)`. A guard test scanning this file fails RED if `modify(` (as a bare two-arg commons call, not `.modify(fn)`) is still present anywhere in it. NEW (V2, discoverability): the `replaceContent` entry ALSO carries a cross-reference line pointing to `.modify(fn)` in `docs/authoring-a-dialect.md` — a first-contact reader scanning the commons verb list is pointed at the AST escape hatch's existence, not left to discover it only by reading the dialect doc separately; a guard test fails RED if this cross-reference line is absent.
  - `src/core/handle-state.ts`: `WritableHandle`'s JSDoc (`@example` at lines ~12-13, plus the verb-list comment at lines ~8 and ~16) reads `replaceContent`, not `modify`, in both the prose verb list and the `@example`'s call — the `@example` as shipped in V1 (`modify("src/config.ts", ...)`) would call a function that no longer exists on `WritableHandle` after this rename ships, i.e. it would document non-compiling usage. A guard test asserts the file contains no bare `modify(` call in its comments.
  - `README.md` (line ~17) and `docs/quickstart.md` (line ~179): both verb lists (`create, remove, move, rename, copy, modify` / `` `create`, `modify`, ... ``) read `replaceContent` in place of `modify`. A guard test scanning both files fails RED if either list still names `modify` as a verb.
  - `src/commons/index.ts`: the `find()` JSDoc `@example`'s three-branch read-trichotomy snippet (lines ~142-143, currently `modify("src/config.ts", seedContent)` / `modify("src/config.ts", patch(c))`) and the top-level `modify()` function's own JSDoc `@example` (line ~295, `modify("src/config.json", ...)`) both read `replaceContent(...)`. A guard test scanning this file's JSDoc comments fails RED if a bare `modify(` call remains in either `@example`.
- NEW (V2, second grep sweep — the `modify(` sweep; V3's predicate-narrowing exclusion REMOVED in V4, see below): `rg` for the commons verb-call pattern `modify(` used as a free two-argument call across `docs/**`, `README.md`, and every JSDoc comment under `src/**` MUST return 0 hits post-change; a guard test enforces this as a repo-wide fitness check, not a one-time manual scrub. The predicate targets ONLY the OLD commons string-form call — `modify(path, content)` / `modify("...", "...")` (a FREE call, i.e. NOT preceded by `.` — two STRING arguments, the retired wholesale-replace verb) — and EXCLUDES: `.modify(fn)` (the dialect AST escape hatch, chained form, always dot-prefixed, so never a "free call" to begin with); `factory.modify(` (the kit-internal `DirectiveFactory` method). (V4: the V3 exclusion for `modify(handle` + the importable-form doc snippets is REMOVED — it existed only to clear content `dialect-authoring-standards` REQ-DAS-01 mandated for the now-deferred importable form (`typescript-dialect` REQ-TSD-12, retired per obs #2128); with that mandate gone, the exclusion is moot and its absence is not a regression.)
- NEW (V3, third grep sweep — the real `.raw(` sweep, symmetric to the `modify(` sweep above; NO such sweep previously existed — earlier V2 drafting cited "the existing `.raw(` sweep" as justification for the `modify(` sweep's shape, but no repo-wide `.raw(` guard was ever specified anywhere in this change; that citation is corrected here, not merely restated): `rg '\.raw\('` across `docs/**`, `README.md`, `SECURITY.md`, `ROADMAP.md`, and every JSDoc/comment under `src/**` MUST return 0 hits post-change; a guard test enforces this as a repo-wide fitness check, failing RED otherwise. This sweep forces two surfaces this change would otherwise leave stale: (1) `src/dialects/typescript/index.ts` lines ~48-49 — the module-level JSDoc above `ts.find`'s opening example currently promises "the universal `.raw()` escape hatch"; author-facing, flows into IntelliSense hover text against the already-committed `typescript.index.d.ts` baseline (REQ-FIT-04) — MUST read `.modify()` post-change (pinned as `typescript-dialect` REQ-TSD-01.4). (2) `src/core/dialect-handle.ts` line ~22 — a kit-internal comment above the `isThenable` helper naming `.raw()`'s callback signature; never author-facing, lower severity, but caught by the same repo-wide sweep and MUST migrate to `.modify()` wording for internal consistency. SECURITY.md's and `docs/authoring-a-dialect.md`'s own `.raw()` migrations are already separately pinned (REQ-STD-01's absence check; the doc's REQ-DAS-01 rewrite) — this sweep is the repo-wide backstop that also catches ROADMAP.md and the two `src/**` comment surfaces neither of those REQs enumerate.
- NEW (V2, compile negative, pairs with `dialect-authoring-standards` REQ-KIT-03 rename and `typescript-dialect`'s export surface): `import { modify } from "@pbuilder/sdk/commons"` MUST NOT resolve or typecheck after this change — the commons subpath's named export is `replaceContent`, not `modify`; a compile-time negative pin proves the old import is gone, not merely undocumented.

### REQ-GIR-02: Chained-handle Batch fixtures

> RED posture: **must-fail-first** for the fixture-comparison tests as tests of NEW fixture
> shape (no multi-directive Batch fixture exists today — the test file/fixtures don't exist
> until written).

Golden-IR extends beyond single directives: ≥1 hand-written, committed **Batch** fixture (not
a bare `Directive`) exists per named chained-handle program. The SUT is the
FACTORY-PRODUCED batch captured (via `emit` spy) from a REAL `defineFactory` run — the
comparison is run-output vs. the hand-written fixture, never fixture vs. itself. The full
`instructions[]` array deep-equals the fixture, exact keys, in author order.

(Previously: the second scenario's example chain called `.modify(content)` on the returned
handle. Renamed to `.replaceContent(content)` — the committed fixture keeps its file name
`create-then-modify` as a WIRE-level label (the emitted directive's `op` stays `"modify"`,
byte-identical) even though the author-facing call is now `.replaceContent(...)`.)

- GIVEN a real `defineFactory` run that calls `rename(path, newName)` then chains
  `.move(toDir)` on the returned handle, WHEN the emitted batch (captured by spy) is
  compared to the hand-written `rename-then-move` fixture, THEN `instructions` deep-equals
  `[{op:"rename",...}, {op:"move",...}]` in order.
- GIVEN a real `defineFactory` run that calls `create(path, opts)` then chains
  `.replaceContent(content)` on the returned handle, WHEN the emitted batch is compared to
  the hand-written `create-then-modify` fixture, THEN `instructions` deep-equals
  `[{op:"create",...}, {op:"modify",...}]` in order — the fixture name and wire `op` both
  stay `"modify"` (wire IR untouched); only the author-facing call renamed.

### REQ-FIT-04: public `.d.ts` semver gate

Committed baseline + CI diff; a breaking export change without a version bump fails. The
baseline pair set already includes a committed `typescript.index.d.ts` baseline for the
`./typescript` subpath (alongside the existing `index`/`commons.index`/`conformance.index`/
`core.*` pairs — 9 pairs total, `typescript.index.d.ts` among them, pre-existing before this
change). This change ADDS exactly ONE new pair, the 10th: `core.define-dialect.d.ts`.

(Previously (V1, CORRECTED in V2): V1 mischaracterised `typescript.index.d.ts` as a NEW
baseline this change adds. It is NOT new — `DTS_PAIRS` already lists it, and it is already
committed; verified live against the current tree. The ONLY new pair this change adds is
`core.define-dialect.d.ts` — the 9 existing pairs, `typescript.index.d.ts` included, are
untouched by this REQ beyond their normal CI diff. V1's underlying concern stands: of the 9
existing pairs, none showed `Handle`'s literal shape — verified live during exploration —
which is why the 10th pair is required, not why a 10th `typescript` pair is needed.)

- GIVEN the `./typescript` subpath's emitted `.d.ts`, THEN the ALREADY-COMMITTED
  `typescript.index.d.ts` baseline (one of the 9 pre-existing `DTS_PAIRS` entries) continues to
  exist and CI continues to diff against it on every change — this change does not add or
  recreate this pair.
- GIVEN `core/define-dialect.ts`'s emitted `.d.ts`, THEN a committed `core.define-dialect.d.ts`
  baseline exists as the NEW 10th `DTS_PAIRS` entry, and CI diffs against it; the pair's FIRST
  commit — landing in this change — is additive by definition, but it is now permanently gated
  for every subsequent change to `Handle`/`DialectWriteOps`.
- NEW (V2): the `core.define-dialect.d.ts` baseline's committed content MUST genuinely EXHIBIT
  the `Handle` shape this change ships — its text MUST contain both `replaceContent` and
  `modify(fn: ...)` (or the equivalent AST-fn signature) among `Handle`'s members, and MUST
  contain ZERO occurrences of `raw` as a member name — a vacuous placeholder baseline (e.g. an
  empty module or a baseline that doesn't actually re-export `Handle`) fails this assertion even
  though a file technically exists at the path.

### REQ-STD-01: Public-repo standards + contributor on-ramp doc

CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (MUST state the explicit-trust posture: importing any
dialect/op-pack runs its code with full process privilege; no sandbox/signing in v1; vet
before importing), issue/PR templates, CI runs on forks/PRs. SECURITY.md MUST ALSO carry a
`.modify(fn)`-SPECIFIC verbatim trust sentence (full-privilege, not-a-sandbox, seam-is-the-only-
guarantee) PLUS a "conformance ≠ safety" caveat (passing the conformance kit,
`dialect-conformance`, is not a security attestation). A guard test MUST pin BOTH the general
explicit-trust sentence and the `.modify(fn)`-specific sentence + caveat as EXACT substrings.
`docs/authoring-a-dialect.md` graduates from a titled stub to REAL, ACCURATE content per
`dialect-authoring-standards` REQ-DAS-01/02 — the guard test also asserts the file exists
with its mandated sections.

(Previously: the `.raw()`-specific trust sentence (`RAW_TRUST_SENTENCE` in
`test/docs/security-authoring-guard.test.ts`) named the escape hatch as `.raw(ast => …)`.
Renamed: the sentence and its test constant now name the escape hatch as `.modify(ast => …)`
— same trust posture (full process privilege, not a sandbox, serialization-seam-is-the-only-
guarantee), same "conformance ≠ safety" caveat, byte-exact substrings re-pinned against the
new wording. This is a rename of an existing frozen sentence, not new security policy.)

- GIVEN the repo, THEN `docs/authoring-a-dialect.md` exists with the REQ-DAS-01 mandated
  sections; AND SECURITY.md states the explicit-trust posture verbatim.
- GIVEN SECURITY.md, THEN it ALSO contains the `.modify(fn)`-specific trust sentence and the
  "conformance ≠ safety" caveat verbatim (both renamed from their `.raw()`-worded originals),
  and a guard test fails RED if either substring is removed or reverts to the old `.raw()`
  wording.
- NEW (V2, absence check, mirrors `dialect-authoring-standards` REQ-DAS-01.1's doc-scan
  discipline): GIVEN SECURITY.md post-change, WHEN it is scanned for the literal substring
  `.raw`, THEN ZERO occurrences exist anywhere — header or body — not merely "the new sentence
  is present"; a guard test fails RED if a stray `.raw()` reference survives the migration
  alongside the renamed sentence.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) — Author surface rename, FIT-04 10th baseline pair | REQ-KIT-03, REQ-GIR-02, REQ-FIT-04 | Yes |
| security (code execution) — SECURITY.md trust sentence renamed onto `.modify(fn)` | REQ-STD-01 | Yes |
