# NAIGX — Sprint 1 Decision Record

**Decisions taken at Sprint 1 entry, before implementation.**

| Field | Value |
|---|---|
| Product | NAIGX — Automation Intelligence Platform |
| Document type | Decision Record (canonical) |
| Sources of truth | PRD v1.0 · MVP Scope v1.0 · System Architecture v1.0 · AI Architecture v1.0 · Database Design v1.0 · API Design v1.0 · Engineering Roadmap v1.0 · `corpus-v1` |
| Resolves | `SA AQ-1` · `SA AQ-5` · `DBQ-1` · `DBQ-5` |
| Records | D-6 and D-7 documentation discrepancies · `DBQ-8` deferral rationale |
| Last updated | 2026-09-06 |

---

## How this document is used

The Sprint 1 Entry Assessment found that every Sprint 1 track except the database schema was blocked on an undefined decision. This record resolves those decisions from the authoritative documents, and records two discrepancies **between** authoritative documents without silently resolving either side.

Where a decision is already implied by the specifications, that is stated — several of these are confirmations of a choice the documents had effectively made, not free choices.

> **Nothing here amends a requirement.** `FR-011`, `FR-023`, the frozen `corpus-v1`, and the eight boundary checks are untouched.

---

## D-1 — Schema representation

**Decision: JSON Schema (draft 2020-12) is the authoritative artifact-schema representation.**

### The constraint that decides it

`AI §9.3` states the governing rule: *"The same schema drives generation guidance and validation — they cannot disagree."* Three facts then narrow the options to one:

| Fact | Source | Consequence |
|---|---|---|
| The schema is **injected into the prompt** as the `Output Contract → Schema Specification` fragment | `AI §6.1` | It must be serialisable to text |
| The schema is **stored as data** in `ARTIFACT_SCHEMA.definition`, versioned, append-only, unique on `(artifact_type, version)` | `DB §4.4` | It cannot be application code |
| Schemas are classified **Reference** data alongside fragment versions and providers | `DB §13.2` | It is configuration, not code |

A code-first library (Zod, TypeBox, io-ts) fails the second and third: TypeScript cannot be stored in a `definition` column, versioned as reference data, or injected into a prompt without a conversion step — and any conversion step reintroduces exactly the divergence `AI §9.3` forbids.

### What is decided

| Aspect | Decision |
|---|---|
| Representation | JSON Schema, draft 2020-12 |
| Authoritative location | `ARTIFACT_SCHEMA.definition`, per `DB §4.4` |
| Prompt injection | The same document, rendered into the `Output Contract` fragment (`AI §6.1`) |
| Validation | Deterministic, against the same document (`FR-039`) |
| Provider neutrality | JSON Schema is provider-independent, satisfying `AIP-6` — no adapter-specific phrasing enters the schema |

### Explicitly not decided

The **validator library** is an implementation choice for the schema task, not a specification decision. Any conformant draft-2020-12 validator satisfies this record.

Authoring schemas via a code-first tool that *emits* JSON Schema is permitted, provided the emitted document is what is stored and injected. The stored document is authoritative.

---

## D-2 — Trace store technology

**Decision: PostgreSQL, in a database separate from the primary store, with no foreign key crossing the boundary.**

Resolves `SA AQ-1` and `DBQ-1`.

### The documents had already decided this

| Evidence | Source |
|---|---|
| *"Content-bearing; **needs relational structure** and controlled retention"* | `DB §11.1` |
| *"These are **relational questions** about specific runs, not time-series aggregations"* — cost per analysis by classification, latency by stage and model version, fallback correlated with quality | `DB §11.2` |
| `ProviderInvocation` *"needs joins to stage and model version"*; `ValidationEvent` *"needs artifact-type correlation"* | `DB §11.1` |
| The trace store is specified as an **ER diagram with typed relational columns** and FK relationships | `DB §8.1` |
| *"At a million analyses, primary-store row counts are well within single-instance **PostgreSQL** capability"* | `DB §15` |
| `DBQ-9` seeks partition granularity *"to make trace expiry a partition drop rather than a mass delete"* — a relational partitioning operation | `DB` App. B |

A document store cannot answer `DB §11.2`'s questions without application-side joins. Object storage cannot answer them at all.

### Satisfying the `AQ-1` constraints

| Constraint | How it is met |
|---|---|
| Tiered retention (`§8.3`) | Three separate tables with independent expiry — 7 / 30 / 30 days |
| Operator query without production data access | A separate database with its own credentials. `DB §8.4` makes trace access operator-only and audited; separation *"makes that boundary enforceable rather than a policy claim"* (`DB §1`) |
| No cross-store coupling | Linkage by `analysis_id` value only. *"No foreign key crosses the store boundary"* (`DB §1`) — trace expiry can never affect a stored analysis |

### Deliberately still open

`DBQ-9` (partition granularity) remains a Sprint 5 question. Choosing PostgreSQL makes partitioning available; it does not require the granularity to be chosen now.

---

## D-3 — Fragment storage and versioning

**Decision: fragments are authored as version-controlled repository assets and published into `PROMPT_FRAGMENT_VERSION`; the runtime resolves content from the database.**

Resolves `SA AQ-5` and `DBQ-5`.

### Why a hybrid rather than either pole

Five constraints apply simultaneously, and neither pole satisfies all five:

| Constraint | Source | Repository only | Database only |
|---|---|---|---|
| Versioned assets **external to application code** | `AI-010` | ⚠️ ships inside the deployed bundle | ✅ |
| **Rollback without code deployment** | `AI-014` | ❌ requires a deploy | ✅ |
| **Reviewable as diffs** | `FR-019`, `AI §6.3` | ✅ | ❌ |
| **Regression-gated before activation** | `NFR-043` | ✅ via CI | ✅ via data constraint |
| Composition recorded per run | `AI-013` | — | ✅ |

The hybrid satisfies all five, and it is the reading the data model already anticipates. `DB §4.5` stated outright: *"Fragment content storage location is `AIQ-5`/`SA AQ-5`, open. **This entity holds the version metadata regardless of where content lives.**"*

> **Stale cross-reference corrected.** That note cited `AIQ-5`, but `AIQ-5` is *"Regression against live providers vs. recorded responses"* (Sprint 2). The fragment-storage question is `SA AQ-5` and `DBQ-5` only. The citation in `DB §4.5` has been corrected alongside its resolution — a broken pointer, not a conflict between requirements, so it needed recording rather than escalation.

### The mechanism

| Step | Where | Gate |
|---|---|---|
| Author / edit a fragment | Repository, under `prompts/` | Git diff review (`FR-019`); boundary check 7 arms on the first template |
| Merge | CI | Regression suite must pass (`NFR-043`) |
| Publish | Insert a new `PROMPT_FRAGMENT_VERSION` row with `content` and `content_hash` | Append-only (`DP-4`) |
| Activate | Set `activated_at` | **Requires `regression_pass_reference`** — the gate is a data constraint, not process discipline (`DB §4.5`) |
| Resolve at runtime | Read the active version from the database | Composition recorded in `FRAGMENT_USAGE` (`AI-013`) |
| **Roll back** | Activate a prior version row | **No deploy** (`AI-014`) ✅ |

### What this explains

`content_hash` on `PROMPT_FRAGMENT_VERSION` exists precisely because content is published rather than authored in place: it detects divergence between the reviewed repository source and the published row, which an append-only row alone could not.

`PROMPT_FRAGMENT_VERSION` gains a `content` attribute. This is a **clarification of an entity the specification left deliberately incomplete pending this decision**, not a new entity.

---

## D-4 — Provider routing and configuration boundary

**Decision: routing inputs are provider-neutral data rows; adapters translate only. Cost is recorded in USD; cost/latency tier is an ordinal integer.**

### The boundary

| Layer | Holds | Never holds |
|---|---|---|
| Configuration data (`PROVIDER`, `MODEL_VERSION`) | `provider_key`, `declared_capabilities`, `active`; model keys and version labels | Reasoning logic |
| Abstraction layer | Capability matching, degradation selection, retry policy, usage accounting | Provider names or SDK imports |
| Adapters (`provider/adapters/`) | Everything provider-specific | Anything reaching upward with provider identity (`AI-006`) |

`DB §4.5` already settles the configuration mechanism: *"Providers are rows, not schema (`DP-6`). Adding a provider is a **data operation**."* That satisfies `AI-002` — provider and model are configurable without a code deployment — with no new machinery.

`declared_capabilities` on `PROVIDER` is the data form of the `AI §10.2` declaration model, which `AI §10.6` requires be explicit rather than assumed. Boundary checks 1 and 3 keep provider specifics inside `adapters/` mechanically.

### Cost unit — resolves provider README deferral #3

| Aspect | Decision | Basis |
|---|---|---|
| Field | `ProviderInvocation.estimated_cost`, `numeric` | Already specified in `DB §8.1` |
| Unit | **USD** | No document names a currency; USD is the unit every model provider publishes rates in, so it introduces no provider-specific concept |
| Precision | Numeric with at least 6 decimal places | Per-invocation costs are routinely below 1¢; rounding to cents would record zero |
| Derivation | Token counts × a rate held in configuration | The field is named *estimated*; it is computed, not returned by a provider |
| Client exposure | **Never** — `API §10.3`: "Monetary values: never in client-facing responses" | Operational class (`DB §13.2`) |

### Cost/latency tier — resolves provider README deferral #2

**An ordinal integer, ascending: `1` = lowest cost and latency.**

`AI §10.2` requires routing *"to the closest available tier"* and names no vocabulary. "Closest" is a distance, which requires an ordering and nothing more. An ordinal supplies exactly that.

Named tiers (`economy` / `standard` / `premium`) were rejected: they invent a vocabulary no document uses, they carry commercial connotations that vary by provider, and they make "closest" a lookup table rather than arithmetic.

### Deliberately not decided

**Whether stage-level model routing is exposed as configuration in v1.0 is `AIQ-6` / `AQ-4`, due Sprint 2.** This record does not pre-empt it. Sprint 1 needs one adapter selection path and a second adapter for `AI-005`; it does not need per-stage routing.

`ANALYSIS.model_version_id` records the model per analysis and `ProviderInvocation` records it per call, which satisfies `AI-004` for Sprint 1. **No routing-configuration entity exists in `DB §4.5`** — if Sprint 2 answers `AIQ-6` affirmatively, one will be required. Recorded here so it is not discovered mid-implementation.

---

## D-6 — `mixed` classification: intermediate, not terminal

**Decision: `mixed` is an internal Stage 1 detection state. It is never a terminal `determined_type` in v1.0. The terminal contract is the five `FR-011` values.**

Neither `FR-011` nor `corpus-v1` is modified.

### The evidence

| # | Evidence | Source |
|---|---|---|
| 1 | Every other type's **"Downstream effect"** names a concrete path. `mixed` says only *"Handled per §4.3"* — it has **no path of its own** | `AI §4.1` |
| 2 | `§4.3` resolves it: *"**Dominant type determines the primary frame**; the secondary is disclosed."* The frame is therefore always one of the four analysable types | `AI §4.3` |
| 3 | *"**v1.0 does not run parallel paths** — proportional depth on two frames from one input exceeds MVP scope"* | `AI §4.3` |
| 4 | First-class mixed output is listed as a **future non-breaking change**: *"Analysis gains an optional `secondary_classification` field"* | `API §4.2` |
| 5 | *"**Exactly one** classification is returned per input"*, over five values | `FR-011` |
| 6 | `MVP §5.1` funds **four** input paths (`FR-020`–`FR-023`) plus decline. There is no mixed path to fund | `MVP §5.1` |
| 7 | `corpus-v1` is **frozen** with zero `mixed` cases across 44 | `docs/11`, `corpus-v1` |

Evidence 1 is the decisive one: a classification with no downstream effect cannot be terminal, because the whole purpose of `AI §4.2` classification is to select a downstream frame.

### How the secondary type is disclosed in v1.0

`CLASSIFICATION.candidate_types` — an ordered set that already exists on the entity (`DB §4.2`). A mixed input records the dominant type as `determined_type` and the secondary in `candidate_types`. No schema change, and `secondary_classification` remains available to v2 as `API §4.2` intends.

### Recorded discrepancy, not resolved unilaterally

`DB §4.2` constrains `determined_type` to *"the closed enumeration (`AI §4.1`)"*, and that enumeration lists six values including `mixed`. Under this decision the persisted enumeration is the `FR-011` five.

**This is a documentation inconsistency requiring reconciliation.** It is recorded as `AIQ-9` rather than fixed here, because resolving it means editing either `AI §4.1` or `FR-011`, and the Entry Assessment's instruction — and the `A-14` precedent from Sprint 0 — is that a conflict between authoritative documents is escalated, not settled in passing.

**Implementation interpretation, effective now:** Stage 1 may detect `mixed` internally; it must resolve to a dominant `FR-011` type before the stage completes. Persistence and API responses use the five.

---

## D-7 — Six-stage versus twelve-stage discrepancy

**Recorded, not resolved. Implementation interpretation: twelve stages.**

| Document | Claim |
|---|---|
| `AI §3.3` | *"Five of **twelve** stages require no model"* |
| `AI §14` | *"**Twelve-stage** pipeline, five stages fully deterministic"* |
| `AI` AID-02 | *"Five of **twelve** stages fully deterministic"* |
| `AI` App. A | A **numbered inventory of twelve stages**, stage 6 = Architecture Analysis (`FR-030`) |
| `Roadmap M-05` | *"All **twelve** stages execute in sequence"* |
| `MVP §5.1` | *"**Six** stages execute in order"* |
| `MVP TM-3` | *"All **six** stages execute in sequence"* |

**`MVP Scope` is the outlier**, contradicted by four statements in `AI Architecture` and one in the `Roadmap`. The twelve-stage numbering is also the one Sprint 1 is written against: the Roadmap's *"Stage 6: architecture analysis"* matches the numbered inventory exactly, and would be meaningless under a six-stage model.

**Implementation proceeds on twelve stages.** `MVP §5.1` and `TM-3` require correction, recorded as `AIQ-10`. No source document is rewritten in this task.

This does not block Sprint 1, which implements stages 1–3 and 6 under either numbering.

---

## D-5 — Application-level encryption scope: remains deferred

`DBQ-8` asks *"which fields beyond the three named"* require application-level encryption.

**It remains deferred, and this is why:** `DB §13.2` already assigns every field a class, and only **Confidential business** requires app-level encryption — `raw_content`, trace inputs/outputs, and artifact content. Those are the three named. Every field in Sprint 1's four domains is already classified, so **no additional field requires a decision to build the Sprint 1 schema.**

Of the three, two are in Sprint 1 scope (`raw_content`, trace inputs/outputs); artifact content belongs to the Artifact domain, which Sprint 1 excludes.

### The concrete decision actually required, and when

Not *which fields*, but *when the mechanism is implemented*. `DB §4.2` already positions the schema for it: `ANALYSIS_INPUT` is separated 1:1 from `ANALYSIS` precisely because `raw_content` *"is the most sensitive field in the schema… separation keeps the hot path narrow and makes encryption and access control targetable."*

Sprint 1 may therefore build the schema with the classification honoured and the encryption mechanism unimplemented, without foreclosing anything. `DBQ-8`'s real deadline is before production data exists, not before the schema exists.

---

## D-8 — Extended-retention trace entities have no timestamp to expire on

**Recorded as a specification defect. Implementation added `recorded_at` to `PROVIDER_INVOCATION` and `VALIDATION_EVENT`.**

Discovered while implementing the Trace Store (2026-08-13).

### The defect

`DB §8.3` assigns three retention tiers, and `§4.7` gives only one entity the means to honour one:

| Entity | Retention (`§8.3`) | Timestamp in its `§4.7` attribute list | Expiry index specified |
|---|---|---|---|
| `STAGE_TRACE` | 7 days | `started_at` ✅ | "index on `started_at` for expiry" ✅ |
| `PROVIDER_INVOCATION` | 30 days | **none** ❌ | none |
| `VALIDATION_EVENT` | 30 days | **none** ❌ | none |

The two 30-day entities cannot borrow their parent's timestamp, because the parent is deleted 23 days earlier — that is the entire point of the tiering. **As specified, the 30-day tiers are unimplementable.** Neither `§8.1`'s ER diagram nor `§4.7` supplies a timestamp.

### What was implemented

`recorded_at` (`timestamp`, default `now()`, indexed) on both entities. One field each, no other addition.

This is the minimum that makes a documented requirement satisfiable. It is not a new capability: `§4.7` already specifies "expired on schedule" for the store and an expiry index for `StageTrace`, so the intent to expire these rows on their own clock is explicit — only the mechanism is missing. Classified Operational (`§13.2`), consistent with the rest of `ProviderInvocation`.

### Minimum authoritative amendment to ratify

