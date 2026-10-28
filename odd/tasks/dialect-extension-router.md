Objective: per-extension dialects in the core — one `find` that routes by file extension to a dialect with its own AST and ops — adopted first by React for `.jsx`, later by Angular for `.html`.
Branch: feat/react-jsx-files (from main after #146). Delivery: ask-on-risk; core and React adoption as separate commits. Test runner: `bun test` (focused: `bun test test/core test/types test/dialects/react`).

## Specs

S1 — Owner choice, verbatim: "Mismo find, rechazo en runtime (Recommended)" for `.jsx`: `react.find()` accepts `.tsx` and `.jsx` with the same handle; ops that write type syntax reject on `.jsx`, leaving the file unchanged.

S2 — Owner direction, verbatim: "me parece que por debajo hagamos un mecanismo por extension. Esto significa que un dialecto que soporta varias extensiones puede reducir las operaciones o cambiarlas dependiendo de la misma" and "necesito que sea un comportamiento no unicamente de react, porque angular lo va a necesitar para el html". Owner choice: "Router de dialectos (Recommended)".

S3 — `byExtension({ ".tsx": a, ".jsx": b })` returns `{ extensions, find }`. `find(path)` routes to the dialect whose key the basename ends with (longest key wins, so `.component.html` beats `.html`), with a non-empty stem; no match rejects naming every supported extension. Each routed dialect keeps its own AST and ops, so AST types may differ between extensions. A key that is not in its dialect's own `extensions` throws at composition (an object literal cannot hold a duplicated key). For a literal path, `find`'s return type is that extension's handle. (Defaults — owner may override.)

S4 — `withoutOps(dialect, names, reason)` keeps every op name on the handle but makes the named ones reject at call time with a standard message naming the op, the dialect's extensions and `reason`, leaving the file unchanged. `overrideOps(dialect, overrides)` replaces named ops with same-signature implementations. Both throw at composition on an unknown op name, and leave the AST and extensions as they are. (Defaults — owner may override.)

S5 — React: `.jsx` parses as JSX (`ScriptKind.JSX`, so `<div>` is never read as a cast); `addTypeImport` and `addComponentProp` are omitted on `.jsx`; `addClassProperty` rejects on `.jsx` only with `scope` or `readonly`. `.tsx` behaviour and every existing React message for other extensions stay as they are.

S6 — Docs: `docs/authoring-a-dialect.md` documents `byExtension`/`withoutOps`/`overrideOps` next to `defineDialect`/`withOps`; the React section, README, changelog, FIT-04 baselines and doc guards are updated.

Out of scope until the owner asks: the Angular `.html` dialect itself.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S2, S3, S4, S6 | inline | done — RED (missing exports) → GREEN 11 pass; tsc proves literal-path typing | see git log |
| T2 | S1, S5, S6 | inline | pending (RED written: `test/dialects/react/jsx-files.test.ts`, 9 fail) | — |

Route evidence: T2 depends on T1; each unit forecast under ~400 lines; no writer trigger fires. Risk: item 3 — new exports on the dialect kit that third-party dialects consume (additive).

## Log

L1 (2026-10-29, user, verbatim): "hagamos un soporte a .jsx primero"
L2 (2026-10-29, user): `.jsx` API choice "Mismo find, rechazo en runtime (Recommended)" (S1).
L3 (2026-10-29, user, verbatim): S2's two messages, sent while T2's RED tests were being written.
L4 (2026-10-29, user): mechanism choice "Router de dialectos (Recommended)" (S2).
L5 (2026-10-29): `DialectDescriptor` is frozen at three fields (REQ-DG-01.1), so the mechanism is new composition functions, not a descriptor field. A separate `withAst` helper was dropped: `defineDialect({ extensions, ast, ops: other.ops })` already expresses it.
