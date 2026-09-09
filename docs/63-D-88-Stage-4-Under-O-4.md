# D-88 — Stage 4 in v1.0: disclosure of uncertainty, not a curated knowledge set

**Date:** 2026-09-10
**Status:** Recorded — a scope decision that names what only the owner can supply; no code change, no spend
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** the open question D-15 left — Stage 6 (and since D-78–D-84, Stage 9) run without Stage 4 Knowledge Assembly — by choosing, for v1.0, the first of the two options `PRD O-4` states: *"decide between disclosure-of-uncertainty only (MVP-appropriate) and a maintained [set]"*. M-05 stays at 11 of 12 stages, and this record says why the twelfth is not built by an autonomous session
**Affects:** nothing in the code. `STATUS` M-05 and the Stage 4 row; the handoff's open items
**Builds on** D-15, D-31 decision 4 (CF-5 zero-weighted while Stage 4 is unbuilt), D-78 and D-84 (the knowledge-currency note and the disclosed uncertainties), D-86 (CF-5 listed as unmeasured on every result).

---

## 1. What Stage 4 is, and what it would take

`AI §3.2` specifies Stage 4 as deterministic selection over **a small curated set** of platform knowledge — "relevant platform characteristics, applicable patterns, known failure modes, applicable rules" — with currency labelled and `PV §3.3`'s neutrality applied, feeding Stage 6 and the generators, and existing in v1.0 "primarily so that the later addition is not architectural". The stage machinery is a few dozen lines. **The set is the work**, and it is content, not code:

- **Neutrality (`PV §3.3`, Principle 3).** What NAIGX says about n8n, Make, Zapier or Power Automate is the substance of its platform recommendations; a curated set written by a session with no owner review would put unreviewed platform claims at the centre of the product's most sensitive output. `research/03-Tool-Matrix.md`, the natural source, is empty.
- **Currency (`O-4`).** Every fact in the set goes stale, and the set needs a maintenance decision the owner has not made — `O-4` says a maintained set needs an update mechanism no document specifies.
- **Evidence.** Feeding knowledge into Stage 6's and the generators' handoffs changes every composed prompt on the requirement, workflow and assessment paths: every recording would be recaptured (about $5 at Sonnet 5 medium) and the platform recommendation, integration requirements and confidence calibration re-evidenced against content nobody has reviewed.

## 2. The decision

**v1.0 takes `O-4`'s first option: disclosure of uncertainty, no curated set.** This is already how the product behaves, deliberately, since D-78: the platform recommendation and the platform comparison carry a knowledge-currency note that is always present; the integration requirements label every constraint `stated` (cited) or `general_knowledge` (covered by the note) and list per integration what must be verified before building (D-84); Stage 11 exposes CF-5 on every analysis as *unmeasured, weight 0, because Stage 4 is not built* (D-86). The reader is told, every time, that platform knowledge is the model's general knowledge and must be verified. That is `AI-042`'s "discloses uncertainty rather than asserting", met.

**Stage 4 stays unbuilt, and M-05 stays at 11 of 12**, with this record as the reason rather than an oversight. It is built when the owner supplies or approves the set: which platforms, which characteristics, which failure modes, at what currency, reviewed for neutrality. The insertion point is unchanged — `AI §3.2` Stage 4 — and the reweighting of CF-5 (D-31 decision 4) is the same record's work.

## 3. What is not changed

Nothing in the code. D-15's "no amendment is needed if Stages 4–5 land before release" is now false for Stage 4, so the amendment it anticipated is listed below.

## 4. Minimum authoritative amendments to ratify

`AI §3.2` Stage 4's row (v1.0 ships without the curated set; disclosure of uncertainty per `O-4` option 1) and Stage 6's input list ("Context + knowledge + reasoning plan" — knowledge absent in v1.0, as D-15 foresaw); the `O-4` row (option 1 taken for v1.0); `STATUS` M-05.
