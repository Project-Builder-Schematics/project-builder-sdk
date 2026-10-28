# css-dialect

Objective: ship `@pbuilder/sdk/css`, a PostCSS-backed dialect whose ops upsert and remove declarations so a schematic can sync design tokens into a CSS file that also holds hand-written rules.
Branch: `feat/css-dialect` (from main 4c0d1e2). Delivery: ask-on-risk. Test runner: `bun test`.

## Specs

- S1 — `.css` only in this feature; `.scss` is a later part two. User (L2): "arranquemos con .css y luego subimos a .scss como parte dos."
- S2 — Use case: sync design-system tokens exported from Figma to JSON into CSS. User (L2): "Estoy pensando el dialecto de css para cuando se necesita actualizar un design system por ejemplo que viene de figma y guarda los tokens en un json. Entonces mi pregunta seria, si quiero estar cambiando el valor de variables, agregando nuevos que ops nos beneficiarian?" Mapping token JSON to CSS names/values stays in the schematic, not the dialect.
- S3 — The target file keeps hand-written content the ops must not touch. User (L5): "si, va a tener @import y @custom-variant escritos a mano". Parse/print is byte-exact; an op edits only the declaration (or block) it addresses.
- S4 — Two ops, unified for custom and regular properties. User (L7): "si, unifiquemos en setDeclaration y removeDeclaration".
  - `setDeclaration(target, property, value, options?)`: updates the value in place when the property exists, otherwise inserts it; re-running produces the same file (an unchanged file emits nothing). User (L6): "que pasa si quiero agregar valores a un selector?"
  - `removeDeclaration(target, property)`: removes the declaration; a missing block or property is a no-op.
- S5 — `target` addresses one top-level block: `{ selector }` (`:root`, `html[data-theme='nylon']`), `{ atRule, params? }` (`@theme`), or `{ atRule, params?, selector }` (a rule inside an at-rule). Selector and params match after trimming, at-rule names case-insensitively.
- S6 — Placement. User (L3): "que pasa si las variables las necesito en un lugar en especifico? por ejemplo despues de los imports?" A missing block is created at the end of the file (always after `@import`, keeps the hand-written header on top). A new declaration goes last in its block, or next to an existing one with `{ before }` / `{ after }`; an anchor that does not exist fails; an existing declaration is updated in place and the anchor is ignored. Assumption: the block-level `{ before | after }` anchor from the design talk is deferred (not needed by the token case, where mode selectors outrank `:root`).
- S7 — Rules: regular property names compare case-insensitively, custom properties (`--x`) case-sensitively; `!important` is the `important` option, never part of the value; no shorthand/longhand reasoning.
- S8 — Fail closed, before any mutation, with the `dialect operation failed: ` prefix: an invalid property name, a value that is not exactly one declaration value (`;`, `}`, comments, `!important`), an invalid target, a target matching more than one block, a property declared more than once in the block, a missing anchor, both anchors.
- S9 — Publish `@pbuilder/sdk/css` with `export * as astLibrary from "postcss"`, an exact-pinned `postcss` dependency, guide `docs/css-dialect.md`, README, and every surface baseline.

- S10 — A value-returning query usable inside `.modify()`. User (L10): "dentro del .modify() llamas al getValue y le pasas el ast y el valor y te pasa el objecto o el valor. De ahi tomas decisiones." User (L11): "Si agregalo". `getDeclaration(root, target, property)` is a pure function exported by `@pbuilder/sdk/css` (not a handle op): it returns `{ value, important }` or `undefined` for a missing block or property, with the same target, name, ambiguity, and duplicate rules as the ops.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S3-S8 | inline | done — RED (module missing) then 48/48 GREEN | 3069055 |
| T2 | S1, S9 | inline | done — conformance, fitness, docs green | 3069055 |
| T3 | S10 | inline | done — RED (`getDeclaration is not a function`) then GREEN | 99747ad |

