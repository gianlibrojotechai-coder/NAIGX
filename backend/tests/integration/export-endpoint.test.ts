/**
 * Integration — `API-040` export (`M-13`).
 *
 * WHAT MATTERS HERE IS WHAT THE ENDPOINT REFUSES TO INVENT.
 * [D-41](../../../docs/16-D-41-Anonymous-Export-Deviation.md) permits anonymous
 * export and forbids writing an `EXPORT` row without a real owner;
 * [D-42](../../../docs/17-D-42-Export-Response-Contract.md) concludes that
 * `export_id`, `download_url` and `expires_at` therefore cannot honestly exist
 * and must be absent rather than fabricated or nulled.
 *
 * Those are the properties pinned first, because they are the ones a later
 * change would most plausibly "fix" by minting an id — which is exactly the
 * mistake `API-020`'s never-issued anonymous token already represents.
 *
 * The Prisma client is a double: this is a test of the endpoint's decisions,
 * not of the query. `tests/integration/job-description-persistence-postgres`
 * covers the read against a real database.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import {
  anonymousCredential,
  anonymousLookup,
  noSessions,
} from "../helpers/anonymous-principal.js";

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  spend: { reserveUsdPerAnalysis: "0.30" },
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const ANALYSIS_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

/** A stored analysis in the shape `readAnalysis` includes. */
const storedAnalysis = (overrides: Record<string, unknown> = {}) => ({
  analysisId: ANALYSIS_ID,
  userId: null,
  status: "completed",
  createdAt: new Date("2026-09-07T11:58:00.000Z"),
  completedAt: new Date("2026-09-07T11:59:30.000Z"),
  derivedTitle: "Automation Engineer at Northwind",
  sufficiencyLevel: "sufficient",
  overallConfidenceBand: null,
  degradationFlag: false,
  timeoutFlag: false,
  input: { characterCount: 2400, sourceType: "paste" },
  classification: {
    determinedType: "job_description",
    confidence: 0.91,
    candidateTypes: null,
    wasLowConfidence: false,
    userOverrideType: null,
    overriddenAt: null,
  },
  intentRecord: {
    primaryObjective: "Determine fit for an automation engineer role",
    inferredScope: "One posting",
    objectiveProvenance: { primary: "inferred", secondary: [] },
  },
  contextElements: [],
  recommendations: [
    {
      conclusion: "build_first",
      rationale: "One decisive gap remains unevidenced.",
      criteriaApplied: null,
      confidenceBand: null,
      confidenceFactors: null,
      alternatives: [],
    },
  ],
  requiredCapabilities: [],
  artifactPlanEntries: [
    {
      artifactType: "portfolio_suggestions",
      planned: true,
      outcome: "generated",
      inclusionReason: "One decisive technical gap is eligible.",
      omissionReason: null,
      artifact: {
        validationStatus: "valid",
        content: {
          consolidation_rationale: "One project covers the single gap.",
          projects: [
            {
              rank: 1,
              name: "Orchestrated intake pipeline",
              complexity: "intermediate",
              primary_gaps: ["REQ-1"],
              secondary_capabilities: ["Error handling"],
              why_this_project: "It exercises orchestration directly.",
              business_problem: "Intake is handled by hand.",
              what_to_build: "A queue-backed pipeline.",
              workflow: ["Request arrives", "Processed"],
              platforms: ["n8n"],
              technical_concepts: ["Queueing"],
              evidence_to_produce: [
                { type: "repo", what_it_shows: "The source" },
              ],
              why_not_consolidated: "It is the only decisive gap.",
              reusability: {
                provenance: "inferred",
                basis: "The requirements name orchestration generically",
                claim: "Most orchestration roles would accept it",
              },
              estimated_effort: "days",
              portfolio_value: "Closes the blocking gap.",
            },
          ],
        },
      },
    },
    {
      artifactType: "risk_assessment",
      planned: true,
      outcome: "generated",
      inclusionReason: "Planned for this path.",
      omissionReason: null,
      artifact: {
        validationStatus: "valid",
        content: {
          risks: [
            {
              component: "Form Watcher",
              description: "Submissions can be lost on provider outage",
              severity: 4,
              likelihood: 3,
              mitigation: "Persist submissions before acknowledging",
            },
          ],
        },
      },
    },
  ],
  ...overrides,
});

