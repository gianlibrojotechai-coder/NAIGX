# Provider Layer — Sprint 0 scope

The capability interface the NIE addresses, plus a deterministic offline stub.

```
provider/
├── capability.ts        the port — no provider knowledge, no I/O
├── index.ts             registry + factory
└── adapters/
    └── stub.ts          the only file permitted to be provider-specific
```

**Sprint 0 deliverable** (`Roadmap`): *"Local development with stubbed provider; no network required for NIE work."* Exit criterion: *"A developer can run the stack locally with a stubbed provider."*

```ts
import { createProvider } from "./provider/index.js";

const provider = createProvider();            // defaults to the offline stub
const response = await provider.invoke({
  task: "classification",
  input: "…",
  preferLowVariance: true,
});
```

No credentials, no `DATABASE_URL`, no network. Verified with `fetch`, `net`, `http` and `https` replaced by throwing stubs.

---

## Deliberately not built

`AI §10.1` names an abstraction layer of six components. Sprint 0 implements the contract and one adapter; the rest are **Sprint 1 deliverables** (`Roadmap`: *"Capability interface, adapter, retry, normalization, cost accounting"*):

| Component | Status |
|---|---|
| Capability interface | ✅ this sprint, minimum shape |
| Adapter | ✅ stub only |
| Capability detection | ⏳ declarations exist; selection logic is Sprint 1 |
| Model routing (`AI §10.3`) | ⏳ Sprint 1 — per-stage, capability, cost tier, failover |
| Retry & backoff (`AI §10.4`, `NFR-013`) | ⏳ Sprint 1 |
| Response normalization | ⏳ Sprint 1 — error taxonomy is declared, mechanism is not |
| Usage accounting (`NFR-083`) | ⏳ Sprint 1 — shape declared, recording is not |
| Second adapter + test (`AI-005`) | ⏳ Sprint 1 — boundary check 8 arms on arrival |

Also absent by instruction: the NIE, orchestrator, reasoning stages, templates, persistence, business endpoints, authentication, and any real SDK.

**The provider is not wired into the composition root.** Nothing consumes it yet, and constructing an unused dependency in `index.ts` would be speculative. Sprint 1 wires it when the NIE exists.

---

## ⚠️ Undefined in the authoritative documents

Flagged rather than invented. Each is typed as loosely as possible so Sprint 1 can fix it without unpicking a commitment made here.

| # | Detail | What the documents say | What they omit |
|---|---|---|---|
| 1 | **Output contract representation** | `AI §10.2` lists "output contract" as a request dimension; AD-08 establishes schema-validated output; `AI §9.3` has one schema drive generation and validation | No format for the value crossing this boundary. Typed `string \| undefined` |
| 2 | **Cost/latency tier vocabulary** | `AI §10.2` requires routing "to the closest available tier"; `AI §10.3` makes tier a routing dimension | No tier names, no ordering. Typed as an opaque `string`, not an invented enum |
| 3 | **Cost unit** | `SA §3.5` requires cost recorded per call; `NFR-083` names cost a provider metric | No currency, unit, or precision. **Omitted entirely** — a number without a unit is worse than no number |
| 4 | **Task vocabulary** | `AI §10.2` expresses requests in domain terms including "reasoning task" | The task set belongs to the NIE stages (`AI §3`), which do not exist. Opaque `string` |
| 5 | **Degradation record vocabulary** | `AI §10.2` and `§10.4` require *recording* that a fallback was used | No vocabulary or structure. Free-text `string[]` |
| 6 | **Determinism preference scale** | `AI §10.2` names "determinism preference"; capability is "low-variance sampling" | No scale. Modelled as `boolean`, mapping one-to-one onto the declared capability rather than inventing a range |
| 7 | **Provider/model configuration surface** | `AI-002` requires configuration without code deploy | Where it lives and its format. Deferred to Sprint 1 with routing; Sprint 0 uses a defaulted argument, adding no env var for an unused capability |

Two shapes are **not** undefined and are taken directly from the documents: the four declared capabilities (`AI §10.2`) and the four failure classes (`AI §10.4`).

---

## Why the stub declares `structuredOutput: false`

`AI §10.6` prohibits "capability assumptions without declaration". A false declaration is worse than a missing one.

The stub cannot conform to an output contract because the contract's representation is undefined (#1 above) — there is nothing for it to read. Declaring `false` is the honest answer and routes callers down the `AI §10.2` degradation path, which has the side benefit of exercising that path in local development.

If Sprint 1 wants a schema-echoing stub, it becomes possible once #1 is defined.

## Why the stub does not reason

It returns `STUB_PROVIDER_RESPONSE task=… digest=…` — deterministic, and obviously not analysis.

Producing plausible-looking output would invent behaviour belonging to the NIE (`AI §3`) and would let a wiring bug masquerade as a working pipeline. The digest makes the response useful for asserting a request arrived unchanged, and useless for anything else.

---

## Interaction with boundary check 8

`SA` Appendix A check 8 counts entries in `adapters/`, excluding `index.ts` and `*.d.ts`, and arms at **two**. One adapter today, so it correctly stays inactive.

⚠️ **A test file placed inside `adapters/` would be counted as a second adapter** and would arm check 8 prematurely. Adapter tests belong outside that directory. Worth resolving in Sprint 1 when the second adapter lands — by refining the counter in `tools/boundary-checks/check.mjs`, not by relaxing the check.