Route evidence: one understood dialect, two dependent units (T2 publishes T1), no writer trigger. T1 and T2 share one commit: FIT-08 forbids an unpublished dialect.

## Log

- L1 (2026-10-28): "si, arranca con la implementación"
- L2 (2026-10-28): "arranquemos con .css y luego subimos a .scss como parte dos. Estoy pensando el dialecto de css para cuando se necesita actualizar un design system por ejemplo que viene de figma y guarda los tokens en un json. Entonces mi pregunta seria, si quiero estar cambiando el valor de variables, agregando nuevos que ops nos beneficiarian?"
- L3 (2026-10-28): "1. para la ultima que pasa si las variables las necesito en un lugar en especifico? por ejemplo despues de los imports?"
- L4 (2026-10-28): "me gusta la propuesta, puedes revisar LCWebApp. pero en general, estamos usando tailwind viejo entonces se hace por el JS pero cuando migremos a tailwind 4 y no tengamos ese archivo de config lo que estoy pensando es tener un archivo de css solo para los tokens"
- L5 (2026-10-28): "si, va a tener @import y @custom-variant escritos a mano"
- L6 (2026-10-28): "ahora que otras operaciones podria hacer, que pasa si quiero agregar valores a un selector?"
- L7 (2026-10-28): "si, unifiquemos en setDeclaration y removeDeclaration"
- L8 (2026-10-28): research — PostCSS 8.5.30 (2026-10-12; 8.5.32 is days old) round-trips empty, BOM, CRLF, comments and compact sources byte-exact; appended declarations inherit sibling raws, but a new rule gets `selector{` and 4-space defaults, so new blocks get explicit raws. LCWebApp modes are selectors (`html[data-theme='nylon']`, `client/tailwindcss-config.ts:561`); Tailwind 4 tokens live in `@theme {}`.
- L9 (2026-10-28): verification — `bun test test/dialects/css test/conformance/css-conformance.test.ts` 53 pass; `bunx tsc --noEmit` clean; full `bun test` fails the same 7 test names as a scratch copy of origin/main (Bun 1.4.4 vs pinned engine, symlink/closure environment), none in the change. Risk: item 5 (new runtime dependency `postcss` 8.5.30 plus transitive nanoid, picocolors, source-map-js).
- L10 (2026-10-28): owner asked mid-task for a value-returning query usable inside `.modify()`: "que tan complicado es crear un operacion dentro del dialecto que te devuelva algo, dentro del .modify() llamas al getValue y le pasas el ast y el valor y te pasa el objecto o el valor. De ahi tomas decisiones. Si lo haces encadenado entonces ya no puede mutar, que opinas?" Not in scope until the owner decides.
- L11 (2026-10-28): "Si agregalo"
- L12 (2026-10-28): independent verifier on 3069055 — S1-S9 PASS, no blockers. Advisories: (1) a padded custom property value was rejected while a padded regular value was trimmed; (2) setting a hand-spaced custom property (`--a:  1 ;`) to the same value rewrote it; (3) a comment inside a custom property value is dropped when the value is set. (1) and (2) fixed by comparing trimmed values, pinned by two regression tests (RED observed); (3) stays: the value really changes. Docs now say custom property values may carry comments. `{ atRule: "theme" }` does not match `@theme inline {}` (needs `params: "inline"`), as documented.
- L13 (2026-10-28): native review of 3069055..99747ad (lenses risk, readability, reliability) approved and acknowledged (lineage review-fd824a4b1a3f0db3); all findings informational. Follow-ups fixed: getDeclaration doc example scoped to @theme (a bare walkDecls rewrote mode blocks); indent inference ignores a declaration on its brace line (RED observed: one-space indent); raw U+FFFF in CUSTOM_PROPERTY escaped; tests pin a mid-chain failure (zero modifies) and an ambiguous at-rule target. Kept: `validatedOp` imported from `core/jsx-name-validator.ts`, the documented shared chokepoint (renaming it would touch the React dialect).
