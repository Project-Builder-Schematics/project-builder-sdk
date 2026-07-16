# North Star — React (TSX/JSX) Dialect (react-dialect)

**Checkpoint**: foresight (post-design, forward-looking) · **Verdict**: aligned
**Triage**: L (sensitivity-forced: security code-execution HIGH) · **Architecture impact**: additive
**Held against**: the ORIGINAL `problem_statement` (triage), not the spec.

## This is what we're going to do (in outcome terms)

Ship `@pbuilder/sdk/react` — a second dialect that lets a schematic author OPEN and MUTATE a
`.tsx` file that is a hard-throw today. Byte-exact `.tsx` parse/print (ts-morph `ScriptKind.Tsx`,
BOM/CRLF preserved), a `.tsx`-only `find()` gate with fix-naming rejects, and two v1 ops:
`setJsxProp` (genuinely JSX-native — sets/updates a prop on a uniquely-targeted element) and
`addImport` (wires an imported symbol in). Everything beyond those two is reachable through the
same universal `.modify(fn)` escape hatch the shipped dialect already offers. A load-bearing name
validator (element/prop names) plus a verbatim-trust `value` channel draw the injection boundary
explicitly.

## How it fits

Purely additive. A new leaf `src/dialects/react/{ast,ops,index}.ts` mirrors the proven
`typescript` leaf; the generic `defineDialect`/`withOps`/`createDialectHandle` seam takes ZERO
change (coalescing, containment, path-channel already dialect-agnostic). Two new library-agnostic
core helpers (`jsx-name-validator.ts`, `reject-tail.ts`), a 6th public subpath (`./react`) mirroring
`./typescript`, and test-side-only fitness additions (fit-36/37/38 codify existing boundaries; they
don't move one). Fidelity glue is DUPLICATED, not hoisted (ADR-01) — the shipped, sensitive TS
dialect is untouched. This is the "second consumer of the dialect contract" the problem's why-now
names.

## The outcome we're chasing

A schematic author who runs `ts.find("Component.tsx")` today gets
`"syntactically invalid TypeScript source"` — a wall, no workaround inside the SDK's dialect
surface. After this ships: `react.find("Component.tsx")` parses; the author sets a JSX prop, adds
an import, or does ANY AST mutation via `.modify(fn)`, and prints byte-exact. The hard block is
gone for the primary population (TypeScript-project `.tsx` authors).

## How we'll know it arrived (reckoning will hold delivery to this)

- The e2e author journey runs green FROM AN INSTALLED CONSUMER: `addImport` + `setJsxProp` on ONE
  handle coalesce to exactly ONE `modify` directive whose content shows the imported symbol wired
  into JSX, byte-exact vs a committed golden (REQ-RXD-07.1, REQ-LC-03).
- The previously-throwing `find(".tsx")` now parses and mutates; `Object.keys(dialect.ops)` equals
  exactly `["addImport","setJsxProp"]` (no smuggled ops).
- The injection boundary holds live: an unvalidated hostile prop name rejects pre-mutation
  (byte-unchanged file), the same payload as `value` is emitted verbatim by contract.
- Docs carry the coalesced worked example, the 2-op minimality + named follow-up catalog, the
  `.modify()` escape hatch, and the `value` trust warning — so an author learns the shape without
  reading the spec.

## The filed foresight question — answered

*Does this design, executed perfectly, RESOLVE the pain or merely produce correct outputs? Is
there a shorter path to the SAME outcome?*

RESOLVES it for the primary population. The unblock is achieved by parse/print + `.modify(fn)`
alone; the two structured ops are ergonomic capability on top AND the proof the op-pack contract
carries to a second dialect (the stated why-now). This is outcome, not outputs-without-outcome. No
materially shorter path survives the security/fidelity floor: the validator/`validatedOp`/no-echo
machinery is load-bearing (spike proved raw-splice injection is real), and the 20-sample JSX corpus
is required because the kit's 6 mandatory samples are JSX-blind. The weight is proportional to a
code-execution-sensitive surface, not ceremony.

## Promise↔delivery drift (forward-looking)

None material. Two items surfaced honestly for conscious owner affirmation, NOT logged as drift:

1. **`.tsx`-only vs the problem's "TSX/JSX" wording.** The problem statement and scope name
   "TSX/JSX"; v1 ships `.tsx` ONLY and rejects `.jsx` (owner-dictated at spec V4, registered as a
   pending row — not orphaned). Sound engineering reason (fidelity spike corpus is all `.tsx`;
   plain-JS `.jsx` under a TS project is unspiked print surface). A `.jsx`-only author is NOT
   relieved in v1. This is a ratified scope boundary, not a discovered gap — surfaced as CQ-2.
2. **2-op v1 carries a large security/fitness apparatus.** ~20 file changes, 5 ADRs, a validator
   subsystem, three new fitness functions for a two-op dialect. The PM lens already caught and
   fixed the "XL-disguised-as-L" smell on the rev-1 op pair; the remaining weight is the L-floor
   security machinery the sensitivity override mandates. Watch item, not a gap.

## Conscience questions (human-only — confirm before build closes)

These do not downgrade the `aligned` verdict (the design serves the purpose); they are the
usability/significance calls only the owner can make, surfaced so the answer is CONSCIOUS against
the original problem.

- **CQ-1 (usable?)**: Is a two-op-plus-`.modify()` dialect genuinely usable for the blocked
  authors, or does it move the pain from "can't open the file" to "can only ergonomically do two
  things"? (Context: this is parity with the shipped TS dialect's own escape-hatch model — the file
  is now fully mutatable via `.modify(fn)`; the two ops prove the JSX-native path end to end.)
- **CQ-2 (scope vs problem wording)**: The original problem names "TSX/JSX"; v1 relieves `.tsx`-only
  and defers `.jsx`. Does the owner affirm that the PRIMARY hurting population is TypeScript-project
  (`.tsx`) authors, and accept that `.jsx`-only authors stay blocked in v1 (pending-row tracked)?
- **CQ-3 (significant / why-now)**: Explore filed a why-now product question (go first on this
  capability vs the open security-hardening debt item 22 and the paused `ts-dialect-backend-ops`
  catalog). Signed spec + council-ratified proposal imply this was weighed — confirm it was a
  conscious priority call, not inertia.