**`DB §4.7` — add one attribute to each of two entities.** No other section changes.

| Entity | Amendment |
|---|---|
| `PROVIDER_INVOCATION` | Add `recorded_at` to **Attributes**; add "index on `recorded_at` for expiry" to **Indexes** |
| `VALIDATION_EVENT` | Add `recorded_at` to **Attributes**; add "index on `recorded_at` for expiry" to **Indexes** |

`§8.3` needs no change — its retention values are already correct and are what expose the gap. `§8.1`'s diagram is abbreviated relative to `§4.7` (it already omits `stage_trace_id`, `error_class`, `attempt_number`, `artifact_type`, and `failure_detail`), so it needs no amendment either.

---

## D-9 — `stage_trace_id` cannot be a database foreign key

**Recorded as an internal contradiction. Implementation uses an indexed identifier reference with no constraint.**

Discovered while implementing the Trace Store (2026-08-13).

### The contradiction

`§4.7` annotates `stage_trace_id` as `(FK)` on both `PROVIDER_INVOCATION` and `VALIDATION_EVENT`. The annotation appears deliberate: the same section marks `STAGE_TRACE.analysis_id` as "identifier reference, **no FK**", so the author distinguishes the two cases explicitly.

But `§8.3` requires the referenced parent to be deleted 23 days before its children, and **every available referential action breaks something**:

| Action | What it violates |
|---|---|
| `CASCADE` | `§8.3` — destroys both 30-day tiers at day 7, which is precisely the design "a monolithic trace record" was rejected to avoid |
| `RESTRICT` / `NO ACTION` | `§8.3` — blocks the 7-day purge of user business content, the most sensitive retention promise in the store (`NFR-034`) |
| `SET NULL` | `§4.7` — mutates a row both entities declare **Immutable**; also silently destroys the linkage it exists to provide |

There is no fourth option. The `(FK)` annotation and the tiered-retention model cannot both hold.

### What was implemented

`stage_trace_id` as `uuid`, indexed, **with no foreign-key constraint** — the same treatment `§4.7` already gives `analysis_id`.

Three explicit requirements (`§8.3` tiering, `§4.7` immutability, `§1.4` "linkage is by identifier only") outweigh one annotation. The store now contains **zero foreign keys**, verified against the live database.

> **Consequence, stated plainly:** between day 7 and day 30 a `ProviderInvocation` row carries a `stage_trace_id` that no longer resolves. This is intentional and matches how `analysis_id` and `model_version_id` already behave across the store boundary. Cost, latency, and validation-outcome analysis over the 30-day window remain fully available; per-stage grouping does not survive past day 7, because the stage record itself does not.

### Minimum authoritative amendment to ratify

**`DB §4.7` — change two annotations.** No behavioural requirement changes.

| Entity | Amendment |
|---|---|
| `PROVIDER_INVOCATION` | `stage_trace_id` (FK) → `stage_trace_id` (identifier reference, no FK) |
| `VALIDATION_EVENT` | `stage_trace_id` (FK) → `stage_trace_id` (identifier reference, no FK) |

Optionally, extend `§1.4`'s "**Linkage is by identifier only**" note to state that it holds *within* the trace store as well as across the store boundary — which is what the tiered lifetimes already require.

**Not amended, and deliberately so:** `§8.3` retention values, `§4.7` immutability, and the `Relationships` rows ("N:1 StageTrace"). The N:1 relationship is real and still expressed by the column and its index; only its enforcement mechanism changes.

---

## D-10 — Values the provider abstraction layer needs and no document defines

**Recorded, with provisional values marked as unratified in code.**

Discovered while implementing `AI §10.1` retry, normalization, and cost accounting (2026-08-13).

`AI §10.4`, `NFR-013`, `FR-093` and `SA §11.3` all require the retry to be *bounded*, *exponential* and *jittered*. **None of them says by how much.** Five values were needed to make the layer runnable; each is provisional and none may be cited as a requirement.

| # | Undefined | Where the documents stop | Provisional choice | Why this one |
|---|---|---|---|---|
| 1 | Transient max attempt count | "bounded attempt count" (`SA §11.3`) with no number | **3** | Recorded in `PROVISIONAL_TRANSIENT_RETRY_POLICY`, overridable per call |
| 2 | Base delay and delay ceiling | "bounded exponential backoff" with no interval | **200 ms / 5 000 ms** | Same policy object; the ceiling is what makes `NFR-013`'s "bounded" real |
| 3 | Jitter distribution | "jittered" (`SA §11.3`) and "with jitter" (`AI §10.4`) | **Full jitter** — uniform over `[0, capped)` | The variant that actually decorrelates a retry storm; equal jitter leaves half the delay synchronized |
| 4 | Class of an *unclassified* adapter throwable | `AI §10.4` classifies four failures; none covers an adapter that throws something unclassified | **`persistent`** | `§10.4` authorizes retry only for transient and malformed-response. Calling an unknown fault retryable would invent permission to spend provider budget on a bug |
| 5 | Where per-model token rates are configured | D-4 fixes USD and "a rate held in configuration"; `DB §4.5` gives `PROVIDER` and `MODEL_VERSION` **no rate column**, and no document names a config surface | **Explicit input** (`TokenRateTable`), read from nowhere | Adding a rate column or an env var would invent a configuration surface. An unpriced model raises rather than costing zero |

Also confirmed provisional, carried forward from the schema work: `ProviderInvocation.outcome` has no defined vocabulary (`DB §4.7`). Fixed to `success` | `failure`, with detail carried by `error_class`.

### What the specification *does* fix, and is implemented exactly

| Rule | Source |
|---|---|
| Malformed response → treated as transient, **exactly one retry**, then stage failure | `AI §10.4` — a stated count, so it is a constant, not a policy knob |
| Persistent → no retry against the same provider; failover is routing | `AI §10.4`, `§10.3` — deferred to Sprint 2 by D-4 |
| Capability mismatch → degrade per `§10.2`, recording the fallback | `AI §10.4` |
| One uniform failure taxonomy; no provider detail upward | `SA §3.5`, `AI-006`, `FR-093` |
| Trace-write failure never fails the call | `DB §6.2`, `SA §3.10` |

### Minimum authoritative amendment to ratify

**A new subsection under `SA §11.3`** — or a table appended to it — giving numbers 1-3, since `§11.3` is already where retry policy lives. Items 4 and 5 belong in `AI §10.4` (one row for an unclassified failure) and `DB §4.5` or a configuration document (where rates live).

Nothing needs amending for the layer to be *correct* — only for these five values to stop being this repository's invention.

### Deliberately not changed

`ProviderCapabilities.costLatencyTier` is still typed `string`, though D-4 fixed the tier as an ordinal integer. Its only consumer is `AI §10.3` routing, which is Sprint 2 (`AIQ-6`). Changing a public type with no consumer, inside a task scoped to retry, normalization and cost, would be scope creep — but **it is the first thing Sprint 2 routing must correct**, and it is recorded here so it is not forgotten.

---

## D-11 — What counts as a "second provider" for `AI-005`

**Decision: an offline second implementation satisfies `AI-005`. Recorded rather than assumed, because the requirement does not say.**

Taken while implementing the second adapter (2026-08-13).

### The question

`AI-005` requires "an automated test that exercises a second provider" and never defines *provider*. A commercial API adapter is one reading; a second implementation of the port is another.

### What decides it

`AI §10.5` calls the test **"continuously-passing"**, and `SA AR-43` names the risk as an abstraction that *"is never exercised"*. A test requiring a credential or a network is a test that does not run on every build — which is precisely the failure mode `AR-43` describes. `MVP TV-2` reinforces the intent: *"Provider independence is real, not asserted."* What must be real is the **substitution**, not the vendor.

So the second adapter is a **replay provider** that serves recorded responses. It is not a relabelled stub:

| | stub | replay |
|---|---|---|
| `structuredOutput` | false | **true** |
| `extendedContext` | false | **true** |
| Output | synthetic digest | the recorded response |
| Failures | none | **classified inside the adapter**, fixture-driven |
| Degrades on | output contract (`§10.2` row 1) | **low-variance sampling** (`§10.2` row 3) |

The two adapters exercise *different* `AI §10.2` degradation rows, so the abstraction's degradation handling is tested rather than merely present. The replay mechanism is also what `AIQ-5` will need in Sprint 2 to run regression against recorded responses instead of live ones — this is a component the roadmap already required, arriving early.

### `AI §10.5` steps, honestly accounted

| Step | Status |
|---|---|
| 1 — Implement the adapter interface | ✅ |
| 2 — Declare capabilities | ✅ Declared honestly per `§10.6`; `lowVarianceSampling` reflects how the recording was captured |
| 3 — Register **and configure routing** | ⚠️ **Registration only.** Routing is `AI §10.3`, deferred to Sprint 2 by D-4 (`AIQ-6`) |
| 4 — Run the **full regression suite** against it | ❌ **Cannot be satisfied yet** — the regression runner is a Sprint 2 deliverable (`Roadmap` Sprint 2, `NFR-043`). The conformance suite is not a substitute and is not presented as one |
| 5 — Verify no provider identifier in output (`AI-006`) | ✅ Asserted per adapter |

**Step 4 is an open obligation**, not a satisfied one. `AI-005` itself is met — provider substitution is verified by an automated test — but `§10.5`'s procedure is only fully discharged once the Sprint 2 regression suite runs against both adapters.

### Two smaller judgements

**A registry-constructed replay provider has no fixtures**, so `createProvider("replay")` answers every request with a `persistent` failure. That is the honest behaviour of a replay provider handed no recording; pre-loading fixtures in the registry would make production code own test data.

**Rates remain an explicit input** (D-10 item 5 is unchanged). The conformance test supplies them at the call site. Adding a rate column or environment variable for the second adapter would have invented the configuration surface D-10 records as undefined.

### Boundary check 8 now enforces

It was fail-safe: at two adapters it failed demanding to be wired. It now verifies that the conformance test exists, drives adapters through `createProviderInvoker` rather than calling them directly, and **names every adapter present** — so a third adapter cannot be added without being covered. The checker runs before `npm ci` in CI and so cannot execute the suite; execution is the backend test gate's job, and the check says so rather than implying otherwise.

---

## D-12 — The capability interface has no field for the composed prompt

**Recorded. `CapabilityRequest.instructions` added as an optional field.**

Discovered while implementing Stages 1-3 (2026-08-13).

### The gap

Two requirements meet and leave a hole between them:

| Requirement | Source |
|---|---|
| Prompts are composed **in the NIE** from versioned fragments; no monolithic template exists | `AI §6.1`, `AI-012`, `AIP-5` |
| "Prompt phrasing tuned to one provider" is **prohibited** — so composition cannot live in an adapter | `AI §10.6` |
| The capability request carries exactly four dimensions: reasoning task, input, output contract, determinism preference | `AI §10.2` |

None of the four can carry a composed fragment set. `input` is "the content to reason over" — the user's text; putting instructions there would conflate the user's words with the system's framing, which is precisely what `AIP-3` provenance discipline depends on keeping apart.

### What was implemented

`CapabilityRequest.instructions?: string`, carrying the fragment-composed text. Optional, so a caller with no composition remains valid and the Sprint 0 tests are unaffected. Both adapters include it in their request key, so a fragment change produces a distinct recorded interaction rather than a stale replay hit.

### Minimum authoritative amendment to ratify

**`AI §10.2`** — add a fifth request dimension to the capability interface: the composed instruction set. One row.

This is the "strictly necessary integration change" the task allowed; nothing else in the provider layer moved.

---

## D-13 — Context sufficiency has no numeric threshold

**Recorded. Reported by the model, validated against the enumeration, never computed.**

`AI §3.2` describes the Stage 3 insufficiency signal as firing "if **too few** elements are `stated`". `AI §5.4` gives the three levels qualitatively — *sufficient* ("enough stated context to derive a defensible design"), *thin* ("analysis possible but inference-heavy"), *insufficient* ("any design would be substantially invented"). **No document gives a proportion, a count, or a formula.**

Computing one here would invent a rule with real consequences: `insufficient` halts the analysis before reasoning (`AI §5.4`), so a wrong threshold either refuses work it could do or proceeds on evidence it should not.

**Implemented:** the stage requires `sufficiency` in its structured output and validates it against the `§5.4` enumeration. The value is a reported judgement, not a derived one. The *consequence* of `insufficient` is implemented exactly as specified — the pipeline halts and the `unknown` elements carry their resolution hints, so the system states what is missing.

> **Persistence added by D-22** (2026-08-14). This entry settled where the value *comes from*; it did not put it anywhere. `ANALYSIS.sufficiency_level` was never written until D-22.

**Contrast with the classification threshold**, which *is* specified: `FR-011` fixes 0.6 and `FR-015` fixes the behaviour, so that one is a constant in code and asserted against `corpus-v1`'s four `below_threshold` cases.

### Minimum amendment to ratify

**`AI §5.4`** — add the rule that separates the three levels, or state explicitly that the level is a model judgement rather than a computed one. Either resolves it; the current text supports neither reading over the other.

---

## D-14 — The fragment gate exists before the regression suite does

**Decided. A manifest-based change gate satisfies `NFR-043` for Sprint 1; corpus output regression remains Sprint 2.**

Taken while publishing the first prompt fragments (2026-08-13).

### The circularity

Two requirements lock together, and one of them cannot be met yet:

| Requirement | Source | Status |
|---|---|---|
| A regression suite of fixed inputs exists and runs before any template change ships | `NFR-043` | The **golden-corpus suite is a Sprint 2 deliverable** (`Roadmap` Sprint 2) |
| Boundary check 7 fails the build the moment a template exists without its gate | `SA` App. A, `AD-14` | Arms on the first file under `prompts/` |
| `activated_at` requires a `regression_pass_reference` — a database CHECK, not a convention | `DB §4.5` | Enforcing since the primary-domain migration |

So: fragments cannot exist without a gate, cannot be activated without a recorded passing run, and the suite that would produce that run is a sprint away. Stages 1-3 cannot execute without activated fragments.

### What was decided

**`NFR-043` protects two distinct things**, and only one of them needs the corpus:

1. *No fragment change reaches production unreviewed.* — change detection.
2. *No fragment change degrades reasoning quality.* — output regression.

Sprint 1 implements (1) in full and defers (2) honestly:

| Mechanism | What it guarantees |
|---|---|
| `prompts/fragments.manifest.json` records every fragment's content hash | A fragment cannot be edited without the edit appearing in a reviewed diff |
| `fragment-gate.test.ts` runs on every build, with no database | The gate is executed, not documented |
| Boundary check 7 verifies the manifest **covers every** template | A fragment cannot be added outside the gate |
| `fragments:publish` refuses to publish when authored content and manifest disagree | The published row always matches reviewed source |
| `content_hash` on each published row | Divergence between source and database is detectable afterwards (`DB §4.5`) |

**`regression_pass_reference` is set to `fragment-manifest-gate:fragments-v1`** — naming the gate that actually ran. It is not a fabricated pass, and it is not the corpus suite pretending to be one. When Sprint 2 builds the corpus runner, new versions carry its run reference instead.

### Why not weaken check 7 instead

Marking check 7 inactive until Sprint 2 would have been simpler and would have left exactly the hole the fail-safe design exists to prevent: templates in the repository with nothing governing their change. The check now passes because a real gate exists, and its note says plainly what that gate does and does not cover.

### Minimum authoritative amendment to ratify

**`NFR-043`** — separate the two guarantees, or state that the change gate satisfies it until the corpus suite exists. As written, `NFR-043` is a single requirement that Sprint 1 can only partially meet, and the current text does not say which part is required when.

### Still open

`AI §10.5` step 4 — "run the full regression suite against it" — remains undischarged for both provider adapters (D-11), for the same reason.

---

## D-15 — Stage 6 runs without Stages 4 and 5

**Recorded. Architecture Analysis consumes Stages 1-3 only, in this build.**

Discovered while implementing Stage 6 (2026-08-13).

`AI §3.2` specifies Stage 6's input as **"Context + knowledge + reasoning plan"**. Two of those three do not exist:

| Input | Produced by | Status |
|---|---|---|
| Context | Stage 3 — Context Extraction | ✅ implemented |
| Knowledge | Stage 4 — Knowledge Assembly | ❌ Sprint 2 |
| Reasoning plan | Stage 5 — Reasoning Planning | ❌ Sprint 2 |

The `Roadmap` places Stage 6 in Sprint 1 and Stages 4-5 in Sprint 2, so the sequence it prescribes and the input `AI §3.2` prescribes cannot both be satisfied now.

**Implemented on classification + intent + context.** This is a reduction in *evidence available*, not in traceability discipline: every component is still grounded in a context element, and grounding is still verified deterministically. What Stage 6 lacks today is platform knowledge (`§4`) and depth planning (`§5`) — both of which shape *how much* architecture to derive, not *whether it is justified*.

