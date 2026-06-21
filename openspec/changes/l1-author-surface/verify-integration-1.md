## Integration Gate Result

**Program**: l1-author-surface
**After sub-change**: #1 l1-author-surface-skeleton (the program walking skeleton)
**Iteration**: 1
**Mode**: integration

---

### Verdict: PASS

The skeleton threads the program's integration spine. Every seam the skeleton produces/consumes is
exercised by a REAL cross-boundary test (no mock across any declared seam). The two seams owned by #4
are `deferred` (their other side is not yet built) and re-enter the matrix when #4 lands.

### Seams matrix (seam → test → real | mocked | deferred)

| Seam | Skeleton role | Cross-boundary test | Real/Mock/Deferred | Evidence |
|---|---|---|---|---|
| SEAM-01 typed-options | consumes (thin `create<S>`) | `test/types/typed-create.test.ts` (REQ-01.1/01.3) + `test/types/permissive-proof.ts` (REQ-01.2) | **real** (compile-time proof over the real commons surface; FIT-01 commons-no-AST green) | thin overload only; full `OptionsOf<S>` derivation is #2 |
| SEAM-02 directive buffer | produces snapshot + thin consumer | `test/dry-run/plan.test.ts` (REQ-04.3 plan == buffered directives from a REAL `Session`) + `test/dry-run/no-import.test.ts` (REQ-05.1) | **real** (real `Session.pendingSnapshot()`; renderer AST/core-blind, import-graph scanned) | minimal renderer; full renderer is #4 |
| SEAM-03 commit/discard | consumes (thin commit/discard) | `test/skeleton/commit-discard.test.ts` (REQ-06.1 success commits full batch; REQ-07.1/07.3 throw → committed empty + staging discarded) | **real** (`ContractFake` unmocked both sides; asserts observed committed/staging state) | all-or-nothing seed; full contract is #3 |
| SEAM-04 error-attribution | consumes (thin wrap, emit site) | `test/skeleton/error-attribution.test.ts` (REQ-13.1 unmocked both sides → `AuthoringError{verb,path}`, no engine text, committed empty) | **real** (REQ-13 forbids any mock on emit/attribution/commit; verified by final-verify) | first-instruction attribution; mid-chain `appliedBoundary` + read-site wrap are #3 |
| SEAM-05 frame-cap | not touched (owned by #4) | — | **deferred** | re-enters matrix when #4 (release-shape) lands |
| SEAM-06 tarball shape | not touched (owned by #4) | — | **deferred** | re-enters matrix when #4 (release-shape) lands |

### Program-wide affected suite
Union of files touched by all completed sub-changes = the skeleton only. Full suite: **170 pass / 0 fail**
(`bun test`), `tsc --noEmit` exit 0, permissive-proof exit 2 (REQ-01.2 negative). Confirmed this session by
the orchestrator AND independently re-run by the final-verify evaluator.

### E2E happy paths
Not applicable — project has 0 REST/GraphQL/WS/gRPC and no E2E harness (architecture baseline). Cross-boundary
seam tests (fake unmocked both sides) are the integration-level proof in lieu of E2E.

### Findings
None. No mock accepted across any declared seam. 4/4 produced/consumed seams real; 2 deferred (not failures).

### Routing
PASS → the skeleton sub-change is integration-clean. build_mode = next-only → STOP after this gate; ask the
user before starting sub-change #2 (typed-options-and-read). No integration debt carried forward.
