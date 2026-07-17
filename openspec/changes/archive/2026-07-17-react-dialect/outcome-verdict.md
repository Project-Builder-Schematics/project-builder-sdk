# Outcome Verdict — React (TSX/JSX) Dialect (react-dialect)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `aligned` — no outcome-gap found by the steward's analysis; `delivered` is contingent on the owner affirming the three conscience questions below (the gate does not pass until then).
**Triage**: L (sensitivity-forced: security code-execution HIGH) · **Held against**: the ORIGINAL `problem_statement` (triage.md), not the spec.
**Result under reckoning**: branch `feat/react-dialect`, spec V8 + local-consumption V2, verify-final iteration 4 `pass-with-followups`, judgment-day APPROVED (round 3).

---

## 1. Our objective was THIS (quoted)

> Schematic authors who need to mutate TSX/JSX files have no dialect that supports that syntax —
> the shipped TypeScript dialect covers plain `.ts` mutation only. A React (TSX/JSX) dialect closes
> that gap. Why now: dialect infrastructure (defineDialect/defineOpPack/withOps, coalescing handle,
> conformance kit) shipped and is proven by the first dialect; this is the second consumer of that
> contract.

North-star promise (foresight, verbatim intent): ship `@pbuilder/sdk/react` — byte-exact `.tsx`
parse/print, a `.tsx`-only `find()` gate, two v1 ops (`setJsxProp`, `addImport`), `.modify(fn)` for
everything else, a load-bearing name validator drawing the injection boundary.

---

## 2. Did we deliver it? Show me WHERE (result → problem map)

| Stated pain / scope element | Shipped remedy | Where | Mapped? |
|---|---|---|---|
| **P1 — `.tsx` files cannot be opened/mutated** (`ts.find("Component.tsx")` hard-throws) | `react.find("*.tsx")` parses via `ScriptKind.Tsx`, byte-exact print (BOM/CRLF preserved); previously-throwing input now parses | `src/dialects/react/index.ts:63-91`, `ast.ts`; REQ-RXD-03; 20-sample conformance corpus | ✅ (narrowed to `.tsx` — see drift/CQ-2) |
| **P2 — no dialect surface for JSX mutation** | Two structured ops + universal `.modify(fn)` escape hatch for anything else; the file is now FULLY mutatable | `src/dialects/react/ops.ts` (`setJsxProp`, `addImport`); `.modify()` documented as the interim escape hatch | ✅ |
| **P3 (why-now) — prove the dialect contract carries to a 2nd consumer** | New leaf mirrors the `typescript` leaf; ZERO core change (ADR-01 zero-diff on `src/dialects/typescript/**`, confirmed empty in verify §3); conformance kit proves parse/print + op fidelity; 6-subpath installed-consumer parity | `index.ts` composes only `defineDialect`/`defineOpPack`/`withOps`; REQ-LC-01..03; `./react` in `package.json#exports` | ✅ |
| In-scope: **docs for the new dialect surface** | `@pbuilder/sdk/react` section (worked coalesced example, 2-op minimality, `.modify()` hatch, value-trust warning, spread-precedence, collision-reject limitation); README + quickstart Next-steps discover it | `docs/authoring-a-dialect.md:106-205`, `README.md:12`, `docs/quickstart.md:186` | ✅ |
| In-scope: **exactly two ops (minimal op-pack)** | `Object.keys(dialect.ops)` asserted `toEqual(["addImport","setJsxProp"])` — anti-smuggle | S-002.4 exact-op-set test; `index.ts:22` | ✅ |

**Unmapped remainder**: a `.jsx`-only author (plain-JS JSX, not under a TS project) is NOT relieved
in v1 — `find(".jsx")` throws by design. The problem statement literally names "TSX/JSX"; v1 ships
`.tsx` only. This is the sole element of stated scope left untouched. It is **honestly tracked, not
orphaned**: `openspec/pending-changes.md:442` (owner-requested register, mid-plan), the reject
message itself names the deferral, and it is a ratified spec-V4 owner decision. → **CQ-2**.

---

## 3. The user-journey simulation (the person who was hurting)

Journey: an SDK author needs to wire an imported handler onto a JSX element in a real `.tsx` file.

1. **Discover `./react`** — `README.md:12` names it; `quickstart.md` "Next steps" links the dialect
   doc; `authoring-a-dialect.md` carries a full `@pbuilder/sdk/react` section. → **completes.**
2. **Follow the worked example** — the coalesced `addImport` + `setJsxProp` chain on ONE handle,
   with byte output shown via `// ->` comments (docs line 123-134; the same journey is the shipped
   `find` JSDoc `@example`, `index.ts:49-61`). → **completes.**
3. **Apply to a real `.tsx`** — signatures, the three `value` forms, spread-precedence, and the
   named-only `addImport` limitation are all documented; the shipped ops match. → **completes.**
4. **Hit an error and recover** — every reject is actionable:
   - `.ts` → message names `@pbuilder/sdk/typescript` as the fix.
   - `.jsx` → message states unsupported in v1 + names the op-catalog follow-up.
   - extensionless / dotted-directory → "append `.tsx`".
   - invalid element/prop name → names the grammar rule + the two-remedy pair (fix the name / use
     `.modify()`), with NO echo of the hostile value.
   - zero / multi element match → names the element (and the count) + points at `.modify()`.
   - `addImport` name collision → rejects rather than emitting an invalid duplicate binding; the doc
     "collision-reject limitation" section tells the author to rename or pick a different `name`.
   → **completes** for the primary population.

