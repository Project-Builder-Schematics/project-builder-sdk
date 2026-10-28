Objective: React component ops — a component locator and `addHookCall`, `addComponentProp`, `renameJsxElement`, after the React op catalog (`odd/tasks/react-op-catalog.md`).
Branch: feat/react-add-hook-call, one PR for all three ops (owner choice, L4), starting from feat/react-add-jsx-child (#144). Test runner: `bun test` (focused: `bun test test/dialects/react`).

## Specs

S1 — Component locator. A component is found by name among the file's top-level `function Name` declarations (exported, default-exported or not) and top-level `const Name =` arrow functions or function expressions. Wrapped components (`memo(...)`, `forwardRef(...)`) are not found. Zero or several matches reject, pointing at `.modify()`. `component` is validated as a JavaScript identifier. (Default — owner may override.)

S2 — `addHookCall(component, statement)` inserts `statement` into the component's body after its leading hook calls (statements whose call starts with `use` followed by an uppercase letter or digit), or first when there are none, keeping the body's indentation. `statement` must parse as exactly one statement and is emitted verbatim; an identical statement already in the body is a no-op; an expression-bodied arrow rejects. (Default — owner may override.)

S3 — `addComponentProp(component, name, type, options?)` adds `name: type` (`name?: type` with `{ optional: true }`) to the component's props type and, when the first parameter is destructured, `name` to the destructuring. The props type is an inline type literal, or an `interface`/`type` literal declared in the same file and referenced by name; a component without parameters gets `({ name }: { name: type })`. A prop with the same name and type text is a no-op; a different type, an imported props type, or any other parameter shape rejects. `name` is an identifier; `type` must parse as one type. (Default — owner may override.)

S4 — `renameJsxElement(target, tag)` renames the ONE element `target` names, opening and closing tag together. `tag` follows the JSX element-name grammar; renaming to the same tag is a no-op. Imports are not touched (use `addImport`). (Default — owner may override.)

S5 — Rejects never echo `statement` or `type`; each op updates the React JSDoc, README ops table, `docs/authoring-a-dialect.md`, changelog, FIT-04 React baseline and the exact op-set test.

Out of scope until the owner asks: `.jsx` support.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1, S2, S5 | inline | done — RED 12 fail → GREEN 12 pass | single PR |
| T2 | S1, S3, S5 | inline | done — RED 15 fail → GREEN 15 pass | single PR |
| T3 | S4, S5 | inline | done — RED 6 fail → GREEN 6 pass | single PR |

Route evidence: one dependent chain (T2 reuses T1's locator), each unit forecast under ~400 lines; no writer trigger fires.

## Log

L1 (2026-10-29, user, verbatim): "de todos los que estaban en pending changes sobre ops cuales no hemos cubierto" — answered: `addComponentProp`, `addHookCall`, `renameJsxElement`, `.jsx` support; the first three share a component locator.
L2 (2026-10-29, user, verbatim): "Si dale" — to "¿Querés que arme el stack con esas tres ops, o preferís priorizar alguna?"
L3 (2026-10-29): #144 (land #141–#143 on main) still open; this stack starts from its branch.
L4 (2026-10-29, user, verbatim): "has un solo PR con los 3"