No amendment is needed if Stages 4-5 land before release. If Stage 6 were ever to ship without them, `AI §3.2`'s input list would need to say so.

---

## D-16 — Stage 6 regenerates once, and `SA §11.3` says stages never retry

**Recorded contradiction. `AI §3.2` implemented; the exception is narrow and typed.**

| Source | Statement |
|---|---|
| `AI §3.2` Stage 6 | "Traceability verification failure triggers **one regeneration**; persistent failure fails the stage rather than emitting an unjustifiable design." |
| `SA §11.3` | "Pipeline stages 5–10 — **No automatic retry**. A stage failure indicates a systematic issue, and retrying multiplies cost without changing the outcome." |

Both cannot hold for Stage 6.

**`AI §3.2` was implemented**, for three reasons. It is the stage-specific statement against a general rule. `SA §11.3`'s own rationale — "the same input will produce the same failure" — is true of deterministic faults but not of a model omitting a citation, which is exactly the failure in question. And `§11.3` already grants "Schema validation failure — exactly one regeneration attempt", so a single regeneration for a structurally-verified output is a pattern that section itself uses.

**The exception is deliberately narrow.** Only `ArchitectureTraceabilityError` regenerates. A malformed design, a duplicate component name, a missing failure-handling field — none earn a second attempt. The regeneration is recorded in `STAGE_TRACE.retry_count`, so it is visible rather than hidden, and every other stage still records `0`.

### Minimum authoritative amendment to ratify

**`SA §11.3`** — add a row, or a carve-out on the stages 5-10 row, for Stage 6 traceability regeneration. One line.

---

## Stage 6 scope note — `FR-031`–`FR-034` are not Stage 6

Not a decision, but worth recording because the grouping invites the mistake.

`FR-031` (Mermaid diagram), `FR-032` (risk analysis), `FR-033` (complexity scoring) and `FR-034` (platform recommendation) each state **"Depends on: FR-030"** — they consume the architecture, they do not constitute it. The authoritative placement is unambiguous:

| Requirement | Stage | Sprint |
|---|---|---|
| `FR-030` Architecture generation | **6 — Architecture Analysis** | 1 |
| `FR-034` Platform recommendation | 7 — Recommendation Generation | 2 |
| `FR-031`, `FR-032`, `FR-033` | 9 — Artifact Generation | 2 |

`AI` Appendix A maps stage 6 → `FR-030` alone; `Roadmap` Sprint 2 lists "Risk analysis, complexity scoring, platform recommendation, Mermaid diagram" together as artifacts. `DB §4.3` agrees at the persistence layer: `ARCHITECTURE_MODEL` and `ARCHITECTURE_COMPONENT` are "Written at Stage 6", while `RISK_ITEM` and `COMPLEXITY_ASSESSMENT` are "Written during artifact generation".

Stage 6 therefore implements `FR-030` only. The other four remain unimplemented and unstarted.

**Architecture-producing paths** are `business_requirement` and `technical_assessment`, from `AI §9.1` ("Architecture Recommendation … Paths: Requirement, assessment") and `AI §4.1` (a job description generates no architecture). Other paths skip Stage 6 rather than failing it.

---

## D-17 — The harness is a CLI, and it replays

**Decided. Two choices, both forced by what the documents do and do not say.**

Taken while building the Sprint 1 Interface deliverable (2026-08-13).

### Why a script and not an HTTP endpoint

The `Roadmap` Sprint 1 Interface row — "Minimal harness — text in, raw structured output. Deliberately unstyled." — carries **no requirement reference**, the only row in that table without one. `EP-2` asks for something that "can be executed, observed, and judged", and names the target directly: "a business requirement produces a schema-valid architecture you can read".

Nothing authoritative requires an API surface for it. So the harness follows the smallest convention already in the repository — an npm script over `tsx`, exactly like `fragments.mts` — rather than expanding the production API, which `API-060` and the remaining API work will do on their own schedule.

### Why it replays a recording

The harness must run the real pipeline through the real provider abstraction, and **no real provider adapter exists**. The two available are the stub, whose synthetic digest no stage can parse, and the replay adapter. So the harness primes the replay adapter from a recorded run — which is what D-11 built it for.

Fixtures are keyed by composing each prompt from the **published** fragment versions, so a fragment change invalidates the recording loudly rather than replaying an answer to a question that is no longer being asked.

> **Stated in the harness output itself:** the pipeline, provenance chain and persistence are real; the reasoning is not. Reasoning quality cannot be judged until a real provider adapter runs. Printing that beside the result stops the harness being mistaken for evidence it does not provide.

### Isolation

`src/harness/` is ranked as a **composition root** in the boundary checker, which is what it is. It holds no reasoning, no parsing, no validation and no persistence logic: boundary check 6 already makes re-implementing a stage impossible, and a test asserts the positive half — that it goes through `createPipeline` and the production sinks. Deleting it would cost a viewing window and nothing else.

The token rate is harness-local, for the reason D-10 item 5 records: no persistent rate configuration surface is defined, so cost in the report demonstrates the accounting path rather than a real bill.

---

---

## D-18 — Real provider: credential, pricing, and what the adapter declares

**Decided. Three small choices, each the minimum the existing contracts force.**

Taken while implementing the real adapter (2026-08-13).

### Credential — environment only, read in one place

`NFR-023` keeps provider keys out of the database, and `DB §13.2` classes them Credential: never logged, never exported, never in a trace. The minimum that satisfies this is an environment variable.

`ANTHROPIC_API_KEY` is read by `config/env.ts` — the module whose docstring already says "No other module reads `process.env`" — and handed to the adapter as a constructor argument. The adapter never reads the environment, so it cannot pick up a credential the composition root did not choose to give it. All provider settings are **optional**: the product, the whole offline suite and CI run with none of them set.

No secrets service, no credential subsystem. `.env` is gitignored; `.env.example` documents the variables with empty values.

### Pricing — configured, and refused when absent

D-10 item 5 recorded that no persistent rate surface is defined and none was invented. That remains true: rates are `PROVIDER_INPUT_USD_PER_MTOK` and `PROVIDER_OUTPUT_USD_PER_MTOK`, decimal strings, USD per million tokens, feeding the existing `TokenRate` unchanged.

**The real adapter refuses to run without them.** The offline adapters keep a placeholder rate because their cost figure only demonstrates the accounting path; a real call billed at an invented rate would put a plausible, wrong number into the unit economics `TV-4` depends on, which is worse than having none.

### Capability declaration — `structuredOutput: false`

`AI §10.6` prohibits "capability assumptions without declaration", and a false declaration is worse than none. This adapter sends a plain message and asks for JSON in the prompt; it cannot *guarantee* conformance to a supplied contract, which is what the capability claims. Tool-use or structured-output modes would change that and would be a separate, declared change.

The declaration is honest today and costs nothing: stages 1-3 and 6 supply no `outputContract`, so no degradation is recorded.

### Not registered in the provider registry

`createProvider(id)` takes no arguments, and the real adapter needs a credential and a model. Registering it would require either a partially-constructed adapter or a registry that reads the environment; both are worse than leaving construction to the composition root. `AI-002` configurability is unaffected — provider and model are environment-configured with no code change.

### Minimum amendment to ratify

**None required.** Every choice above sits inside an existing contract. What remains open is D-10 item 5 itself: if rates should live in `PROVIDER`/`MODEL_VERSION` rather than the environment, that is a `DB §4.5` amendment, and the environment variables become its loader.

---

---

## D-19 — Stage 3 verifies a quote; the span is derived

**Implemented. A strengthening of an existing check, not a change to it.**

Prompted by the first real-provider run (2026-08-13), which failed at Stage 3.

### What the first real run showed

The model returned `source_span_start: 1599, source_span_end: 1706` against a **1637-character** input. The overshoot was 69 characters — and the *start* was wrong by the same 69: the 107-character sentence it had identified actually begins at 1530. It found the right words and miscounted its way to them.

No encoding or extraction transform explains 69 (CRLF would add 26, the YAML indent 54, both 80), and the pipeline passes the identical `input.text` to both the provider and the validator. The cause was model arithmetic, which is not a thing language models do reliably.

**The more serious finding was what did *not* fail.** Elements 0-21 passed, but the old check only verified that a span *fitted* inside the input. Under a uniform +69 drift, several almost certainly pointed at the wrong text and validated silently — an in-range label that traces to words the element does not come from. That is exactly the unverifiable provenance `AIP-3` forbids.

### What changed

Stage 3 now asks the model for `source_quote` — the input's own words, copied — and derives `source_span_start`/`source_span_end` by locating that quote. A quote that does not occur is rejected; any offsets the model volunteers are ignored entirely.

| | Before | After |
|---|---|---|
| Model supplies | Two integers | The quoted text |
| Verified | The span fits the input | The text **occurs in** the input |
| Span origin | Trusted from the model | Computed by `indexOf` |
| Wrong-but-in-range | Passed silently | Impossible — the span is the quote's own position |

Matching is exact first; on failure, whitespace runs are collapsed on both sides and the search repeated, mapping back to real offsets. A quote spanning a line break is still the input's own words, and discarding a correct element over a newline rendered as a space would be a worse error than the one being fixed. Words absent, or present in another order, still fail. The first occurrence wins, so resolution is deterministic.

### Why this needs no amendment

The requirements constrain the property, never the representation:

| Source | Wording |
|---|---|
| `FR-013` | "`stated` elements are traceable to a span of the source input" |
| `AI §3.2` | "traceable to a span, **verified structurally**" |
| `AI §5.3` | "Source reference — For `stated`: the input span" |
| `DB §4.2` | stores `source_span_start` / `source_span_end` |

None says the *model* must originate the offsets. The external `ContextElement` contract and the database schema are untouched: the same two columns are populated, by arithmetic over verified text rather than by trust. This satisfies "verified structurally" more completely than the previous check did.

### One consequence worth knowing

The harness recording is now coupled to the text it is replayed against, because its quotes must verify. That is the check working: a recording replayed over unrelated input would otherwise manufacture provenance for words nobody submitted.

---

---

## D-20 — A failed stage retains what the provider returned

**Implemented. `structured_output` is populated on failure; no schema change.**

Prompted by the first real Stage 6 failure (2026-08-13), which could not be diagnosed from its own trace.

### The gap

`DB §8.2` records "Structured input and output → StageTrace → **Reasoning reconstruction**", and `FR-100` requires a run be reconstructible "without re-running". The pipeline wrote `structured_output = null` on every failure — so the one case where reconstruction matters most stored nothing. Diagnosing the real Stage 6 failure would have meant paying to run it again.

### What changed

`runStage` captures the provider response *before* parsing. On failure the trace stores `{ "unparsed": "<raw response>" }`; on success it stores the parsed handoff exactly as before. The shape is deliberately distinct so a consumer can tell a reconstructed handoff from a rejected one without guessing.

**No schema change was needed.** `StageTrace.structured_output` is already `Json?` and is already the field `DB §8.2` names for this purpose.

### Why this cannot leak (`AI-006`, `FR-093`)

When the **provider** fails, the invoker throws and nothing is returned, so `lastProviderOutput` stays `null` and the trace stores nothing. The raw SDK error — which names the vendor, the model and sometimes the account — never leaves the adapter; only the scrubbed `ProviderError` message reaches `failure_reason`. Content is retained only when the provider *succeeded* and parsing failed, which is exactly the case needing diagnosis.

Retention is unchanged: this is `StageTrace` content, on the 7-day tier, Confidential business (`DB §13.2`), operator-only (`DB §8.4`) — the same classification the field already carried on success.

### Not addressed here, and still outstanding

**`DB §6.2` progressive persistence.** The specification is explicit:

> "**Progressive** — Records are written as stages complete, not batched at the end."
> "A failed analysis retains everything up to the failure point, supporting diagnosis and partial presentation (`FR-091`)."

`AnalysisResultSink` commits once at the end and the harness calls it only on success, so a Stage 6 failure discards correct Stage 1-3 output. The first real run cost roughly 42 seconds of successful, paid classification, intent and context extraction — including verified quote-based provenance — and stored none of it.

D-20 makes a failure *diagnosable*; it does not make the work *survive*. Closing that requires either per-stage persistence or a partial-result commit on failure, and belongs to the orchestrator that owns job lifecycle (`SA §3.4`).

**Also outstanding:** the harness does not persist `ProviderInvocation` rows at all — it collects them in memory for its report — so a real run's token counts and cost never reach the trace store.

> **Both items are now closed.** Progressive persistence landed in **D-21**; `ProviderInvocation` persistence landed in **D-23** (2026-08-14), verified against real PostgreSQL.

---

---

## D-21 — Progressive persistence: one transaction per stage

**Implemented. The boundary is derived, not chosen.**

Closes the gap D-20 recorded as outstanding.

### Deriving the boundary

Three constraints fix it, and together they leave one answer:

| Constraint | Source | Consequence |
|---|---|---|
| "Records are written as stages complete, **not batched at the end**" | `DB §6.2` | The boundary cannot be the run |
| A stage's writes must arrive together — Stage 3's elements then their conflict links, Stage 6's model then components then references | `AIP-3`, `FR-030` | The boundary cannot be smaller than a stage: a half-written element or an ungrounded component is worse than an absent one |
| "Partial pipeline failure must yield partial results" | `FR-091` | Each stage's commit must survive a later stage's failure |

**One transaction per stage.** Each commits independently; a later failure cannot roll back an earlier commit.

### How it is wired

A `StageResultSink` port on the NIE, called from `runStage` as each stage completes — deliberately the same shape as the `StageTraceSink` and `FragmentUsageSink` the pipeline already had. The NIE still sees no Prisma and no row identifier (`AD-02`, boundary check 2).

**Unlike the trace sinks, a failure here is not swallowed.** `DB §6.2` grants the non-blocking exemption to *trace* writes specifically — "trace failure never fails an analysis". A primary-domain write that fails means the analysis was not stored, and `FR-060` retrieval reproduces what is stored; reporting success for an analysis nobody can retrieve would be a lie.

### Foreign keys, satisfied by ordering rather than by batching

`CONTEXT_REFERENCE` points at `CONTEXT_ELEMENT`. Stage 3 commits before Stage 6 begins, so Stage 6's references resolve against rows that are already durable rather than rows inside an open transaction — a stronger guarantee than the batched version had.

Stage 6 grounds its components by *index* into the Stage 3 set, and `CONTEXT_ELEMENT` has no ordinal column to recover that order from afterwards. The sink therefore holds the ids from its own Stage 3 write, keyed by `analysis_id`. **This is why no schema change was needed.** The limitation is that the mapping is in-process: a run resumed in a different process could not currently persist Stage 6. That is acceptable while a run is a single in-process pipeline, and would need an ordinal column — or a lookup — if runs ever become resumable.

### What it cost the project to not have

The first real provider run produced correct classification, intent and context extraction — including verified quote-based provenance — and stored none of it, because Stage 6 failed afterwards. Under D-21 that run would have kept all three stages.

---

---

## D-22 — The reported sufficiency had nowhere to land

**Implemented. `ANALYSIS.sufficiency_level` is written in Stage 3's own transaction; no schema change.**

Closed 2026-08-14, completing D-13.

### The gap

Three pieces were in place and none of them met:

| Piece | Status before |
|---|---|
| `ANALYSIS.sufficiency_level`, annotated "Written at Stage 3 (`AI §5.4`)" | Column existed, nullable, **never written** |
| Stage 3 reports `sufficiency`, validated against the `§5.4` enumeration (D-13) | Produced on every run |
| A per-stage `StageResultSink` that commits as each stage completes (D-21) | Persisted context *elements* only |

So every analysis in the store carried `sufficiency_level = NULL`, including runs whose Stage 3 had reported `insufficient` and halted the pipeline. The halt was visible in the trace; the reason for it was not visible in the analysis.

### What changed

One write, inside the transaction `persistContext` already opened:

```
tx.analysis.update({ where: { analysisId }, data: { sufficiencyLevel: context.sufficiency } })
```

**The transaction boundary is the point.** D-21 derived one transaction per stage because a half-written stage is worse than an absent one. A sufficiency level without the context set it describes — or a context set without its level — is exactly that half-written stage, so the two commit together or not at all.

The three `SufficiencyLevel` enum values match the `SUFFICIENCY_LEVELS` constant the stage validates against, so no mapping layer exists to drift.

### Why this needs no amendment

Nothing was decided here. `DB §4.2` already specifies the column, the schema already annotates when it is written, and D-13 already fixed where the value comes from — reported by the model, never computed. This is the write those three had been describing.

### Deliberately still null: `overall_confidence_band`

