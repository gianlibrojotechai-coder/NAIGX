# Review bundle index

Rubric version `rubric-v1`. 15 packet(s).

Read `README.md` first. Do not open the unblinding index until every verdict
is written.

---

## Packets by input type

Stage names are what was *recorded*, in order. They say what ran, not whether
what ran was right.

| Packet | Input type | Stages recorded | C-7 comparison candidates |
|---|---|---|---|
| `RP-07a977a3` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → risk_assessment → implementation_roadmap → edge_case_analysis → integration_requirements → platform_recommendation | `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-ac291956`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-27f9fb58` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → edge_case_analysis → risk_assessment → integration_requirements → platform_recommendation → implementation_roadmap | `RP-07a977a3`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-ac291956`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-2fa7c3e3` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → implementation_roadmap → edge_case_analysis → risk_assessment → platform_recommendation → integration_requirements | `RP-07a977a3`, `RP-27f9fb58`, `RP-448236a4`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-ac291956`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-448236a4` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → integration_requirements → implementation_roadmap → risk_assessment → platform_recommendation → edge_case_analysis | `RP-07a977a3`, `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-ac291956`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-4bb087ba` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → integration_requirements → risk_assessment → implementation_roadmap → edge_case_analysis → platform_recommendation | `RP-07a977a3`, `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-5c2b0a40`, `RP-ac291956`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-5c2b0a40` | business_requirement | input_classification → intent_detection → context_extraction | `RP-07a977a3`, `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-4bb087ba`, `RP-ac291956`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-ac291956` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → integration_requirements → risk_assessment → platform_recommendation → edge_case_analysis → implementation_roadmap | `RP-07a977a3`, `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-d41a9d08`, `RP-e755dbdf` |
| `RP-d41a9d08` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → complexity_assessment → integration_requirements → implementation_roadmap → risk_assessment → edge_case_analysis → platform_recommendation | `RP-07a977a3`, `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-ac291956`, `RP-e755dbdf` |
| `RP-e755dbdf` | business_requirement | input_classification → intent_detection → context_extraction → architecture_analysis → integration_requirements → complexity_assessment → implementation_roadmap → risk_assessment → edge_case_analysis → platform_recommendation | `RP-07a977a3`, `RP-27f9fb58`, `RP-2fa7c3e3`, `RP-448236a4`, `RP-4bb087ba`, `RP-5c2b0a40`, `RP-ac291956`, `RP-d41a9d08` |
| `RP-acd0ef55` | existing_workflow | input_classification → intent_detection → context_extraction → workflow_review → complexity_assessment → platform_comparison | *none* |
| `RP-194de8f7` | job_description | input_classification → intent_detection → context_extraction → recommendation_generation → portfolio_suggestions → interview_guidance | `RP-29376439` |
| `RP-29376439` | job_description | input_classification → intent_detection → context_extraction → recommendation_generation → interview_guidance | `RP-194de8f7` |
| `RP-d27b05e0` | technical_assessment | input_classification → intent_detection → context_extraction → architecture_analysis | *none* |
| `RP-661bcf50` | unsupported | input_classification | `RP-c51473dc` |
| `RP-c51473dc` | unsupported | input_classification | `RP-661bcf50` |

**business_requirement**: 9 · **existing_workflow**: 1 · **job_description**: 2 · **technical_assessment**: 1 · **unsupported**: 2

⚠️ `docs/10` §4.1 requires ≥20 analyses per input type. No type here reaches
that. This bundle is partial evidence and must be reported as partial.

---

## Which evidence supports which criterion

| Criterion | Assessable here | Evidence available in the packets |
|---|---|---|
| C-1 Grounded | **Yes** | Context extraction carries `provenance` and `source_quote` per element; later stages cite `grounded_in_context_indices` back into that array |
| C-2 Specific | **Partly** | Architecture components and responsibilities, where an architecture stage was recorded. The `AC-013` do-not-automate clause has no material — that is a Stage 7 output |
| C-3 Proportional | **No** | Requires the artifact set and `ARTIFACT_PLAN_ENTRY`. Stages 8–9 did not exist at capture |
| C-4 Complete | **Partly** | Context elements, the sufficiency judgment, and which stages ran. Artifact-level omission has no material |
| C-5 Honest | **Partly** | Unknowns and resolution hints in context extraction. The `FR-045` confidence clause has no material — Stage 11 is deferred (`docs/12` D-33) |
| C-6 Defensible | **No** | Requires `FR-034` stated criteria plus a rejected alternative. That is a Stage 7 output; Stage 7 did not exist at capture |
| C-7 Consistent | **Yes, within type** | Same-input-type peers, named per packet. The repeated-run clause has no material — every capture ran at default sampling, so repeat-run stability was never measured |

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are
not assessable throughout, so **no packet in this bundle can be recorded as a
rubric pass.** That is a property of the evidence, not of the reasoning.

---

## What a complete review would need, and this bundle does not have

| Missing | Consequence | What would supply it |
|---|---|---|
| Stage 7 recommendations | C-6 unassessable; C-2's `AC-013` clause unassessable | A capture against the current pipeline |
| Stage 8–9 artifact plans and artifacts | C-3 unassessable | A capture against the current pipeline |
| Stage 11 confidence bands | C-5's `FR-045` clause unassessable; §4.1 stratification impossible; §7 calibration impossible | Stage 11, deferred by `docs/12` D-33 |
| ≥20 analyses per input type (§4.1) | Sample too small for a v1.0 gate | More corpus capture |
| `existing_workflow` and `technical_assessment` recordings | Two of four input types unrepresented | Capture for those paths |
| Repeat runs of the same input | C-7's `FR-024` clause unassessable | A second capture of the same cases |
| A second independent reviewer (§4.3, ambiguity A-1) | No agreement measurement is possible from one reviewer (§5) | A human other than the analysis author |

---

## If two people review the same packets

`docs/10` §5 becomes available and is worth using: agreement is computed
**per criterion**, `not assessable` verdicts are excluded from both sides of
the ratio, and every disagreement produces a log entry with both verdicts,
both pieces of evidence, and a type (§5.4). Where disagreement persists, §5.5
is explicit that **the failing verdict stands**.

