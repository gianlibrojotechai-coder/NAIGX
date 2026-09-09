# AC-037 — depth proportional to complexity, measured 2026-09-10

`docs/08` Appendix C item 9 (D-34): `AC-037` is tested as **artifact-set size against complexity score** (`DB §4.4`), and was "unmeasurable until complexity scoring exists". Complexity scoring exists since D-80; this is the measurement, taken offline from the fifteen recordings in force (no provider, no spend) by parsing each recording's Stage 9 complexity answer and reading the planned artifact set from `PATH_ARTIFACT_TYPES`.

| Case | Path | Complexity score | Band | Planned artifact set (incl. brief) |
|---|---|---|---|---|
| br-001 | business_requirement | 73 | high | 11 |
| br-002 | business_requirement | 60 | high | 11 |
| br-003 | business_requirement | 39 | low | 11 |
| br-004 | business_requirement | 35 | low | 11 |
| br-005 | business_requirement | — | — | 1 (halted before Stage 9) |
| br-007 | business_requirement | 48 | moderate | 11 |
| br-009 | business_requirement | 77 | high | 11 |
| br-010 | business_requirement | 41 | moderate | 11 |
| br-011 | business_requirement | 84 | severe | 11 |
| ew-001 | existing_workflow | 67 | high | 5 |
| jd-002 | job_description | — | — | 4 (no complexity on this path) |
| jd-008 | job_description | — | — | 4 (no complexity on this path) |
| ta-005 | technical_assessment | — | — | 3 (no complexity on this path) |
| un-001 | unsupported | — | — | 1 (halted before Stage 9) |
| un-002 | unsupported | — | — | 1 (halted before Stage 9) |

**Result: NOT MET, by construction.** Nine scored cases span complexity 35–84 (low to severe) and every one of them plans the same eleven artifacts; the only variation in set size is by path (11 / 5 / 4 / 3) and by halting (1). That is exactly what D-34 chose: `depth_level` is single-valued (`"standard"`) in v1, so the artifact set is fixed per path and cannot be proportional to anything. The measurement is honest about what it measures — the plan, not the length or depth of the artifacts, which `DB §4.4` does not define a measure for.

**What would meet it.** A second depth level, planned at Stage 5 from the complexity pre-assessment D-35 deferred (or, since D-80, from the score itself — which is produced at Stage 9, after the plan), that omits or shortens artifacts for low-complexity inputs. That is a scope decision (`AIQ-7`, D-34 "revisit when complexity scoring exists") and is now the owner's to take with the evidence above.