The other nullable stage-written column on `ANALYSIS` remains unwritten, and correctly so. `DB §4.2` annotates it **"Written at Stage 11 (`§6.1`)"** — Confidence Assembly — which is not in the twelve-stage set Sprint 1 implements (D-7: stages 1-3 and 6). Populating it now would mean inventing a confidence rule that no stage has computed, which is the D-13 error in a different column.

It becomes live with Stage 11 in Sprint 2. `docs/11` A-9 — the confidence band for analyses producing no artifacts — is the open question it will have to answer.

---

---

## D-23 — Provider invocations are persisted, not merely reported

**Implemented and verified against real PostgreSQL. Composition wiring only; no change to the provider abstraction.**

Closes the second item D-20 recorded as outstanding. 2026-08-14.

### The gap was one line, and it was in the composition root

Everything the requirement needs already existed:

| Piece | Where | Status before |
|---|---|---|
| A `ProviderInvocationRecord` built per **attempt**, with latency, tokens, cost, outcome, error class, attempt number and fallback | `provider/invoke.ts` | ✅ |
| A trace-store recorder mapping that record to `PROVIDER_INVOCATION` | `db/provider-invocation-recorder.ts` | ✅ |
| `stage_trace_id` and `model_version_id` supplied per stage | `nie/pipeline.ts` | ✅ |
| The recorder actually passed to the invoker | `harness/run.ts` | ❌ **an array push** |

The harness collected invocations in memory for its report and discarded them. So the one run that mattered most — the first real, paid Anthropic run — produced real token counts and a real cost figure that reached a printed report and no table.

### What changed

The harness now passes the production recorder, teed so the report still shows what it always showed. Retry, normalization, cost computation, stage traces and progressive persistence are untouched.

### One ordering consequence, stated plainly

The invocation row is written **while its stage is still running**, so it lands *before* its `stage_trace` parent exists. That is safe only because `stage_trace_id` carries **no foreign key** — the property D-9 was forced into by the tiered retention model. The same annotation that could not be honoured as a constraint is what makes this write order legal.

### What is now verified

| Case | Recorded |
|---|---|
| Success | One row: latency, input/output tokens, `estimated_cost` at `COST_SCALE` places, `attempt_number` 1 |
| `AI §10.2` degradation | `fallback_used` true |
| Transient then success | **Two rows**, attempts 1 and 2 — the failed one with zero tokens and zero cost, both carrying the same `stage_trace_id` |
| Persistent | One row only; `AI §10.4` does not retry it |
| Retry budget exhausted | Three rows, attempts 1-3 (the D-10 item 1 provisional bound) |
| Trace store unreachable | The provider call still succeeds — `DB §6.2` is unchanged |

Against real PostgreSQL, a full harness run's invocations are found in `provider_invocation`, each resolving to a stage trace of that run and to the `model_version_id` that served it (`AI-004`).

### Minimum authoritative amendment to ratify

**None.** `DB §4.7` already specifies the entity, `FR-093` already requires provider failure recorded "with full detail", and `NFR-083` already requires per-call cost accounting. This is those three being satisfied rather than described.

### Still outstanding around it

`VALIDATION_EVENT`, the other trace entity, is still never written — it belongs to artifact schema validation (`FR-039`, Stage 9, Sprint 2). And no boundary check covers recorder wiring, so the orchestrator (`SA §3.4`) will have to wire the same recorder when it arrives; check 6 covers stage traces only.

---

---

## D-24 — What a recorded regression run proves, and what it cannot

**Decided before any capture is paid for. Recorded mode is a compatibility gate; fragment activation needs evidence that exercised the changed fragment.**

Taken while building the Sprint 2 regression infrastructure (2026-08-14), before spending on capture.

### The contradiction inside `AI §12.3`

`AI §12.3`'s execution policy — resolved 2026-08-12 — describes recorded mode twice, and the two descriptions disagree:

| Where | Claim |
|---|---|
| Mode table, **Trigger** | "Every **code** change" |
| Mode table, **Purpose** | "Detects regressions introduced by **code**" |
| Property table, **What recorded mode detects** | "Regressions caused by **fragment**, stage, generator, or code changes" |

The third claim cannot hold. A recording is a provider's answer to a *specific composed prompt*. Change a fragment and the prompt changes, so no recorded answer to the new prompt exists — replaying the old one measures the old prompt. **Recorded mode is physically incapable of validating a fragment change**, which is precisely the change `NFR-043`, `AI-011` and `R-14` care most about.

### What is decided

| # | Decision |
|---|---|
| 1 | **Recordings stay keyed to the composed prompt.** D-17 chose this so a fragment change "invalidates the recording loudly rather than replaying an answer to a question that is no longer being asked". Loosening the key to survive fragment edits would reinstate exactly that failure |
| 2 | **An invalidated recording is `stale`, not an error.** A fragment change making a recording unreplayable is the mechanism working. Reporting it as a provider failure blames the system for a state the design intends |
| 3 | **Recorded mode is a compatibility and regression gate.** It proves the pipeline, parser, provenance checks and the deterministic `docs/11` §9 expectations still hold *given a previously captured response*. It does **not** prove the current prompt produces that response |
| 4 | **Fragment activation requires evidence that exercised the changed fragment** — a capture or a live run. A `regression_pass_reference` naming a replay of the *previous* fragment's responses is not a pass on the change |

### Why 4 follows from the documents rather than from preference

`NFR-043` requires the suite to run "before any template change ships"; `AI-011` repeats it; `R-14` names silent template regression as the high-likelihood risk the gate exists for. `DB §4.5` then makes activation conditional on a recorded passing run — a **data** constraint. Put together, the reference attached to a new fragment version has to name a run that saw that fragment.

This does **not** contradict `AI §12.3`'s "a change may merge on a passing recorded run alone". Merging code and activating a fragment version are different events, and only the second is what `DB §4.5` gates.

### What it costs, stated plainly

Capture spend is bounded to fragment **activations**, not commits. Sprint 2 is a reasoning-iteration sprint, so activations will be frequent — and every one of them needs fresh evidence. That is the real price of the gate, and it is a price the specification already implies rather than one this decision introduces.

### Consequences implemented alongside this record

| Consequence | Mechanism |
|---|---|
| A fragment change must be *detectable* before the run, not discovered as a key miss | Each recording carries a composition hash over the fragments it was captured under; the runner recomputes and reports `stale` |
| Evidence must be reviewable and tamper-evident | `research/regression-recordings/recordings.manifest.json` — content hashes, the same gate shape D-14 gave fragments |
| A pass reference must name the evidence, not just the cases | Recording hashes and the per-case assertion set are part of the reference and of its `runId` |
| A run cannot pass vacuously | Completeness and non-vacuous reference-integrity assertions |

### Minimum authoritative amendment to ratify

**`AI §12.3`** — correct the property table row so recorded mode claims code, stage and generator regressions, not fragment ones, and state which mode discharges a fragment change. One row, plus a sentence.

`NFR-043` still needs the D-14 separation it already required; this decision sharpens what the second half costs.

---

---

## D-25 — Classification selects a reasoning frame, and says so when it cannot

**Decided. Four ratifications, amending `AI §3.2`, `§4.1`, `§4.3` and `FR-011`. Resolves `AIQ-9`.**

Taken 2026-08-14, after the first corpus regression run over real captured evidence.

### What exposed it

`br-008` is the only failing case in the first vertical (12/13 passing). Its Stage 1 response, captured under the published fragments:

```json
{ "determined_type": "mixed", "dominant_type": "job_description",
  "confidence": 0.85, "candidate_types": ["business_requirement"] }
```

The corpus expects `business_requirement` below the 0.6 threshold. The failure could not be adjudicated, because **four separate gaps meet in this one input**:

| # | Gap | Where it should have been |
|---|---|---|
| 1 | No stated test for which type wins when artifact shape and stated ask diverge | `AI §4.1` defines types by artifact; `§4.2` says classification *is* the reasoning frame. Neither says which governs |
| 2 | No rule for determining `dominant_type` | `AI §4.3` requires the concept and defines no rule |
| 3 | No rule mapping input ambiguity to a confidence band | `FR-011`/`FR-015` fix the threshold and the consequence, never which inputs land where |
| 4 | `mixed` enumerated by `AI §4.1` and excluded by `FR-011` | `AIQ-9`, open since 2026-08-12 |

The input is posting-shaped but explicitly pre-posting — *"Before we advertise the role"* — and closes by asking whether the **project** is *"the right shape"*. `AI §4.2` states the stakes plainly: *"A misclassification is therefore not a mislabel — it is an analysis conducted under the wrong frame."* Classifying it `job_description` suppressed the architecture entirely (`AI §9.1`), which is the analysis that was asked for.

### The four decisions

| # | Decision |
|---|---|
| 1 | **Classification is purpose-primary, artifact-evidential.** Artifact identity decides the ordinary case and is never discarded. Where a document of one shape explicitly asks for the analysis of another, the frame the submitter asks for governs |
| 2 | **Dominance follows the ask.** The dominant type is the one whose `§9.1` path produces what was asked for. Where the intended analysis cannot be determined, dominance is **not determinable** and the low-confidence route applies |
| 3 | **Ambiguity calibration.** Where two or more type readings are each substantively complete and the input does not establish which analysis is intended, confidence is below 0.6 and `FR-015` applies. Confidence measures the **resolved terminal classification**, never merely the detection of mixed signals |
| 4 | **`AIQ-9` resolved.** The five `FR-011` values are terminal. `mixed` is an internal Stage 1 detection state, resolved before the stage completes; the secondary reading is disclosed through `CLASSIFICATION.candidate_types`. This ratifies D-6 into the authoritative documents |

### Why these four together, and why now

Each alone leaves a hole the next ambiguous case falls into. Resolving the enumeration (4) without a dominance rule (2) leaves the collapse undefined. Defining dominance without the calibration rule (3) forces a guess where the input supports none. And (1) is what makes (2) computable at all — dominance can only follow the ask once the ask is what governs.

**Decision 3's second half is the mechanism behind the `br-008` failure.** A `mixed` detection is collapsed to one type before the stage completes, so confidence carried over from the detection describes a judgement that no longer exists. The model was plausibly right to be 0.85 confident the input was mixed, and had no comparable basis for the dominance choice that confidence then travelled with. `PV §3.4` classes false confidence as a defect; `AI §8.5` classes over-confidence as severe.

**No numeric rule is introduced.** Text length, element counts and percentage splits are not evidence of what a submitter wants, and "material proportion" in `§4.1`'s former `mixed` row described *detection*, never *dominance*. Where the ask is silent, the honest output is low confidence and a question — not arithmetic.

### What was amended

| Document | Change |
|---|---|
| `AI §4.1` | Terminal enumeration reduced to five; `mixed` row removed and restated as an internal detection state; purpose-primary selection rule added |
| `AI §4.3` | Two new subsections: dominant-type determination, and ambiguity/confidence calibration |
| `AI §3.2` | Stage 1 `Output` row reconciled to the five terminal values |
| `AI` Appendix — `AIQ-9` | Marked resolved, with the resolution stated |
| `FR-011` | Fifth acceptance criterion added, stating the five are terminal and how a mixed input resolves. **Threshold and `FR-015` behaviour unchanged** |

`DB §4.2` still refers to `determined_type` as "the closed enumeration (`AI §4.1`)". That reference now resolves to five values and needs no edit, but the `DB` document was outside this task's scope and has not been re-read for consequential wording.

### `br-008` is unchanged, deliberately

`docs/11` §6.2 permits changing an expectation only when the expectation was wrong, and states that *"a change justified only by 'the system now produces X' is rejected"*. The expectation survives both candidate tests — `job_description` fails the purpose test on the stated ask, and fails the artifact test on `§4.1`'s *"a role posting"*, which this input explicitly is not yet. **Nothing in `research/` was modified.**

`br-008` therefore remains a **recorded regression failure** until the ratified rules are implemented in the classification fragment and re-captured. It is adjudicated, not masked.

### Implementation consequence

**Prompt changes happen only after this ratification, never before.** `prompts/stage/classification.md` is untouched by D-25. Implementing rules 1–3 there is a separate, subsequent task, and it will invalidate every recording whose composition includes Stage 1 — which is all thirteen.

**No API spend is part of D-25.** This decision is documentation only: no provider call, no capture, no publication.

### Still open around it

`FR-015`'s confirmation path is not implemented — Sprint 1 built stages 1-3 and 6, and the low-confidence user interaction is later work. Until it exists, "`br-008` passes" will mean the classifier is calibrated, not that the confirmation flow works.

---

---

## D-26 — `br-008`'s confidence expectation predates the rule it was measured against

**Decided. One corpus expectation changed under `docs/11` §6.2; suite version incremented to `corpus-v2`. No case content changed, no recording touched, no API spend.**

Taken 2026-08-14, after the first capture under D-25.

### What changed and why

`br-008`'s first Stage 1 response under the D-25 classification prompt:

```json
{ "determined_type": "business_requirement", "confidence": 0.85,
  "candidate_types": ["job_description"] }
```

D-25 rules 1, 2 and 4 landed exactly as designed — the explicit ask resolved the frame, `mixed` disappeared from the output, the secondary reading was disclosed rather than selected, and Stages 3 and 6 both ran for the first time on this case. Rule 3 was the sole disagreement: the frozen expectation required `below_threshold`.

**The expectation predates the rule.** `br-008` was frozen 2026-08-12 under the theory that two substantively complete readings *alone* force sub-threshold confidence — its original rationale says so. D-25 (2026-08-14) ratified a **conjunctive** trigger in `AI §4.3`: competing complete readings **and** an input that does not establish which analysis is intended.

`br-008` establishes it: *"Is this a sensible first project for someone, and is it the right shape? I'd rather know now than after we've hired."* That sentence is what D-25 rules 1-2 use to resolve the classification to `business_requirement`. **The same sentence cannot both resolve the frame and leave it unresolved**, so the trigger's second condition is not met and the original bound no longer follows.

### Why this is not "the model produced 0.85"

`docs/11` §6.2 rejects a change *"justified only by 'the system now produces X'"*. This one is justified by the rule change, and the counterfactual makes that concrete: had the model returned a sub-0.6 confidence *while* classifying `business_requirement`, it would have satisfied the corpus and contradicted `AI §4.3`. The proposal would be identical had no capture been run — D-25 alone determines it.

D-25 also cost the system a real correction: the classification itself was wrong before and had to change. This is not a suite bent to fit a model.

### Three quantities, kept apart

| Quantity | Status |
|---|---|
| **Classification correctness** | ✅ Corrected by D-25 to `business_requirement`; the corpus expectation was right and is **unchanged** |
| **Confidence calibration** | ⚠️ The only field changed — `bound`, `below_threshold` → `at_or_above_threshold` |
| **`candidate_types` disclosure** | ✅ Working as intended. `AI §4.3` provides it for disclosing a secondary reading, and a non-empty list has never implied ambiguity — the prompt asks for it *"whenever another type was a genuine contender"*, a lower bar than the trigger's |

### `corpus_version` is an entry marker and stays `corpus-v1`

**This is the part most likely to be got wrong later, so it is recorded explicitly.**

`docs/11` §4.1 defines the per-case field as *"version at which the case entered"* — immutable provenance, not a mutable per-case version. `br-008` entered at `corpus-v1` and always will have, so **its `corpus_version` remains `corpus-v1`.**

`§6.3`'s increment is satisfied at the **suite** level, recorded in `research/golden-corpus/README.md`, which is where the corpus states its version.

Two reasons this matters beyond pedantry:

1. Rewriting the field would assert a falsehood about when the case entered.
2. The regression recording store partitions evidence by that field — `research/regression-recordings/<corpus_version>/<case_id>.json` — so changing it would make `br-008`'s freshly paid recording unfindable, and no supported path exists to write a `corpus-v2` manifest. A metadata edit would have stranded paid evidence and left the case permanently `blocked`.

> **Recorded as a latent design fault, not fixed here.** The store keys on a field `docs/11` defines as entry provenance, and the code reads it inconsistently — lookups are per case (`runner.ts`), while the manifest gate, status and pass reference take `cases[0]`. This works only while every case shares an entry version, which `§6.1` will break the first time a case is **added**. It needs its own decision and a code change; D-26 deliberately does not touch code.

### `ta-004` — related, deliberately not batch-treated

`ta-004` is the only other deliberately ambiguous case with an explicit ask, so D-25's second conjunct is arguably unmet there too. But its ask is itself ambiguous: its rationale notes the assessment path *"does not require an examination context"*, so *"What would you do differently?"* points at `technical_assessment` and `business_requirement` simultaneously. **`br-008`'s ask disambiguates; `ta-004`'s does not.** It is recorded here as requiring separate adjudication and is **unchanged**.

`jd-001` and `ew-003` are unaffected — neither states an ask, so both satisfy the trigger in full and their `below_threshold` expectations remain correct.

### Amendments

