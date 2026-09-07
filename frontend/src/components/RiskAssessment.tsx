/**
 * The `risk_assessment` artifact — the findings as a risk register.
 *
 * SCORE AND BAND ARE DERIVED HERE, NOT STORED. `docs/09` §2 defines Risk Score
 * as Severity × Likelihood and the bands as ranges over that product. The
 * store holds only the two inputs, deliberately: a stored band would quietly
 * mean something different the day the scale is revised. Deriving at
 * presentation keeps one definition of the scale in one place.
 *
 * EVERY RISK NAMES A COMPONENT AND A MITIGATION. `FR-032` requires both and
 * `DB §4.3` enforces them with NOT NULL columns — "a risk that cannot name
 * what it affects cannot be stored". So neither is rendered conditionally:
 * their absence would be a defect upstream, not a display case.
 *
 * Ordered by score, highest first. A register sorted by anything else buries
 * the risk the reader most needs to see.
 */

import type { RiskAssessment, RiskItem } from "../api/types";
import { likelihoodLabel, riskBand, riskScore, riskTone, severityLabel } from "../format";
import { Badge, Unavailable } from "./ui";

function Risk({ risk }: { risk: RiskItem }) {
  const score = riskScore(risk.severity, risk.likelihood);
  const band = riskBand(score);

  return (
    <li className="border border-slate-200 rounded-md overflow-hidden">
      <header className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
        {/* The band carries a word and the score, never a colour alone
            (`NFR-063`) — the tint is reinforcement, not the message. */}
        <Badge tone={riskTone(band)}>
          {band} · {score}
        </Badge>
        <span className="text-sm font-medium text-slate-900 flex-1 min-w-0">
          {risk.component}
        </span>
      </header>

      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-800">{risk.description}</p>

        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Severity
            </dt>
            <dd className="text-slate-800 mt-0.5">
              {risk.severity} · {severityLabel(risk.severity)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Likelihood
            </dt>
            <dd className="text-slate-800 mt-0.5">
              {risk.likelihood} · {likelihoodLabel(risk.likelihood)}
            </dd>
          </div>
        </dl>

        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mitigation
          </h5>
          <p className="text-sm text-slate-800 mt-0.5">{risk.mitigation}</p>
        </div>
      </div>
    </li>
  );
}

export function RiskAssessmentView({
  assessment,
}: {
  assessment: RiskAssessment;
}) {
  if (assessment.risks.length === 0) {
    return assessment.no_risks_statement !== undefined ? (
      <div className="border border-emerald-300 bg-emerald-50 rounded-md p-4">
        <h4 className="font-medium text-emerald-900">
          The register is empty, and deliberately so
        </h4>
        <p className="text-sm text-emerald-900 mt-1">
          {assessment.no_risks_statement}
        </p>
      </div>
    ) : (
      <Unavailable>
        The register is empty and carries no statement explaining why. An empty
        register and a workflow with no risks are different claims; only the
        first is supported here.
      </Unavailable>
    );
  }

  const ordered = [...assessment.risks].sort(
    (a, b) =>
      riskScore(b.severity, b.likelihood) - riskScore(a.severity, a.likelihood),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Risk score is severity × likelihood on the 1–5 scales of{" "}
        <code>docs/09</code> §2, giving 1–25. Bands: Low 1–4, Moderate 5–9, High
        10–14, Very high 15–19, Critical 20–25. Highest first.
      </p>
      <ul className="space-y-3">
        {ordered.map((risk, index) => (
          <Risk key={`${risk.component}-${String(index)}`} risk={risk} />
        ))}
      </ul>
    </div>
  );
}
