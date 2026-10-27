# json-yaml-dialects

Objective: ship `@pbuilder/sdk/json` and `@pbuilder/sdk/yaml` dialects covering every structural mutation of a JSON or YAML document, then open a docs issue.
Branch: `feat/json-yaml-dialects` (worktree `project-builder-sdk-worktrees/json-yaml-dialects`). Delivery: ask-on-risk. Runner: `bun test`, `bun run typecheck`.

## Specs

- S1: JSON dialect per `openspec/specs/json-dialect/spec.md` (REQ-JSD-01..08), AST library `jsonc-parser@3.3.1`.
- S2: YAML dialect per `openspec/specs/yaml-dialect/spec.md` (REQ-YMD-01..08), AST library `yaml@2.9.1`.
- S3: Both dependencies exact-pinned; package surface (exports `./json`, `./yaml`, dependencies) and fitness baselines updated.
- S4: Docs in the SDK repo for both dialects; tests through the public interface; typecheck and tests run.
- S5: Conventional Commits, no AI attribution. Push and SDK PR only after asking the user.
- S7: Add `moveValue`, `copyValue`, `sortKeys`, `before`/`after` key position (both dialects) and `setTag` (YAML) — REQ-JSD-09, REQ-YMD-09.
- S6: Open an issue at Project-Builder-Schematics/project-builder-docs listing both dialects and their mutations ("al final crea un issue en el repo de docs para actualizar la documentacion con este nuevo lenguage").

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S2 | inline | done (specs written) | |
| T2 | S3 | inline | in progress | |
| T3 | S1, S4 | delegated (parallel unit, disjoint surface) | pending | |
| T4 | S2, S4 | delegated (parallel unit, disjoint surface) | pending | |
| T5 | S3-S4 | inline seam check + verifier (Risk item 5: new dependencies) | pending | |
| T6 | S6 | inline | pending | |
| T7 | S7 (JSON) | folded into T3 (sent to the running JSON writer) | pending | |
| T8 | S7 (YAML) | folded into T4 (sent to the running YAML writer) | pending | |

## Log

- L1 (2026-10-27, via peer session): "Necesito que en otra sesion se cree dos dialectos. JSON and YAML. Necesito que se haga una lista de todas las posibles mutaciones a un json o yaml y que lo pongamos en dos diferentes dialectos. Cuando termine necesito que haga un issue a https://github.com/Project-Builder-Schematics/project-builder-docs para actualizar la documentacion".
- L2: user chose `yaml + jsonc-parser` as new runtime dependencies (fit-14 previously allowed only ts-morph).
- L3: user confirmed `jsonc-parser` for JSON (text edits over a read-only tree; minimal diffs, JSONC comments kept). "Si dale, al final crea un issue en el repo de docs para actualizar la documentacion con este nuevo lenguage".
- L4: `rename`/`move`/`remove`/`copy` are reserved handle verbs, so key/item ops use `Key`/`Item` suffixes.
- L5: user approved coverage gap closure (RFC 6902 move/copy, key position, sortKeys, YAML setTag): "Si dale".