| File | Change |
|---|---|
| `research/golden-corpus/business-requirement/br-008.yaml` | `bound` → `at_or_above_threshold`; rationale rewritten citing D-25; **original rationale preserved** in `previous_rationale` per §6.2 and the `docs/11` A-12 precedent; `changed_at` / `changed_by` / `previous_bound` recorded |
| `research/golden-corpus/README.md` | Suite version → `corpus-v2`; §6.2 change-log entry; note that per-case `corpus_version` is an entry marker |

Nothing else. No prompt, code, validator, schema, database or recording change, and no provider call.

### What remains

`br-008` should now pass all six evaluated assertions on its existing recording, verifiable by a free `regression:run`. The other twelve recordings are stale from the D-25 fragment publication, so a full green suite still needs a re-baseline that is a spend decision, not a specification one.

---

---

## D-27 — Gap analysis needs a second side, and no document supplied one

**Decided. The capability profile is a new authored primitive; Stage 7 implements the job-description path as a decision.**

Taken 2026-08-15, opening Phase 2. Sprint 1 is frozen and unchanged.

### The gap in the requirement itself

`FR-022` requires the job-description path to produce "required-skill extraction, **skill gap analysis**, portfolio recommendations, and interview guidance". A gap analysis compares two things, and **no authoritative document says what the second thing is.** Every input the NIE models describes the submitted artifact; nothing models the operator the analysis is for.

That is not an unbuilt part of an existing concept — it is a missing concept. Stage 7 cannot decide between applying and building without it, so it is recorded here rather than assumed into existence.

### What was decided

| # | Decision |
|---|---|
| 1 | **The capability profile is an authored repository asset** — `research/capability-profile/profile.yaml`, the same shape `docs/11` gives the corpus and D-3 gives fragments: reviewable as a diff, owned by a human, **never written by the system**. NAIGX authoring its own inventory could justify any verdict it liked |
| 2 | **Evidence is the unit, not claimed skill.** A capability without at least one evidence item carrying an openable locator cannot load, so it can never be cited |
| 3 | **`familiar` depth is loadable but never matchable.** Familiarity means no artifact proves it. Accepting it produces "apply now" for a posting the operator cannot evidence — the one error that costs a real application. Rejecting it costs time instead, and only that error is recoverable |
| 4 | **Stage 7 output is a decision**, with `apply_now` first-class. The product maximises employability, not project count, so concluding that existing evidence suffices is a valuable answer |

### The invariants, and why each is a refusal

Every requirement must cite a Stage 3 context element — the same discipline `FR-030` applies to architecture components, applied to the other end of the pipeline. **An invented requirement manufactures a gap, and a gap manufactures a project.** Every match must cite a capability that exists, is matchable, and one of *its own* evidence locators. `build_first` must name at least one decisive gap, `apply_now` must name none, and a requirement cannot be both matched and a gap.

### Scope, held deliberately

Stage 7 decides **whether** to build and names what a build would have to close. What to build, how to test it, what evidence to produce, and how to use it in an application are Phases 3-5 and are **not** implemented.

### Persistence is deferred, and this is the one thing not delivered

`DB §4.3` already has a `Recommendation` model, but it is shaped for the platform-recommendation path — non-nullable `confidence_band` (Stage 11, unimplemented), `criteria_applied`, `limits`, and a required alternatives relation. The job-description verdict has none of those and has four collections the model cannot hold.

Forcing one onto the other would corrupt a specified entity; adding new models needs a migration, and **the local database holds the published prompt fragments the frozen regression baseline depends on** — a `migrate dev` that detects drift can offer to reset it. That risk is not worth taking inside a slice that does not need durable storage: the harness prints the verdict and capture records the raw response.

`StageResultSink.persistRecommendation` exists as an **optional** port, so the pipeline is ready and a sink that omits it simply stores nothing. **Recorded as outstanding**, with the schema decision to be taken on its own.

### Minimum authoritative amendment to ratify

**`FR-022`** — state what the gap analysis compares against, or reference the capability profile as an input to the job-description path. One clause. `AI §4.1`'s career-path description is unaffected.

---

## D-28 — A requirement's kind decides what closing it would take

**Decided. `required_capabilities` carry a `kind`; only a `technical` gap can drive a build; every requirement must be disposed of.**

Taken 2026-08-19, after the **first real Stage 7 run** against a live job posting. Sprint 1 remains frozen; this changes the Stage 7 contract fixed by D-27 and nothing else.

### What the real run showed

The posting was an "AI Automation & Implementation Specialist" role. Stage 3 extracted 46 grounded context elements; Stage 7 derived 23 requirements, matched 8 and reported 13 gaps, returning `build_first`. Every invariant held. The verdict was correct. Three defects surfaced anyway, and none was a reasoning error — each was a gap in the contract.

**1. Behavioural requirements became build targets.** Six of the thirteen gaps were dispositional: independent operation, fast task-switching, resourcefulness, short-notice execution, staying current, research ability. No portfolio project closes any of them. They inflated the gap count and, had a build generator consumed the list, would have produced work the operator could never finish.

The cause was structural, not a lapse. `RequiredCapability` carried `necessity` and `provenance` but nothing describing **what kind of thing the requirement is**. Every requirement was therefore implicitly capability-shaped, and because the profile models only technical capabilities, anything behavioural fell through to "no matchable evidence" and became a gap.

The run produced its own proof. `req-8` *"track record as builder/solo operator with rapid prototype-to-deployment capability"* matched **strong**. `req-9` *"independent operation with minimal oversight"* was reported as a **gap**. These are the same claim. The model matched the one phrased as a track record and gapped the one phrased as a disposition — an arbitrary split forced by a missing distinction.

**2. Requirements vanished.** `matched` and `gaps` were independent arrays, and the parser checked that they did not *overlap* but never that they *covered*. A partial function presented as a total one. Twenty-three requirements went in; twenty-one came out. `req-19` (training non-technical staff) and `req-20` (drone/aerospace experience) disappeared. Both were honest gaps. A requirement that vanishes is worse than one reported unmet, because the reader cannot tell it was considered at all.

**3. Any gap could be decisive.** `decisive_gaps` was constrained only to name a reported gap. Nothing prevented "resourcefulness" from being the sole justification for `build_first`. This run chose the four buildable gaps — Zapier, HubSpot, AI web builders, AI video tooling — by the model's good judgement, not because the contract required it.

### What was decided

| # | Decision |
|---|---|
| 1 | **Every requirement carries a `kind`** from a closed set: `technical`, `domain_experience`, `track_record`, `disposition`. It records **what closing the requirement would take**, judged on the requirement itself rather than on the posting's phrasing |
| 2 | **Only `technical` is buildable** (`isBuildableKind`). A project cannot close resourcefulness, five years in aerospace, or a history of training staff |
| 3 | **`matched` and `gaps` must partition the requirement set** — every requirement in exactly one, never both, never neither |
| 4 | **Every decisive gap must be `technical`.** With the existing rule that `build_first` names at least one decisive gap, `build_first` becomes reachable only when a genuine buildable gap exists |

`isBuildableKind` is deliberately the mirror of `isMatchable` in the capability profile: that predicate governs what may **support a match**, this one governs what may **drive a build**. Same shape, opposite ends of the pipeline.

### Why no third verdict, and what follows from that

If every gap is `domain_experience`, `track_record` or `disposition`, no decisive gap can be named, so the verdict must be `apply_now` — while real, significant, unmet requirements remain.

That is accepted deliberately. D-27 decision 4 fixes the outcome vocabulary at `apply_now` | `build_first`, and the question Stage 7 answers is *"should I build something first?"* Building would not close those gaps, so `build_first` would be false advice. Adding a third value would be a product change rather than a defect fix, and is not taken here.

The mitigation is prompt guidance, not a parser rule: when the verdict is `apply_now` and non-buildable gaps remain, the rationale must name them and say why building would not close them. **This is deliberately unenforced.** A mechanical rule over free text would be checkable only by keyword, which invites satisfying the checker rather than the reader.

### `FR-022` needs no amendment

Its acceptance criteria already require that *"portfolio recommendations are specific and buildable, not generic project categories."* This change makes the stage honour a criterion the specification already states; the vocabulary is drawn from `FR-022` rather than invented. The one-clause `FR-022` amendment identified by D-27 — naming what the gap analysis compares against — remains outstanding and is unaffected.

### Scope, held

This decides **which gaps may justify building**. It does not generate the build. What to build, how to test it, and what evidence to produce remain Phases 3-5, exactly as D-27 scoped them.

### Cost of the evidence

One real run, `claude-sonnet-4-5`, 4 provider calls, 17,347 input and 8,552 output tokens, **$0.1803**. No recordings were captured and the frozen baseline was untouched.

---

## D-29 — A gap earns a project only if a project could close it

**Decided. Stage 8 plans deterministically; Stage 9 generates one artifact; only decisive technical gaps may justify a build.**

Taken 2026-08-19, opening Phase 3A. Sprint 1 remains frozen; Stages 1-3, 6 and the Stage 7 contract fixed by D-27/D-28 are unchanged.

### Why Stage 8 is deterministic and Stage 9 is not

This is not a design choice taken here — `AI` App. A already fixes it, and the reasoning is worth restating because it is the load-bearing part of Phase 3:

> *"artifact selection asked of a model produces an inconsistent, unexplainable, untestable set that varies between runs on identical input — directly violating `FR-024`. Rules are inspectable, testable, and explainable to the user."*

So **which** artifacts exist, and **why each was included or omitted**, is arithmetic over the Stage 7 result. **What they contain** — grouping gaps into a coherent system, framing a business problem, sequencing work — is judgement, and judgement is what a model is for. The split follows the same line `docs/12` D-19 drew for spans and D-28 drew for kinds: never ask the model to compute what the application can derive.

Stage 8 makes no provider call, holds no prompt, and is unit-tested by running it twenty times on identical input and comparing.

### Only decisive technical gaps are eligible

`eligibleGaps` applies three filters, each a refusal carried forward:

| Filter | Refuses |
|---|---|
| **reported** | a project justified by a gap nobody found |
| **technical** (`isBuildableKind`, D-28) | a project aimed at resourcefulness, sector history, or a track record |
| **decisive** | a project justified by a gap the verdict did not rest on |

The first real run made the middle filter concrete: six of thirteen gaps were dispositional, and a naive generator would have proposed projects for "stays current on emerging AI technologies". D-28 gave those gaps a name; this decision is what stops them becoming work.

### Consolidation is enforced, not requested

A model asked for projects returns one per gap. Three mechanical rules make that impossible without capping the count, which would be arbitrary:

| # | Rule |
|---|---|
| 1 | **Coverage** — every eligible gap claimed by at least one project. The D-28 exhaustiveness move, one level up: a gap the operator was told was decisive, then quietly dropped, is worse than one never named |
| 2 | **No subset projects** — a project whose gaps are contained in another's closes strictly less and adds nothing |
| 3 | **Solo justification** — a project claiming exactly one gap must say why it cannot fold into another |

Rule 2 is the one that does the work. It makes redundancy structurally impossible, so the only way to add a project is to make it close something no other project does.

### Evidence is part of the specification

Every project must name at least one artifact that should exist when it is finished, from a vocabulary compatible with `capability-profile.ts`. The loop this closes is **build → ship → document → record → `profile.yaml`**, and a project leaving nothing citable leaves the inventory exactly where it was — which means the next analysis of the next posting reports the same gap again.

### Market reusability is inferred, structurally

NAIGX holds **one** job description and models no wider market. A claim that a project "transfers well to other postings" is therefore reasoning about the requirements in hand, never data.

`ReusabilityClaim.provenance` is fixed to `inferred` **in the parser, not read from the response** — a model cannot promote its own guess to fact by writing `stated`. `basis` is mandatory so a reader can discount the claim by seeing what it rests on.

The alternative considered and **deferred**: an authored `research/market-signals/postings.yaml`, human-owned like the capability profile, recording requirements the operator has actually seen recur. Architecturally consistent with D-27, but premature on one observed posting. It becomes worth building once several postings have been analysed, since the data is a by-product of using the system.

### One generator, and why

`FR-022` names three artifacts for this path. Phase 3A implements `portfolio_suggestions` only. `AID-08` makes generators independent and additive — *"artifacts added by registration"* — so `skill_gap_analysis` and `interview_guidance` are later registrations rather than modifications. One generator built properly beats three built thinly.

The other two are **planned-out with a reason**, not omitted silently. `DB §4.4` gives ARTIFACT_PLAN_ENTRY a mandatory `omission_reason` exactly so the reader can distinguish "chose not to" from "tried and failed", and an unimplemented generator is the former.

### Stage 9's key is the generator, not the stage

`STAGE_FRAGMENT_KEYS` maps `portfolio_suggestions` rather than `artifact_generation`, because the prompt is generator-specific and a shared key would give two generators one prompt. When a second generator lands, Stage 9 needs per-generator prompt resolution — a registration mechanism rather than a map entry. **Recorded as outstanding.**

### Persistence is deferred again

`DB §4.4` specifies `ARTIFACT` and `ARTIFACT_PLAN_ENTRY`; neither exists in `schema.prisma`. Adding them needs a migration, and — exactly as D-27 reasoned for `Recommendation` — **the local database holds the published prompt fragments the frozen regression baseline depends on**, so a `migrate dev` that detects drift can offer to reset it. The harness prints the plan and the artifact, and the trace store already retains both as structured stage output. That is sufficient for this slice and risks nothing. **Recorded as outstanding**, to be taken with the D-27 persistence decision rather than piecemeal.

### A deterministic stage is still traced

`AP-8`/`FR-100` require every stage to be reconstructible from its trace, and Stage 8 is a stage — it simply reaches no provider. `StageTrace` carries no model linkage (`DB §8.2`), so `recordDeterministicStage` writes the same row minus the invocation. Without it, the one stage whose output is pure policy would be the one stage nobody could audit.

---

---

## D-30 — The recording is the baseline, and only a person may promote one

**Decided. Four ratifications resolving `AI §12.3`'s open sub-question, `docs/11` A-4 and corpus README G-6.**

Taken 2026-09-06, before any capture is paid for. Sprint 1 remains frozen; Stages 1-3, 6-9 and the contracts fixed by D-27/D-28/D-29 are unchanged.

### What was decided

| # | Decision |
|---|---|
| 1 | **The recording store is the baseline.** No separate baseline artifact exists |
| 2 | **A capture does not become the baseline.** Promotion requires explicit, recorded human approval |
| 3 | **Capture is targeted** to the cases whose composition includes the changed fragment; coverage is computed offline and named in the pass reference |
| 4 | **Live regression runs monthly**, never per change |

### Why 1 follows from the documents

`AI §12.3` compares non-deterministic content "to baseline". In recorded mode that comparison is vacuous — the recording is both operands. It is meaningful only in live mode, where a fresh response is measured against a captured one. The recording is therefore already the baseline in everything but name, and `recording-store.ts` warns that a second format "would be a parallel mechanism that drifts".

### Why 2 is forced by 1

Making evidence and baseline the same object removes the ability to add evidence without moving the standard. Automatic promotion would let a capture overwrite the baseline that a flagged divergence was waiting to be measured against — `AI §12.3` requires such divergence be "flagged for human review, not auto-failed", and auto-refresh discharges the flag by deleting what it pointed at. Approval restores the separation that the single-artifact choice removed.

**Two states are now orthogonal.** A recording may be `stale` (the fragment changed, D-24 decision 2) or *unapproved* (captured but not promoted). They are different conditions with different remedies, and the runner must not conflate them.

### Why 3 satisfies D-24 rather than weakening it

D-24 decision 4 requires evidence that exercised the changed fragment — **not** evidence covering everything. Targeting is therefore the precise reading, provided coverage is proved rather than assumed. It is proved offline: `composePrompt` recomputes each case's composition with no provider call, so the covered set is known before any spend.

Blast radius is a property of the fragment class, not a quota:

| Changed fragment | Cases requiring capture |
|---|---|
| `foundation.*` | All — present in every composition |
| `stage.classification`, `stage.intent` | All — every case reaches stages 1-2 |
| `stage.context_extraction`, `stage.architecture_analysis` | All reaching those stages; excludes `unsupported`, which decline at Stage 1 |
| `type.*` | Only that type's cases |

Where a fragment appears in every composition the targeted set *is* the full corpus, and the cost is identical to capturing everything. The saving is real only where the blast radius is genuinely narrow.

### The suite version had no machine-readable home

`docs/11` §6.3 requires that regression results record the corpus version. They record the wrong one. `capture.ts` derives it as `cases[0].corpusVersion` — a case's **entry provenance** (§4.1), immutable and correctly `corpus-v1` for every case — while the suite stands at `corpus-v2` after D-26. The suite version existed only as prose in the corpus README.