/**
 * Ownership is enforced from `M-15`, so these requests present the anonymous
 * credential for the analysis they read — exactly as a real client does.
 */
const credential = anonymousCredential();

const database = (analysis: unknown): Database =>
  ({
    prisma: {
      healthCheck: { findFirst: () => Promise.resolve(null) },
      session: noSessions,
      analysis: {
        findUnique: () => Promise.resolve(analysis),
        ...anonymousLookup(credential, {
          analysisId: ANALYSIS_ID,
          userId:
            (analysis as { userId?: string | null } | null)?.userId ?? null,
        }),
      },
    },
    disconnect: () => Promise.resolve(),
  }) as unknown as Database;

const build = async (analysis: unknown = storedAnalysis()) =>
  buildApp({ config, database: database(analysis) });

/** `API-040`'s request body, in the shapes these tests send. */
interface ExportRequest {
  readonly format?: string;
  readonly artifact_types?: readonly string[];
}

const post = async (body: ExportRequest, analysis?: unknown) => {
  const app = await build(analysis);
  const res = await app.inject({
    method: "POST",
    url: `/analyses/${ANALYSIS_ID}/exports`,
    payload: body,
    headers: credential.header,
  });
  await app.close();
  return res;
};

// --- D-41 / D-42: what is not invented --------------------------------------

test("D-41 — an anonymous caller may export, and receives the document", async () => {
  const res = await post({});

  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /^text\/markdown/);
  assert.match(res.body, /^# Automation Engineer at Northwind/);
});

test("D-42 — no export_id, download_url or expires_at is minted", async () => {
  // The whole point of the record. An id here would reference no row, and a
  // client could reasonably store it, quote it, or GET it.
  const res = await post({});

  assert.equal(res.body.includes("export_id"), false);
  assert.equal(res.body.includes("download_url"), false);
  assert.equal(res.body.includes("expires_at"), false);
});

test("D-42 — the document is the body, not an envelope wrapping a pointer", async () => {
  const res = await post({});

  // `AC-008`: presentation-ready without reformatting. A caller saving this to
  // a file must not have to unwrap it first.
  assert.equal(res.body.startsWith("{"), false);
  assert.equal(res.body.includes('"data"'), false);
  assert.match(
    res.headers["content-disposition"] as string,
    new RegExp(`filename="naigx-analysis-${ANALYSIS_ID}\\.md"`),
  );
});

test("D-42 — success is 200, because nothing was created", async () => {
  const res = await post({});
  assert.equal(res.statusCode, 200);
  assert.notEqual(res.statusCode, 201);
});

test("an anonymous token does not export someone else's owned analysis", async () => {
  // D-41 §4.4 wrote this branch before there was an identity to check, and it
  // refused with `forbidden` 403 because verification was impossible rather
  // than because the caller was wrong. `M-15` supplied the identity, so the
  // refusal is now a real authorization decision — and it is **404**, for the
  // reason `API-021` uses: a 403 would confirm the analysis exists, making the
  // id space an oracle for what this system has analysed.
  //
  // The credential is valid; it simply belongs to nothing here. `mayAccess`
  // refuses an anonymous principal on any owned analysis, because a claimed
  // analysis has no anonymous credential any more.
  const res = await post(
    {},
    storedAnalysis({ userId: "99999999-9999-9999-9999-999999999999" }),
  );

  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error.code, "not_found");
});

// --- validation --------------------------------------------------------------

test("a non-terminal analysis is refused, and the message names the state", async () => {
  const res = await post({}, storedAnalysis({ status: "running" }));
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 409);
  assert.equal(body.error.code, "invalid_state");
  assert.match(body.error.message, /`running`/);
  assert.match(body.error.action, /status/);
});