**Stumble points:**
- **The `.jsx` wall (CQ-2 population).** A `.jsx`-only author following the journey hits a hard stop
  at step 1/4 — `find()` throws BEFORE opening, so there is no in-SDK workaround (not even
  `.modify()`, which needs an open handle). The message is honest, but the journey does NOT complete
  for them in v1. For the primary `.tsx` population it completes end to end.
- **No functional stumble for the `.tsx` journey.** The four `addImport` correctness bugs that a
  blind adversarial gate found on mainstream React inputs (type-only / default / namespace / aliased
  / value-namespace collisions — each would have EMITTED INVALID BINDINGS on ordinary files) are
  fixed under spec V7+V8; `ops.ts` now implements the unified CLAIMED model (`boundNamesIn` superset
  + `isValueNamespaceClaimed` adopting ADR-0039 verbatim). The "usable" property was genuinely at
  risk and is restored — the result AS IT STANDS NOW produces a correct `addImport` on mainstream
  input, not just on the golden.

---

## 4. Outputs-without-outcome scan

- **The security apparatus is NOT ceremony.** A validator subsystem, `reject-tail`, a 20-sample JSX
  corpus, and three new fitness functions for a 2-op dialect looks heavy — but the splice-injection
  vector is spike-proven real (ts-morph writes structured-API name args as raw text), and the blind
  gate found four live correctness defects. The weight is proportional to a code-execution-sensitive
  surface the L-floor mandates. It serves the "usable AND safe" outcome; it is load-bearing.
- **No outcome element lacks an output** — except the deliberately-deferred `.jsx` half of "TSX/JSX"
  (CQ-2). The unblock outcome is fully delivered by parse/print + `.modify()`; the two ops are
  ergonomic capability on top AND the why-now proof that the op-pack contract carries to a second
  dialect.

---

## 5. Did we drift? (promise ↔ delivery)

**No silent drift. The delivery drifted TOWARD the promise's correctness, not away from it.**

- Every north-star promise is delivered verbatim in shape (`./react`, `.tsx`-only gate, the exact
  two ops, `.modify()` hatch, validator + verbatim `value` channel) — confirmed in `index.ts`/`ops.ts`.
- The V4→V8 evolution (extensionless-reject, denylist, reserved words, shape-aware `addImport`,
  ADR-0039 claimed-name model) made the delivered `addImport` MORE correct than the design-time
  promise — an honest response to a blind gate that found real bugs, not scope creep.
- The first final-verify FAIL (a stale `@example` steering authors to the raw `.modify()` hatch
  instead of the structured ops) is fixed and byte-verified: the shipped `find` JSDoc `@example`
  (`index.ts:49-61`) and the doc worked example now show the structured coalesced journey. Confirmed
  by the steward directly.
- The two narrowings (`.tsx`-only vs "TSX/JSX"; heavy apparatus for 2 ops) were surfaced at foresight
  as CQ-2 / a watch-item — flagged for conscious owner affirmation, NOT hidden. Both are documented
  (docs, reject messages, `pending-changes.md:442`, spec changelog). **Honest narrowing, not silent
  drift.**

---

## 6. Conscience questions (human-only — the gate does NOT pass until the owner answers)

These were owner-affirmed at foresight against the DESIGN. They are re-filed here against the
DELIVERED, running result — confirm each holds now that the thing exists.

- **CQ-1 (usable?)** — Is a two-op-plus-`.modify()` React dialect genuinely usable for the blocked
  authors? The `.tsx` file is now fully mutatable (`.modify(fn)` reaches anything), and `addImport` is
  now correct on mainstream React inputs (the four blind-gate defects are fixed). Steward's suspicion:
  usable for the primary population — this is parity with the shipped TS dialect's own escape-hatch
  model. **Owner's call required.**
- **CQ-2 (scope vs problem wording)** — The original problem names "TSX/JSX"; v1 relieves `.tsx`-only
  and hard-rejects `.jsx` with no in-SDK workaround for that population. The deferral is tracked
  (`pending-changes.md:442`, owner-requested). Does the owner affirm the PRIMARY hurting population is
  TypeScript-project (`.tsx`) authors, and accept that `.jsx`-only authors stay blocked in v1?
- **CQ-3 (significant / why-now)** — Explore filed a why-now product question (go first here vs the
  open security-hardening debt item 22 and the paused `ts-dialect-backend-ops` catalog). Signed spec +
  ratified proposal imply this was weighed — confirm it was a conscious priority call, not inertia.

---

## 7. Steward's bottom line

The AI-answerable reckoning is clean: the shipped surface maps to the stated pain, the primary-population
journey completes end to end, there are no outputs-without-outcome, and the promise↔delivery drift is
honest narrowing (with the correctness drift running toward the promise). **This is outcome, not code
that merely passes tests.** The steward finds **no `outcome-gap`**. The verdict advances to `delivered`
only when the owner affirms CQ-1/CQ-2/CQ-3 — the conscience does not stamp meaning on the owner's behalf.
