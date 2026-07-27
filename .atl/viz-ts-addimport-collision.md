# ts-addimport-collision — SDD Plan Map

**URL**: https://claude.ai/code/artifact/e11cd6b2-ae1a-46a8-a8b4-e03a2f7e3608

**Updated**: 2026-07-21 (/build COMPLETE: S-000 ✅ S-001 ✅ S-002 ✅ S-003 ✅ S-004 ✅ S-005 ✅ SEALED; suite 2134 pass/0 fail across 192 files; 7 in-loop iterations; next: /evaluate simplify gate)

**Favicon**: 🗺️

**Sections rendered**:
- 00 Status bar (pipeline chips: triage ✅ → explore ✅ → propose ✅ → spec ✅ → design ✅ → plan-verify ✅ → steward ✅ → slice ✅ → apply ✅ → simplify 🚧 → verify ⚪ → judgment ⚪ → archive ⚪)
- 01 Problem & scope (who hurts, what pain, why now + in/out scope cards with proper contrast)
- 02 Requirements (REQ-TSD-01, REQ-TSD-03, REQ-TSD-13; 50 scenarios total; spec status V3.2 signed with amendment to .25 asymmetry)
- 03 Architecture (MODIFYING impact, ADR-01/02/03 decisions, port matrix, file changes summary)
- 04 Flows (Flow 1: author calls addImport; Flow 2: conformance round-trip)
- 04b Flows (author call → validation gate → Steps 1-4 algorithm → AST emit; sequence diagram)
- 05 Slices (6 slices unchanged: S-000–S-005; slices.md amended +4 additive sections: executor context, pre-satisfied scenarios, repo conventions, owner-settled decisions)
- 06 Progress board (All 6 slices SEALED: S-000 verify-in-loop-2 PASS, S-001 verify-in-loop-3 PASS, S-002 verify-in-loop-5 PASS, S-003 verify-in-loop-4 PASS, S-004 verify-in-loop-6 PASS, S-005 verify-in-loop-7 PASS; risks: W1 FIT-41 cross-module bucket textual gap, W2 apply-progress S-005 tables omitted; next: /evaluate)
- Footer (metadata: change, triage class, spec version, next phase)