test("a timed-out analysis is exportable, and the document says so", async () => {
  // `M-14` preserved everything that completed before the deadline. Refusing
  // to export it would tell the user their surviving work is worthless.
  const res = await post(
    {},
    storedAnalysis({ status: "timed_out", timeoutFlag: true }),
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /This analysis timed out/);
});

test("an unknown analysis is 404, not an empty document", async () => {
  const res = await post({}, null);
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error.code, "not_found");
});

test("an unrecognised format is refused with the enumerated set", async () => {
  const res = await post({ format: "docx" });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.equal(body.error.code, "validation_failed");
  assert.match(body.error.message, /markdown, pdf/);
});

test("a PDF request is never answered with Markdown", async () => {
  // Serving Markdown under a PDF content type would hand the caller a corrupt
  // file and no explanation. `docs/08` sanctions Markdown as the fallback,
  // which is a reason to *name* it in a refusal, not to substitute it.
  //
  // Deliberately environment-independent: with a browser this is a real PDF,
  // without one it is a `503` naming Markdown, and **neither is Markdown under
  // a PDF content type**. The two branches are exercised individually in
  // `export-pdf.test.ts`, which skips when no browser exists.
  const res = await post({ format: "pdf" });
  const contentType = (res.headers["content-type"] as string | undefined) ?? "";

  assert.equal(contentType.includes("text/markdown"), false);

  if (res.statusCode === 200) {
    assert.match(contentType, /^application\/pdf/);
    assert.equal(res.rawPayload.subarray(0, 5).toString("ascii"), "%PDF-");
  } else {
    assert.equal(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, "service_unavailable");
    assert.match(body.error.action, /markdown/);
  }
});

test("format defaults to markdown when omitted", async () => {
  const res = await post({});
  assert.equal(res.statusCode, 200);
});

// --- FR-052 selection --------------------------------------------------------

test("FR-052 — a selection exports the chosen artifact and names the rest", async () => {
  const res = await post({ artifact_types: ["portfolio_suggestions"] });

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /This is a partial export/);
  assert.match(res.body, /Risk Assessment \| Excluded from this export/);
  assert.equal(
    res.body.includes("Persist submissions before acknowledging"),
    false,
  );
});

test("FR-053 — a one-artifact selection is what copy-to-clipboard fetches", async () => {
  // Same endpoint, same serialiser. There is no second Markdown writer that
  // could drift from this one.
  const res = await post({ artifact_types: ["risk_assessment"] });

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Persist submissions before acknowledging/);
  // Derived at presentation from `docs/09` §2, never stored: 4 × 3 = 12, High.
  assert.match(res.body, /\| 12 \| High \|/);
  assert.match(res.body, /scale version `risk-v1`/);
});

test("an artifact type that names nothing is refused with the valid set", async () => {
  // D-85 made `executive_summary` a real type; the unrecognised name is now one
  // nothing declares.
  const res = await post({ artifact_types: ["not_an_artifact_type"] });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.equal(body.error.code, "validation_failed");
  assert.deepEqual(body.error.details.unrecognised, ["not_an_artifact_type"]);
});

test("an empty selection is refused rather than treated as 'everything'", async () => {
  const res = await post({ artifact_types: [] });
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error.action, /Omit the field/);
});

test("a valid type this analysis did not produce is refused with what it has", async () => {
  const res = await post({ artifact_types: ["mermaid_diagram"] });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.match(body.error.action, /portfolio_suggestions, risk_assessment/);
});

// --- SA §3.8 ------------------------------------------------------------------

test("SA §3.8 — exporting twice yields the same document", async () => {
  // "Export is a pure transformation of stored artifacts." Determinism is what
  // makes regeneration a sound substitute for a stored file (`D-42` §3.4).
  const first = await post({});
  const second = await post({});

  const strip = (body: string) =>
    body.replace(/\| \*\*Document generated\*\* \| [^|]+ \|/, "");
  assert.equal(strip(first.body), strip(second.body));
});