| # | Decision |
|---|---|
| 5 | The suite version is held in **`research/golden-corpus/corpus.manifest.json`** |
| 6 | Runs and pass references carry `suiteVersion` as a **distinct field**, read from that manifest |
| 7 | Per-case `corpus_version` is **unchanged** — immutable entry provenance |
| 8 | Recording storage stays keyed on entry provenance: `research/regression-recordings/<corpus_version>/`. Storage semantics are untouched |
| 9 | The reference string names the suite version — `corpus-regression:corpus-v2+fragments-v1:<runId>` |

**Rewriting per-case `corpus_version` to v2 was rejected.** It would assert that cases entered at v2, which is false, and would strand the recording store, which partitions evidence by that field. The corpus README already forbids it.

**This costs nothing today.** No fragment version yet carries a `corpus-regression:` reference — the live gate value is still `fragment-manifest-gate:fragments-v1` (D-14). The window to change the reference format without migration closes the moment the first real reference is attached.

### What this does not decide

The three deferred assertion classes — `artifact_set`, `confidence_band`, `do_not_automate_conclusion` — are unaffected. They are deferred because Stage 9 generators, Stage 11 and a do-not-automate case do not yet exist, and no capture policy closes them.

Nothing here implements the decisions. Approval recording, targeted-capture selection, the suite-version field and the monthly schedule are Sprint 2 implementation work.

### Minimum authoritative amendments to ratify

`AI §12.3` (baseline mechanics block, and the property-table row D-24 already required), `docs/11` A-4 and §6.3, corpus README G-6, and the `corpus.manifest.json` suite-version file.

---

---

## D-31 — What the confidence model can decide without inventing a number

**Decided. Six ratifications resolving the prerequisites `AIQ-4` depends on. `AIQ-4` itself — the weights — remains open.**

Taken 2026-09-06. Every decision below is a reading of text already in the specifications; none introduces a numeric rule, and none required a provider call.

### Why the prerequisites are a separate decision

`AIQ-4` asks for factor weights. Weights are the **last** of three dependent choices: a weight produces a number, a threshold turns that number into a band, and both depend on which factors are measurable at all. Ratifying weights first would have forced invented thresholds — which `AI §4` forbids in terms (*"No proportional or numeric rule is defined, and none may be inferred"*) and `docs/11` forbids again for corpus expectations (*"would encode precision the specification does not define and no calibration data supports"*).

So this record settles what the documents already determine, and leaves for `AIQ-4` only the judgement that genuinely needs one.

### What was decided

| # | Decision |
|---|---|
| 1 | **An analysis producing no artifacts carries `low`.** The `docs/11` A-9 corpus convention is promoted to a rule |
| 2 | **Conflicts cap overall confidence at `medium`.** No severe-conflict-forces-`low` rule exists or is created |
| 3 | ~~**`sufficiency !== "sufficient"` triggers that same `medium` ceiling.**~~ **SUPERSEDED 2026-09-06 by D-33** — contradicted by four frozen corpus cases. Graded unknown materiality remains deferred |
| 4 | **CF-5 carries zero weight in Stage 11 v1**, because Stage 4 does not exist. Versioned, with re-weighting required when it does |
| 5 | **Per-recommendation adjustment is deferred.** Stage 11 v1 produces `ANALYSIS.overall_confidence_band` only |
| 6 | **Thresholds will be calibrated against the 44 frozen corpus band labels**, not chosen |

### 1 — `low` for no-artifact analyses

`docs/11` A-9 records the constraint and the convention together: *"No N/A value is to be invented and the `AI §8.4` vocabulary is not to be altered. Corpus convention: record `low`, on the basis that no confident recommendation exists."*

Both alternatives were already closed by that owner decision, and all three affected cases — `br-005` (`insufficient`), `un-001` and `un-002` (`unsupported`) — already carry `low`. Promoting the convention changes no data and invents no value; it makes the field writable by Stage 11 for paths that halt before reasoning.

### 2 — the cap is a ceiling, not a floor

`AI §8.4` states *"cannot exceed Medium"*; `AI §8.3`'s flow node reads `Capped: cannot exceed Medium`. Nothing anywhere forces `low`.

**CF-3's severity has no representation.** `AI §8.2` describes CF-3 as *"Count **and** severity of contradiction flags"*, but `ContextElement.conflictsWithIndex` is a bare index — the data model carries no severity field. Only count is available, and a severity scale is not being invented to fill the gap.

**A specification tension is recorded rather than resolved.** `AI §5.2` says a contradiction *"lowers confidence (§8)"* while `§8.4` says it caps. `§8.4` is the confidence authority and governs.

### 3 — sufficiency is the materiality signal that already exists

`AI §8.2` defines CF-7 as *"How central the unresolved unknowns are to the conclusion"*, and centrality is defined nowhere. What **is** defined is `AI §5.4`'s three-level sufficiency assessment, in which `thin` means *"Analysis possible but inference-heavy; analysis proceeds; **confidence reduced**"*.

That is the specification's own authored judgement that unknowns are material enough to matter. Using it as the cap trigger measures something the pipeline already produces, instead of manufacturing a materiality score. `insufficient` does not reach Stage 11 at all — it halts under `§5.4` and takes decision 1's `low`.

Presence and count of `unknown` elements remain available; **graded** materiality is deferred.

### 4 — a zero weight, stated rather than defaulted

CF-5 measures *"currency and completeness of the platform knowledge used"*, sourced from Stage 4, which is `implemented: false`. The factor has no source.

`AI §8.4` says *"Absence lowers, never raises"*, which admits two readings: weight CF-5 and apply a conservative floor, or weight it zero. **The floor is the worse choice here**, because it applies an identical penalty to every analysis, and thresholds fitted under that uniform penalty would bake a temporary build state into a calibrated constant — requiring refitting the moment Stage 4 lands.

Zero weight is therefore chosen **and versioned**: the weight set carries a version, and Stage 4's arrival requires re-weighting, not a silent adjustment. A specified factor is being ignored deliberately, which is why it is ratified here rather than defaulted in code.

### 5 — what Stage 11 v1 does not do

`AI §8.3` ends `BAND → PER[Per-recommendation adjustment by supporting evidence] → OUT`. *"By supporting evidence"* is the entire specification: no rule states what evidence supports a recommendation, nor how it moves a band. The link does not exist in the data model either — the closest analogue, `ArchitectureComponentDraft.groundedInContextIndices`, grounds *components*, not recommendations.

**Stage 11 v1 therefore produces the analysis-level band only, and does not satisfy `AI-021` or `AC-007`.** Both require confidence to vary across a single output set. That is a stated requirement left unmet, recorded here and in the register rather than quietly reinterpreted. No compliance with either is to be claimed.

### 6 — the thresholds are already latent in the corpus

Fitting rather than choosing is possible because the oracle exists. **42 of the 44 frozen cases carry human-authored, per-factor assessments in their rationales**, keyed to the `AI §8.2` vocabulary — `br-001` reads *"Confidence `high`. Assessed against the `AI §8.2` factors: — CF-1 input completeness: high…"*. Coverage by factor: CF-1 in 39 cases, CF-4 in 34, CF-2 in 20, CF-7 in 4, CF-3 in 3.

Against 44 frozen band labels (23 `high`, 15 `medium`, 6 `low`), thresholds can be **fitted and reported with their reproduction rate** instead of asserted. This is the calibration `AI §8.5` requires, and it costs nothing: the labels were authored by a human and are already committed.

**This does not license fitting the corpus to the system.** `AI §12.2` freezes the corpus precisely so it cannot drift to match output. The fit runs one way — thresholds are chosen to reproduce the labels, and a poor reproduction rate is evidence against the weighting, never grounds to edit a case.

### What remains open

`AIQ-4` — the weights themselves — and the band thresholds derived with them. CF-1's measurability is the remaining prerequisite, filed as its own decision.

### Minimum authoritative amendments to ratify

`docs/11` A-9; the `AIQ-4` row in `AI` §15; and the two register entries this record creates. The corpus README's A-9 mirror needs the same update and is **not** amended here.

---

---

## D-32 — Stage 11 v1 weights three factors, and says so

**Decided. CF-1 and CF-5 are excluded from the v1 weighted model, both versioned. The active base set is CF-2, CF-4 and CF-6.**

Taken 2026-09-06, following D-31. No code exists yet; this fixes what the code will be allowed to claim.

### What was decided

| # | Decision |
|---|---|
| 1 | **CF-1 weight = 0**, versioned. The per-type expected-context schema it is defined against does not exist |
| 2 | **CF-5 weight = 0**, versioned. Stage 4, its specified source, is not implemented |
| 3 | **The v1 weighted base set is CF-2, CF-4, CF-6** |
| 4 | **CF-3 and CF-7 remain caps**, per D-31: conflicts cap at `medium`; `sufficiency !== "sufficient"` triggers the same ceiling; no severe-conflict-forces-`low` rule |
| 5 | **Per-recommendation adjustment stays deferred** |
| 6 | **Stage 11 v1 must not be described as implementing the seven-factor framework.** The two excluded base factors and the deferred adjustment are documented wherever confidence is surfaced |
| 7 | **Both exclusions are reconsidered when their sources exist** — not silently absorbed |

### Why CF-1 could not be measured

`AI §8.2` defines CF-1 as *"Proportion of the type's **expected context schema** populated."* No such schema exists. `AI §4.2` asserts one — *"Stage 3 extracts against a type-appropriate schema"* — and illustrates it with three examples for `business_requirement` and three for `job_description`, in prose, in a vocabulary that is not `CONTEXT_CATEGORIES`. `FR-013` names four categories and qualifies them by no type at all. Two of the six categories, `system` and `objective`, appear in no requirement.

The per-type prompt fragments were the strongest candidate source and do not survive inspection: *"what tends to carry the decision on this path"* is hedged generation guidance, the four fragments do not share a structure, and mapping *"who will operate the result"* or *"seniority"* onto the six categories is a judgement no document makes.

**The corpus does not supply it either, and this is the decisive finding.** CF-1 is discussed in 39 of 44 rationales, but never against a category set. `ew-001` reads: *"CF-1 is moderate: step sequence and volumes are stated, but no retry configuration, error-handling settings, or deduplication logic is given — **and those are the details the reported failures turn on**."* Completeness was judged relative to what that specific input needed. Two `existing_workflow` cases would score differently on identical categories.

Authoring the table would therefore have been judgement presented as derivation — the move `AI §4` forbids: *"No proportional or numeric rule is defined, and none may be inferred."*

**And it would have been undetectable.** Fitting thresholds (D-31 decision 6) against an invented table would let the fit absorb the table's errors: a wrong table with compensating thresholds reproduces the corpus labels while measuring the wrong thing, and the corpus cannot catch it, because the corpus never assessed CF-1 categorically.

### Why the two exclusions are the same decision

CF-1 and CF-5 fail identically — a factor whose specified source does not exist. D-31 decision 4 already chose the treatment for that shape and gave the reason: a conservative floor applies the same penalty to every analysis, and thresholds fitted under a uniform penalty bake a temporary build state into a calibrated constant. Zero weight, versioned, is the honest form.

### What v1 rests on, and what that costs

The surviving factors are the ones the pipeline measures per element and validates:

| Factor | Source | Validation |
|---|---|---|
| CF-2 | `ContextElement.provenance` | `stated` spans verified against the input (D-19) |
| CF-4 | `ContextElement.specificityScore` | Range-checked `0..1` at parse |
| CF-6 | Pipeline `retryCount` | Stage regenerations; only Stage 6 is non-zero |

**Stated plainly: this is three of the five base factors `AI §8.2` names, and a materially thinner model than `AI §8` describes.** Two exclusions are recorded rather than fixed, and per-recommendation variation is absent. Anywhere Stage 11 v1 output is surfaced, exported or reviewed, it is labelled as the reduced v1 model — not as the confidence framework.

`AI §8.4`'s *"Factors are always exposed"* rule makes this workable rather than merely honest: anything below `high` already has to state its reason, and a reason drawn from three factors is visibly narrower than one drawn from five.

### What remains open

`AIQ-4` proper: the weights for CF-2, CF-4 and CF-6, and the thresholds mapping their combined value to `high` / `medium` / `low`. Filed as D-33, to be fitted against the 44 frozen band labels per D-31 decision 6.

### Minimum authoritative amendments to ratify

A note on the `AI §8.2` factor table recording the v1 active set; the `AIQ-4` row; and one register entry for CF-1's reconsideration trigger.

---

---

## D-33 — The corpus refuses the cap rule, and cannot yet supply the weights

**Decided. D-31 decision 3 is withdrawn, CF-6 joins the zero-weighted set, and `AIQ-4` is recorded as blocked rather than answered.**

Taken 2026-09-06, after computing the Stage 3 feature values from the existing recordings. No capture, no provider call, no spend.

### What the evidence showed

Feature values were computed offline from the 13 committed recordings and paired with the frozen bands:

| Case | Band | CF-2 stated ratio | CF-4 mean specificity | Conflicts | Sufficiency |
|---|---|---|---|---|---|
| br-001 | high | 0.73 | 0.708 | 0 | sufficient |
| br-003 | high | 0.63 | 0.676 | 0 | sufficient |
| br-006 | high | 0.82 | 0.763 | 0 | **thin** |
| br-007 | high | 0.68 | 0.577 | 0 | **thin** |
| br-009 | high | 0.67 | 0.683 | 0 | **thin** |
| br-011 | high | 0.61 | 0.714 | **1** | **thin** |
| br-002 | medium | 0.73 | 0.673 | 5 | thin |
| br-004 | medium | 0.36 | 0.368 | 0 | thin |
| br-008 | medium | 0.54 | 0.496 | 0 | thin |
| br-010 | medium | 0.56 | 0.406 | 0 | thin |

### 1 — D-31 decision 3 is withdrawn

Under it, `br-006`, `br-007`, `br-009` and `br-011` would be forced to `medium`. **All four are frozen as `high`.** A ceiling cannot be recovered by any weighting, so the rule is not merely mis-tuned — it is unsatisfiable against the oracle.

**The conflation it rested on.** `AI §5.4` gives `thin` the effect *"confidence **reduced**"*. `AI §8.4` reserves capping for *"material unknowns"*, which `FR-044` operationalises as *"unknowns **affecting the recommendation**"* and the corpus author states as *"no material unknown **blocks** a recommendation"* (`br-006`). Inference-heavy is not blocking. D-31 decision 3 treated the two as one.

**Option B was tested and failed.** No field in the data model represents materiality: `ContextElement` carries `provenance`, `resolutionHint` and `conflictsWithIndex`, none of which marks an unknown as affecting the recommendation, and the only occurrence of "material" in `contracts.ts` concerns Stage 1 mixed detection. `sufficiency` was the nearest candidate and is the one the evidence rejects.

**Therefore Option A.** `sufficiency` is removed as a cap trigger, and **CF-7 has no computable trigger until materiality is explicitly represented.** No numerical materiality score is invented to fill the gap.

**What is preserved:** CF-3 remains a cap, not a weighted term. CF-7 remains a material-unknown cap in specification, now with its trigger recorded as unimplementable. The `medium` ceiling is unchanged, and no severe-conflict-forces-`low` rule exists. `insufficient` is untouched — it halts at Stage 3 under `AI §5.4` and takes `low` from D-31 decision 1, which is a separate mechanism from the CF-7 cap and survives this correction intact.

**A second defect, recorded not fixed.** `br-011` carries a model-emitted conflict flag while its author records the constraints as *"restrictive but mutually consistent"*. That is a Stage 3 false positive, which makes the CF-3 cap only as precise as Stage 3's conflict detection.

### 2 — CF-6 is zero-weighted and versioned

CF-6 is mentioned in **0 of 44** rationales, and principledly so: it measures *"agreement across stages; regeneration count; validation retries"* — runtime properties of an execution. Corpus expectations are authored from inputs, so CF-6 is structurally un-assessable there, and it is absent from recordings because it is a pipeline counter rather than provider output.

A separately defined runtime rule was considered and rejected as new architecture with no evidence behind it. **Zero weight, versioned**, is the treatment D-31 decision 4 and D-32 already established for a factor whose measurement source is unavailable, and consistency costs nothing here.

**The v1 weighted base set is therefore CF-2 and CF-4 only** — two of the five base factors `AI §8.2` names.

### 3 — `AIQ-4` is blocked, not answered

**Weights and thresholds cannot currently be responsibly calibrated.** The reasons are evidentiary, not a matter of effort:

| # | Finding |
|---|---|
| 1 | **Only 11 of 44 cases have computed Stage 3 features.** Band labels cover all 44; the computable inputs cover only what was recorded |
| 2 | **Only 10 of those are useful for base-band calibration.** `br-005` is `insufficient` and takes `low` from D-31 decision 1 without reaching the weighted model |
| 3 | **There are no computed `low`-band examples.** The 10 are 6 `high` and 4 `medium`, so the `medium`/`low` threshold has no data at all |
| 4 | **The evidence is insufficient to fit a defensible model.** Two free weights plus two thresholds is four parameters against 10 points spanning two classes — overfitting by construction, not calibration |
| 5 | **The rationale grades are not a scale.** Free prose — *"high"*, *"strong"*, *"weakened"*, *"moderate"*, *"mixed"* — and they assess the **input**, whereas CF-2 and CF-4 are computed from Stage 3's **output**. No recorded mapping between the two exists |
| 6 | **Closing the gap requires Stage 3 output for the remaining 33 cases**, which requires provider execution and capture |
| 7 | **That execution is explicitly prohibited by the project's zero-spend constraint.** It is a budget decision, not an engineering one |

**What the data suggests, and why it is not enough.** Excluding `br-002` — genuinely capped, two irreconcilable contradiction pairs — the nine remaining cases separate on CF-4 alone: `high` spans 0.577–0.763, `medium` spans 0.368–0.496, with an empty interval of 0.081 between them. That locates a boundary only to a range, on nine points, from one of five verticals, with no `low` examples, and it would let CF-4 carry the model alone — making CF-2's weight arbitrary rather than fitted. **No threshold is adopted from it.**

`AIQ-4` remains **open**. No weights and no thresholds are ratified here.

### Consequence for Stage 11

With CF-7's cap trigger withdrawn and the weighted base uncalibrated, **Stage 11 cannot be responsibly implemented under the zero-spend constraint.** The only defensible partial form would emit a band solely where a CF-3 cap or D-31 decision 1 determines it, leaving every other case explicitly undetermined — a partial stage that would need its own ratification. It is not undertaken here.

### Minimum authoritative amendments to ratify

The `AI §8.2` v1 note (base set now CF-2 and CF-4); the `AIQ-4` row; and the register entries this record creates.

---

---

## D-34 — Depth has one level because nothing supports a second

**Decided. `depth_level` is single-valued (`"standard"`) for v1. Resolves `AIQ-7`.**

Taken 2026-09-06. Derived entirely from committed specifications; no provider call, no spend.

### What was decided

| # | Decision |
|---|---|
| 1 | **`depth_level` remains single-valued as `"standard"` for v1** |
| 2 | **No additional depth levels, names or complexity cut points are invented** |
| 3 | **`AC-037` proportionality is tested by the mechanism `DB §4.4` already specifies** — artifact-set size against complexity score across the corpus |
| 4 | **One level is not declared universally correct.** It is the v1 domain because the repository supplies no evidence for a deeper taxonomy |
| 5 | **Reconsideration trigger:** revisit granularity once complexity scoring exists and enough measured evidence accumulates to show whether multiple levels are warranted |
| 6 | **Resolving `AIQ-7` does not make `AC-037` measurable today.** Complexity scoring is unimplemented |
| 7 | **The existing `depthLevel: "standard"` contract is preserved**, not widened |

### Why the question's own premise was already answered elsewhere

`AIQ-7` is constrained by *"Must make `AC-037` proportionality testable"*. `DB §4.4`'s design note states the test mechanism outright:

> *"It also makes `AC-037` proportionality testable by query: **artifact-set size against complexity score** across the corpus."*

That is not a depth-level enumeration. Three further sources agree that proportionality is carried by the artifact set:

| Source | Statement |
|---|---|
| `FR-017` acceptance criteria | *"A minimal input produces a proportionally minimal **artifact set**"* |
| `docs/11` §2.3 | `minimal` means *"satisfiable by a single primary artifact, with no downstream solution architecture or implementation design"* |
| `docs/11` §2.2 | `minimal` cases *"exercise proportionality (`FR-017`, `AC-037`)"* — a corpus character, measured by what is produced |

So the granularity question was load-bearing for a test that a different mechanism already discharges.

### Why a taxonomy would have been invention

No document in the repository names a depth level, counts them, or gives a boundary. Constructing them would require choosing a count and cut points on `docs/09`'s 20–100 complexity scale with nothing to cite — the move `AI §4` forbids in terms (*"No proportional or numeric rule is defined, and none may be inferred"*) and the one D-33 refused for `AIQ-4`'s thresholds.

`docs/09` §4 A-2 sets the precedent one level down: *"Factor anchor descriptors are drafted, not derived from an authoritative source… Requires owner review."* An un-derived depth taxonomy is the same defect. And `docs/09` A-3 records that *"No calibration data exists yet"*, so there is nothing to place boundaries against even if one wanted to.

### Three things this record keeps separate

| Concept | What it is | State |
|---|---|---|
| **Depth-level granularity** | The domain of `depth_level` | **Resolved here** — single-valued for v1 |
| **Artifact-set proportionality** | Which artifacts are planned and why (`FR-017`, `ARTIFACT_PLAN_ENTRY`) | Implemented for the job-description path at Stage 8 |
| **Complexity scoring** | `docs/09` `complexity-v1`, `FR-033`, `COMPLEXITY_ASSESSMENT` | **Unimplemented** |

**`AC-037` is now specifiable, not measurable.** Its query needs complexity scores, and none are produced: `ARTIFACT_TYPES` holds only the three job-description artifacts and `FR-033` is unbuilt. Claiming AC-037 satisfaction on the strength of this record would be false.

### What this does not resolve

Stage 5's *complexity pre-assessment* output. `AI` App. A classifies Stage 5 as **Deterministic**, while `docs/09` line 22 says it *"does not specify how the NIE arrives at a factor score, which is **reasoning work**"* and §1.6 says *"Determinism of the factor scores themselves is a property of the **reasoning stage**"*. A deterministic Stage 5 cannot produce a complexity pre-assessment unless "pre-assessment" means something coarser than `COMPLEXITY_ASSESSMENT`, and no document says what that is. **Recorded as a separate open blocker; not resolved by invention here.**

### Minimum authoritative amendments to ratify

The `AIQ-7` row and the Stage 5 spec in `AI`; the `depth_level` domain in `DB §4.4`; Roadmap Appendix C item 9; and the two register entries this record creates.

---

---

## D-35 — Two different complexity questions were being treated as one

**Decided. `docs/09` governs the Stage 9 `COMPLEXITY_ASSESSMENT` artifact only. Stage 5's complexity pre-assessment is deferred, undefined. Stage 5 ships reduced.**

Taken 2026-09-06, resolving the conflict D-34 recorded. Derived from committed specifications; no provider call, no spend.

### What was decided

| # | Decision |
|---|---|
| 1 | **`docs/09` governs `COMPLEXITY_ASSESSMENT` only** — the `FR-033` artifact, `complexity-v1`, written at Stage 9 |
| 2 | **Stage 5's pre-assessment is a different quantity** and is not governed by `docs/09` |
| 3 | **Stage 5 stays Deterministic.** Planning, required-analysis selection and depth selection are deterministic operations |
| 4 | **The pre-assessment is deferred, undefined for v1.** No scale, entity, vocabulary, persistence model or score is invented |
| 5 | **Stage 5 v1 emits required analyses and `depth_level: "standard"`.** The third specified output is deferred — this is a **reduced** stage and is labelled as one |
| 6 | **The Stage 8 input-ordering contradiction is recorded, not resolved** |

### Why they are different quantities

`COMPLEXITY_ASSESSMENT` cannot be what Stage 5 produces, on the specifications' own terms:

| Property | `COMPLEXITY_ASSESSMENT` | Stage 5 |
|---|---|---|
| Producer | Stage 9 — `DB §4.3` lifecycle: *"Written during artifact generation"* | Stage 5 |
| Dependency | `FR-033` **depends on `FR-030`** — the Stage 6 architecture | Runs before Stage 6 |
| Representation | `score`, `factor_breakdown`, `scale_version` | None defined anywhere |

A stage cannot produce an artifact that depends on output from a later stage. Reading the two as one quantity is what generated the conflict.

### Why determinism survives

`docs/09` is narrower than it was being read. Line 22: *"It defines scales only. **It does not specify how the NIE arrives at a factor score, which is reasoning work belonging to `AI Architecture`**."* §1.6: *"Determinism of the factor scores themselves is a property of the reasoning stage."*

`AI §3` line 178 then draws the line explicitly:

> *"Artifact planning, stage sequencing, validation, confidence computation, and **depth selection** are deterministic (`TC-006`). Classification, extraction, reasoning, and generation involve the model."*

Depth selection and planning are named deterministic; complexity scoring is not in that list. `AI` had already separated them. Stage 5's classification stands unchanged, and no reclassification is made.

### What Stage 5 v1 does not do

The pre-assessment has no definition to implement. Defining one would mean inventing a scale and a vocabulary against no source — the move refused at D-33 for `AIQ-4`'s thresholds and at D-34 for depth levels.

**Stage 5 v1 is therefore a reduced stage: two of its three specified outputs.** It is labelled as such wherever it is surfaced, on the same footing as Stage 11's reduced factor set (D-32) and Stage 9's single generator (D-29). No claim of full `FR-017` satisfaction is made.

### The contradiction this does not resolve

`AI §5` Stage 8's input is *"Classification + intent + **complexity assessment** + reasoning plan"* — naming complexity assessment as an input distinct from the reasoning plan. But `DB §4.3` writes `COMPLEXITY_ASSESSMENT` at **Stage 9**, after Stage 8 has run.

Either Stage 8 consumes something other than that entity, or the lifecycle is wrong. **Both readings are plausible and neither is adopted here.** Resolving it by assumption would settle a specification question with an implementation convenience. It is filed as an open item.

It costs nothing today: the implemented Stage 8 consumes no complexity input.

### Minimum authoritative amendments to ratify

The Stage 5 spec note in `AI §5`; and the two register entries this record creates. **`docs/09` is not amended** — it continues to govern `complexity-v1` and `COMPLEXITY_ASSESSMENT`, which is precisely the point.

---

---

## D-36 — Stage 8 cannot consume the artifact it decides whether to produce

**Decided. `AI §5` Stage 8's "complexity assessment" input is the Stage 5 **pre**-assessment. `COMPLEXITY_ASSESSMENT` remains the Stage 9 artifact. Closes the ordering contradiction D-35 left open.**

Taken 2026-09-06. Reached by elimination on the specifications' own terms; nothing is invented and no lifecycle changes.

### What was decided

| # | Decision |
|---|---|
| 1 | **`AI §5` Stage 8's "complexity assessment" denotes the Stage 5 complexity pre-assessment**, not the persisted artifact |
| 2 | **`COMPLEXITY_ASSESSMENT` remains the persisted Complexity Score artifact, produced at Stage 9** |
| 3 | **`DB §4.3`'s lifecycle and `FR-033` → `FR-030` are unchanged.** Neither was in error |
| 4 | **Stage 8 must never consume the Stage 9 artifact it decides whether to produce** |
| 5 | **This defines nothing.** The Stage 5 pre-assessment stays deferred and undefined per D-35, and `FR-017`'s assessed-complexity requirement stays unsatisfied |
| 6 | **A separate gap is recorded:** `docs/09` delegates factor-score derivation to "a reasoning stage" without naming which |

### Why the artifact reading is impossible, not merely awkward

`AI §9.1`'s artifact catalogue lists **Complexity Score** — *"Score with itemized factors and weights | Requirement, workflow"* — as an artifact. `AI §5` Stage 9's purpose is *"Produce each planned artifact"*. `DB §4.3` persists it there. `FR-033` depends on `FR-030`, satisfied because Stage 6 precedes Stage 9. **Four sources agree**, and `DB §4.3` is not the outlier.

Stage 8's purpose is *"Decide which artifacts to produce"*, and `ARTIFACT_PLAN_ENTRY` carries `planned` with an `omission_reason` for each type in the catalogue — Complexity Score included on the requirement path. So Stage 8 decides whether that artifact exists at all.

**A stage cannot take as input the output of a decision it is itself making.** The reading fails on circularity, not on ordering, and no interpretation rescues it.

### Why the pre-assessment reading is what remains

Both terms already exist in `AI §5`, one stage spec apart. `FR-017` independently requires orchestration *"based on classification, intent, and assessed complexity"*, so Stage 8 genuinely needs something complexity-shaped, and Stage 5 is the only producer of anything of that shape before it. `SA §12`'s lifecycle table gives Stage 8's input as *"All prior"* — an enumeration of what exists at that point, consistent with reading Stage 8's list as naming available inputs rather than asserting a new dependency.

The alternatives were: amend `DB §4.3` (contradicts three sources to save one), or posit a third complexity quantity (nothing in the repository names one). This record adopts neither.

### The wording defect this exposes

`AI §5` Stage 5's output reads *"Reasoning plan: required analyses, depth level, complexity pre-assessment"* — the colon makes the pre-assessment a **component of** the reasoning plan. Stage 8's input line lists *"complexity assessment + reasoning plan"* as siblings, naming a part alongside its whole under a different name.

That is an editorial defect inside one section, and it is why the phrase read as a different object. `AI §5` Stage 8's input line is amended to name the pre-assessment plainly. **Editorial only** — no field, score, scale, entity or lifecycle semantics is added.

### What this does not do

**It resolves the contradiction and leaves the gap.** Stage 8's complexity input is now correctly identified as a quantity that does not yet exist: D-35 deferred the pre-assessment as undefined, and this record does not define it.

So `FR-017`'s assessed-complexity requirement remains **unsatisfied**, and Stage 8 v1 legitimately consumes no complexity — which is what the implemented Stage 8 does. The job-description path names no complexity artifact (`FR-022`); the requirement path does (`FR-020`), and Stage 8 does not yet serve it.

### The gap this record opens

`docs/09` line 22 says it *"does not specify how the NIE arrives at a factor score, **which is reasoning work** belonging to `AI Architecture`"*, and §1.6 attributes factor-score determinism to *"the reasoning stage"* — **without naming which stage performs it.** `AI §9.1` places the Complexity Score artifact at Stage 9, whose input includes the architecture, which is consistent; but no document states where the five factor scores are produced. Recorded, not resolved.

### Minimum authoritative amendment to ratify

The `AI §5` Stage 8 input line, and the register updates this record makes. **`docs/09` is not amended.** `DB §4.3` is not amended — decision 3 confirms it.

---

---

## Summary

