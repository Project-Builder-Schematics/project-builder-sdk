## Test pyramid

The suite mirrors an explicit four-layer pyramid — `test/pyramid/pyramid-codification.test.ts`
enforces this table structurally, so keep it in sync with the directories it names.

| Layer | Directory | Runs without engine? | Example test |
|---|---|---|---|
| unit | `test/golden-ir` | Yes | `test/golden-ir/golden-ir.test.ts` |
| fitness | `test/fitness` | Yes | `test/fitness/fit-08-no-kit-bleed.test.ts` |
| integration | `test/bounded-contexts/authoring/testing` | Yes | `test/bounded-contexts/authoring/testing/move-fail-closed.test.ts` |
| e2e | `test/e2e` | Yes | `test/e2e/author-to-tree.e2e.test.ts` |

Every layer runs against `ContractFake` (`test/support/contract-fake.ts`) — a real engine is
never required to exercise any of them.

The table lists each layer's canonical home; two additional directories belong to the
integration layer without being its canonical home: `test/skeleton` (cross-module and handle
behavior through `defineFactory`) and `test/types` (compile-time contract pins). CI's bare
`bun test` runs every directory regardless.

### Where does my change belong?

| Contribution type | Layer(s) | Home |
|---|---|---|
| New verb / wire op | unit + integration | `test/golden-ir` (directive shape) + `test/bounded-contexts/authoring/testing` (fake seam behavior) |
| New fitness invariant | fitness | `test/fitness` |
| Cross-module / handle behavior | integration | `test/bounded-contexts/authoring/testing` or `test/skeleton` |
| Full author-facing story | e2e | `test/e2e` |
