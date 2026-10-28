Objective: React op catalog — a shared JSX element target (tag + props) and the JSX ops `removeJsxProp`, `addJsxChild`, `wrapJsxElement`, on top of the TypeScript-extending React dialect (#139).
Branch: one branch per PR, stacked to main (owner choice, L4), starting from feat/react-extends-typescript. Test runner: `bun test` (focused: `bun test test/dialects/react test/conformance/react-conformance.test.ts`).

## Specs

S1 — JSX target. Owner choice, verbatim: "Tag + props (Recommended)", with the preview `{ tag: "Route", props: { path: '"/users"' } }` and `// "Button" sigue valiendo como atajo de { tag: "Button" }`. A target is a tag string or `{ tag: string; props?: Record<string, string | true> }`. An element matches when its tag-name text equals `tag` and every listed prop is present: a string value must equal the attribute's initializer source text (`'"/users"'`, `'{id}'`); `true` matches any value, shorthand included. Zero or several matches reject; the reject names the tag and the prop names, never prop values. `tag` and prop names are validated with the existing element/attribute name grammar. (`true` form: default — owner may override.)

S2 — `setJsxProp(target, prop, value?)` accepts a target; a string target behaves exactly as today.

S3 — `removeJsxProp(target, prop)` removes the named attribute from the target element; an absent attribute is a no-op; spread attributes are never touched. (Default — owner may override.)

S4 — `addJsxChild(target, jsx)` appends `jsx` as the target's last child, turning a self-closing target into an open/close pair; `jsx` must parse as exactly one JSX element or fragment; a child with the same text already present is a no-op; the new line follows the siblings' indentation. (Default — owner may override.)

S5 — `wrapJsxElement(target, wrapper)` wraps the target in `wrapper`, a self-closing JSX element (`'<QueryProvider client={qc} />'` → `<QueryProvider client={qc}><App /></QueryProvider>`); a target whose direct parent already has the wrapper's tag is a no-op. (Default — owner may override.)

S6 — Trust and docs: `jsx`, `wrapper` and prop values are emitted verbatim (the `setJsxProp` `value` trust boundary); rejects never echo them. Each op updates the React JSDoc, README ops table, `docs/authoring-a-dialect.md`, the FIT-04 React baseline and the exact op-set test.

Out of scope until the owner asks: `addComponentProp`, `addHookCall`, `renameJsxElement`, `.jsx` support.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T0 | — | inline | done — React extends the TypeScript ops, 0.11.0 | 4c180e2 (#139) |
| T1 | S1, S2, S6 | inline | done — RED 8 fail → GREEN 8 pass; full suite 3788 pass, 8 fail = the 7 failing on main + FIT-04 baseline (updated) | PR 2 |
| T2 | S1, S3, S6 | inline | pending | PR 3 |
| T3 | S1, S4, S6 | inline | pending | PR 4 |
| T4 | S1, S5, S6 | inline | pending | PR 5 |

Route evidence: one dependent chain (T2–T4 build on T1's target), each unit forecast under ~400 lines; no writer trigger fires.

## Log

L1 (2026-10-28, user, verbatim): "Si me gustaria pero tambien quiero ver que posibles operaciones le hace falta a react especificamente"
L2 (2026-10-28, user, verbatim): "me parece la A" — React adopts the TypeScript `addImport`; shipped as T0.
L3 (2026-10-28, user, verbatim): "baja cambios de main, haz un commit con un minor bump + changelog" / "y continua en un PR stack con disenar las otras ops"
L4 (2026-10-28, user): chain strategy "Stacked a main (Recommended)".
L5 (2026-10-28, user): selector "Tag + props (Recommended)" (S1).
L6 (2026-10-28): Engram mirror `odd/react-op-catalog/tasks` pending — `mem_current_project` returned an ambiguous project for this directory.
L7 (2026-10-28, user, verbatim): "recuerda crear un issue del repo de docs para actualizar la informacion sobre el dialecto" — filed Project-Builder-Schematics/project-builder-docs#31; later PRs extend it.