| ID | Status | Resolves |
|---|---|---|
| D-1 | ✅ Decided — JSON Schema 2020-12 | Provider README deferral #1 |
| D-2 | ✅ Decided — PostgreSQL, separate database | `SA AQ-1`, `DBQ-1` |
| D-3 | ✅ Decided — repository-authored, database-published | `SA AQ-5`, `DBQ-5` |
| D-4 | ✅ Decided — neutral data rows; USD; ordinal tier | Provider README deferrals #2, #3, #7 (partial) |
| D-5 | ⏸️ Deferred with rationale | `DBQ-8` |
| D-6 | ✅ Interpretation decided; discrepancy recorded | New `AIQ-9` |
| D-7 | 📌 Recorded only; twelve stages for implementation | New `AIQ-10` |
| D-8 | ✅ Implemented with `recorded_at`; amendment identified | New `DBQ-10` |
| D-9 | ✅ Implemented as identifier reference; amendment identified | New `DBQ-11` |
| D-10 | 📌 Recorded — 5 provisional values, marked unratified in code | Provider README deferrals #3, #5 (partial) |
| D-11 | ✅ Decided — an offline second implementation satisfies `AI-005` | Boundary check 8 now enforcing |
| D-12 | ✅ Implemented — `instructions` added to the capability request | Unblocks `AI §6.1` composition |
| D-13 | 📌 Recorded — sufficiency is reported, not computed; persisted by D-22 | Boundary checks 2, 5, 6 now enforcing |
| D-14 | ✅ Decided — manifest change gate satisfies `NFR-043` for Sprint 1 | **Boundary check 7 now enforcing — all eight active** |
| D-15 | 📌 Recorded — Stage 6 runs without Stages 4-5 | Unblocks Stage 6 in Sprint 1 |
| D-16 | ✅ `AI §3.2` implemented; contradiction recorded | Stage 6 single regeneration |
| D-17 | ✅ Decided — CLI harness, replay-backed | `Roadmap` Sprint 1 Interface deliverable |
| D-18 | ✅ Decided — env credential, configured rates, honest declaration | Real adapter (`AI §10.5`) |
| D-19 | ✅ Implemented — Stage 3 verifies a quote, derives the span | First real-run failure; strengthens `AIP-3` |
| D-20 | ✅ Implemented — failed stages retain the raw response | `DB §8.2`, `FR-100` |
| D-21 | ✅ Implemented — one transaction per stage, committed as it completes | `DB §6.2`, `FR-091` |
| D-22 | ✅ Implemented — `ANALYSIS.sufficiency_level` written in Stage 3's transaction | Completes D-13; `DB §4.2` |
| D-23 | ✅ Implemented and verified against PostgreSQL — `PROVIDER_INVOCATION` persisted per attempt | Closes D-20's outstanding item; `DB §4.7`, `FR-093`, `NFR-083` |
| D-24 | ✅ Decided — recorded mode is a compatibility gate; activation needs fragment-exercising evidence | `AI §12.3` contradiction recorded; sharpens D-14 and D-17 |
| D-25 | ✅ Decided — purpose-primary classification; dominance follows the ask; ambiguity falls below threshold | **Resolves `AIQ-9`**; amends `AI §3.2`, `§4.1`, `§4.3` and `FR-011` |
| D-26 | ✅ Decided — `br-008` confidence bound changed under `docs/11` §6.2; suite → `corpus-v2` | Justified by D-25, not by output; `corpus_version` confirmed an entry marker |
| D-27 | ✅ Decided — capability profile is an authored primitive; Stage 7 decides apply-vs-build | Opens Phase 2; `FR-022` never said *gap against what* |
| D-28 | ✅ Decided — requirement `kind`; exhaustive disposition; buildable decisive gaps | Stage 7 defects from the first real run |
| D-29 | ✅ Decided — deterministic Stage 8; one Stage 9 generator; decisive technical gaps only | Phase 3A portfolio suggestions |
| D-30 | ✅ Decided — recording is the baseline; approval-gated promotion; targeted capture; monthly live; suite version separated from entry provenance | Resolves `AI §12.3` sub-question, `docs/11` A-4, corpus README G-6 |
| D-31 | ✅ Decided — no-artifact `low`; conflicts cap at `medium`; sufficiency triggers the cap; CF-5 zero-weighted and versioned; per-recommendation deferred; thresholds fitted to the frozen corpus | Resolves `docs/11` A-9; unblocks `AIQ-4`'s prerequisites. **`AIQ-4` itself remains open** |
| D-32 | ✅ Decided — CF-1 and CF-5 excluded from the v1 weighted model, both versioned; active base set is CF-2, CF-4, CF-6; v1 is not the seven-factor framework and must not be described as it | Resolves CF-1 measurability. **`AIQ-4` weights and thresholds remain open — filed as D-33** |
| D-33 | ✅ Decided — **withdraws D-31 decision 3** (sufficiency is not a cap trigger); CF-7's cap has no computable trigger until materiality is represented; CF-6 zero-weighted and versioned, leaving CF-2 and CF-4; `AIQ-4` recorded as **blocked** by the zero-spend constraint | Corrects D-31. **`AIQ-4` remains open — no weights or thresholds ratified** |
| D-34 | ✅ Decided — `depth_level` single-valued (`"standard"`) for v1; no invented levels or cut points; `AC-037` tested by artifact-set size against complexity score per `DB §4.4` | Resolves `AIQ-7`. **`AC-037` is specifiable, not yet measurable** |
| D-35 | ✅ Decided — `docs/09` governs `COMPLEXITY_ASSESSMENT` only; Stage 5's pre-assessment is a distinct, deferred quantity; Stage 5 stays Deterministic and ships **reduced** (required analyses + `depth_level`) | Resolves the D-34 determinism conflict. ~~Stage 8 input-ordering contradiction left open~~ — **closed by D-36** |
| D-36 | ✅ Decided — Stage 8's "complexity assessment" is the Stage 5 **pre**-assessment; `COMPLEXITY_ASSESSMENT` stays the Stage 9 artifact; `DB §4.3` and `FR-033` → `FR-030` unchanged; Stage 8 never consumes the artifact it plans | Closes D-35's open contradiction. **Defines nothing; `FR-017` still unsatisfied.** Opens the factor-scoring-stage gap |

### Still open after this record

| Item | Due |
|---|---|
| `AIQ-6` / `AQ-4` — stage-level routing as configuration | Sprint 2 |
| ~~`AIQ-9` — classification taxonomy: `AI §4.1` six vs `FR-011` five~~ | ✅ **Resolved 2026-08-14 — D-25** |
| ~~**D-25 rules are ratified but not implemented** — `prompts/stage/classification.md` still predates them~~ | ✅ **Resolved 2026-08-14, verified 2026-09-06 — D-25 is implemented in `prompts/stage/classification.md`:** purpose-primary classification, non-counting dominance, and the conjunctive sub-threshold trigger. The fragment has **not** been exercised by a paid capture; that is the re-baseline item below, not this one |
| ~~`br-008` remains a recorded regression failure pending that implementation (D-25)~~ | ✅ **Resolved 2026-08-14 — D-25 corrected the classification; D-26 corrected the confidence expectation** |
| **The recording store keys evidence on `corpus_version`**, which `docs/11` §4.1 defines as an entry marker — and reads it inconsistently (per-case for lookup, `cases[0]` for the gate) (D-26). **Verified 2026-09-06: this has already drifted, without waiting for a case addition.** The suite is `corpus-v2` (`research/golden-corpus/README.md`), while the only recorded run is keyed `corpus-v1` — `reference: corpus-regression:corpus-v1+fragments-v1:4ea7eef7345389e9`. The run takes its version from per-case entry markers, not the suite version. ~~**Specification resolved 2026-09-06 by D-30**~~ | ✅ **Closed 2026-09-06 — specified by D-30 and implemented.** `loadSuiteVersion()` reads `research/golden-corpus/corpus.manifest.json`; `RegressionReport.suiteVersion` and `RegressionPassReference.suiteVersion` carry it; the reference string now reads `corpus-regression:corpus-v2+fragments-v1:<runId>`. The `cases[0].corpusVersion` derivation is gone from the suite-version path. Per-case `corpus_version` and the recording storage partition are unchanged. Covered by `regression-corpus.test.ts` (manifest loading and rejection) and `regression-runner.test.ts` (reference names the suite version while the case keeps its entry marker) |
| `ta-004` may need the same adjudication as `br-008`: it states an ask, but the ask is itself ambiguous (D-26) | With the `technical_assessment` vertical |
| ~~12 of 13 recordings are stale from the D-25 fragment publication; a full green suite needs a re-baseline (~$0.95)~~ | ✅ **Corrected 2026-09-06 — the premise was false.** All 14 authored fragments hash-match the published manifest, `stage.classification` (`fb90828b`) included, and all 13 recordings carry `fragments-v1` with the three composition hashes the green run records. The runner reports `stale` before a case can pass; the run passed 13/13, so none were stale. D-26 was taken *"after the first capture under D-25"* — the recapture happened 2026-08-14 and this entry was never updated. **No re-baseline of the existing 13 is needed.** The real gap is the 31 unrecorded cases, at a cost that is not $0.95 |
| `AIQ-10` — stage count: `MVP` six vs `AI`/`Roadmap` twelve | Reconcile before Sprint 2 |
| `DBQ-8` — app-level encryption scope | Before production data |
| `DBQ-9` — partition granularity | Sprint 5 |
| `DBQ-10` — ratify `recorded_at` on the two 30-day trace entities (D-8) | Before Sprint 2 |
| `DBQ-11` — ratify `stage_trace_id` as an identifier reference (D-9) | Before Sprint 2 |
| **D-10 items 1-3** — ratify retry bounds and jitter distribution in `SA §11.3` | Before Sprint 2 |
| **D-10 item 4** — classify an unclassified adapter failure in `AI §10.4` | Before Sprint 2 |
| **D-10 item 5** — ratify environment-configured rates, or move them to `DB §4.5` | Before production |
| `AIQ-6` follow-on — retype `costLatencyTier` as the D-4 ordinal | With Sprint 2 routing |
| **`AI §10.5` step 4** — run the full regression suite against both adapters (D-11) | Sprint 2, with the regression runner |
| **D-12** — add the composed-instruction dimension to `AI §10.2` | Before Sprint 2 |
| **D-13** — define the `AI §5.4` sufficiency rule, or state it is a judgement | Before Sprint 2 |
| **D-14** — separate the two `NFR-043` guarantees, or scope the change gate | Before Sprint 2 |
| **D-16** — carve Stage 6 regeneration out of `SA §11.3`, or drop it from `AI §3.2` | Before Sprint 2 |
| `AI §3.2` Stage 6 input list assumes Stages 4-5 exist (D-15) | With Sprint 2 stages 4-5 |
| Golden-corpus output regression, replacing `fragment-manifest-gate` references | Sprint 2 — infrastructure built; **awaiting paid capture** (D-24) |
| `AI §12.3` property table claims recorded mode detects fragment regressions; it cannot (D-24) | Before the first fragment activation |
| ~~No recordings captured yet, so no corpus run has ever executed (D-24)~~ | ✅ **Superseded, verified 2026-09-06.** 13 recordings exist (`research/regression-recordings/corpus-v1/`, `br-001`–`br-011`, `un-001`, `un-002`, plus manifest) and one run has executed (`research/regression-runs/4ea7eef7345389e9.json`, 13 cases). The run is `mode: recorded`, and its own `attests` field states this is **not** evidence that the current prompts produce these responses. The live-capture gap remains open above as the re-baseline item |
| ~~CI has no Postgres service, so the real-infrastructure tests skip there~~ | ✅ **Resolved, verified 2026-09-06** — `.github/workflows/ci.yml` provisions a `postgres:17` service with both `DATABASE_URL` and `TRACE_DATABASE_URL`, creating the separate trace database (`bd47217`) |
| `ANALYSIS.overall_confidence_band` is never written — it is **written at Stage 11** (`DB §4.2`, `§6.1`), which Sprint 1 does not implement (D-22) | Sprint 2, with Stage 11 |
| `VALIDATION_EVENT` is never written (D-23). **Still true as of 2026-09-06** — the only references outside generated code are retention constants and a `deleteMany`; no create path exists. **The recorded reason is now wrong:** Stage 9 *is* implemented (`portfolio-suggestions.ts`) and writes none, and the trace schema attributes validation classes to `AI §3.2` **Stage 10** (`response_validation`), which is unimplemented. The Stage 9 vs Stage 10 attribution needs adjudication before this can be scheduled | Sprint 2 — **blocked on that adjudication** |
| No boundary check covers provider-invocation recorder wiring; the orchestrator must wire it too (D-23) | With `SA §3.4` job lifecycle |
| `docs/11` A-9 — confidence band for analyses producing no artifacts | **Becomes live in Sprint 1** with stage 1 `unsupported` and stage 3 insufficiency |
| Provider README deferrals #4 (task vocabulary), #5 (degradation vocabulary), #6 (determinism scale) | With the NIE stage work |
| **Persistence for Stages 7–9 is not implemented** — deferred at D-27 (*"the one thing not delivered"*) and again at D-29 (*"Persistence is deferred again"*). Recorded in both decision bodies but never registered here until 2026-09-06 | Sprint 2 |
| **Stage 9 fragment resolution is per-generator, not per-stage.** The single `portfolio_suggestions` stage key is the generator's key, because a shared `artifact_generation` key would give two generators one prompt (`stages.ts`, citing D-29). Must become per-generator resolution when a second generator lands | With the second Stage 9 generator |
| **Stage 11 v1 will not satisfy `AI-021` or `AC-007`.** Both require confidence to vary across a single output set; `AI §8.3`'s per-recommendation adjustment is specified only as *"by supporting evidence"*, and no recommendation→evidence link exists in the data model (D-31 decision 5). Stage 11 v1 produces the analysis-level band only. **No compliance with either requirement is to be claimed** | With per-recommendation confidence |
| ~~**Stage 5's determinism conflicts with `docs/09`** (D-34)~~ | ✅ **Resolved 2026-09-06 — D-35.** The two were different quantities: `docs/09` governs the Stage 9 `COMPLEXITY_ASSESSMENT` artifact, which `FR-033` makes dependent on Stage 6 output and `DB §4.3` writes at Stage 9 — so Stage 5 cannot be producing it. `AI §3`:178 already names depth selection and planning as the deterministic operations. Stage 5's classification is unchanged |
| **Stage 5's complexity pre-assessment is deferred, undefined** (D-35 decision 4). No scale, entity, vocabulary or persistence model exists for it, and none was invented. **Stage 5 v1 is a reduced stage** — two of its three specified outputs — and must not be described as satisfying `FR-017` in full | With a defined pre-assessment |
| ~~**`AI §5` and `DB §4.3` disagree on when the complexity assessment exists** (D-35 decision 6)~~ | ✅ **Resolved 2026-09-06 — D-36.** Stage 8's input is the Stage 5 **pre**-assessment; `COMPLEXITY_ASSESSMENT` remains the Stage 9 artifact and `DB §4.3` was not in error. The artifact reading is circular, not merely mis-ordered: `AI §9.1` lists Complexity Score as an artifact, and Stage 8 decides whether artifacts are produced. `AI §5` Stage 8's input line amended editorially |
| **`docs/09` does not say which stage scores the complexity factors** (D-36 decision 6). Line 22 calls factor scoring *"reasoning work belonging to `AI Architecture`"* and §1.6 attributes its determinism to *"the reasoning stage"*, but no document names that stage. `AI §9.1` places the Complexity Score artifact at Stage 9, which is consistent but does not identify where the five factor scores are produced | Before complexity scoring |
| **`FR-017`'s assessed-complexity requirement is unsatisfied** (D-36 decision 5). Stage 8's complexity input is now correctly identified as the Stage 5 pre-assessment — a quantity D-35 deferred and left undefined. Stage 8 v1 consumes no complexity, which is correct for the job-description path (`FR-022` names no complexity artifact) and insufficient for the requirement path (`FR-020` does) | With a defined pre-assessment |
| **`depth_level` is single-valued because nothing supports more** (D-34 decision 4), not because one level is correct. Revisit once complexity scoring exists and measured evidence can show whether multiple levels are warranted | With complexity scoring |
| **`AC-037` is specifiable but not measurable** (D-34 decision 6). Its `DB §4.4` query needs complexity scores; `FR-033` and `COMPLEXITY_ASSESSMENT` are unimplemented and `ARTIFACT_TYPES` holds only the three job-description artifacts. **No `AC-037` satisfaction may be claimed** | With complexity scoring |
| **`AIQ-4` is blocked by the zero-spend constraint, not by engineering** (D-33). Weights and thresholds cannot be calibrated: computed Stage 3 features exist for 11 of 44 cases, 10 are usable, **none is a `low`-band example**, and four parameters against 10 points spanning two classes is overfitting. Closing it requires Stage 3 output for the remaining 33 cases — provider execution and capture, currently prohibited. **Stage 11 cannot be responsibly implemented until this is resolved** | Budget decision |
| **CF-7's cap has no computable trigger** (D-33). `sufficiency` was withdrawn as the trigger after four frozen cases (`br-006`, `br-007`, `br-009`, `br-011`) proved `thin` compatible with `high`. No field represents an unknown that *blocks a recommendation* (`FR-044`). Either add a materiality representation or record that CF-7 is specification-only | Before Stage 11 |
| **CF-3's cap is only as precise as Stage 3's conflict detection** (D-33). `br-011` carries a model-emitted conflict flag while its author records the constraints as mutually consistent — a false positive that would wrongly cap a `high` case | With conflict-detection review |
| **CF-6 is zero-weighted because it is a runtime property with no corpus signal** (D-33) — 0 of 44 rationales, absent from recordings. The v1 weighted base is CF-2 and CF-4 alone | With a runtime evidence source |
| **CF-1 is zero-weighted only because its expected-context schema does not exist** (D-32 decision 1). `AI §8.2` defines it against *"the type's expected context schema"*; `AI §4.2` asserts one exists but illustrates it in prose outside the `CONTEXT_CATEGORIES` vocabulary, and no requirement enumerates it per type. Authoring that table as a specification amendment — each non-floor category cited to a requirement — is what would reinstate the factor | With a per-type context schema |
| **CF-5 is zero-weighted only because Stage 4 does not exist** (D-31 decision 4). The weight set is versioned; Stage 4's arrival requires deliberate re-weighting and threshold refitting, not a silent adjustment | With Stage 4 |
| **CF-3 severity has no representation.** `AI §8.2` describes CF-3 as *"count **and** severity"*, but `ContextElement.conflictsWithIndex` is a bare index — only count is available. Either add a severity field or amend `§8.2` to claim count alone | Before graded conflict handling |
| **31 of 44 corpus cases have no recordings.** Only `business_requirement` (11) and `unsupported` (2) are recorded; `job_description`, `existing_workflow` and `technical_assessment` have none. Broader than the re-baseline item, which concerns staleness of the 13 that exist | With the capture spend decision |

Deferral #4 is now largely answered by the twelve-stage inventory in `AI` App. A — stage keys supply the task vocabulary — but is left open pending D-7 reconciliation.

---

*This is a living document. Decisions here are traceable to the authoritative sources cited and are revisable through the same escalation route that produced them.*
