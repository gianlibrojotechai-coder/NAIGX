/**
 * Unit — the alert rules reference metrics that actually exist
 * (`M-19` Phase 4, `NFR-082`, `NFR-085`).
 *
 * ⚠️ AN ALERT ON A MISSPELLED SERIES NEVER FIRES, AND NOTHING REPORTS IT.
 * Prometheus does not warn about a rule whose expression matches no series —
 * it evaluates to an empty vector, which is indistinguishable from "the
 * condition is not met". The rule sits there looking like coverage and is
 * worth nothing.
 *
 * This is not hypothetical: the first draft of `alerts.yml` referenced
 * `naigx_full_analysis_p95`, and the real series is
 * `naigx_full_analysis_latency_p95`. The latency alert `NFR-082` asks for
 * would have been permanently silent, and every review of the file would have
 * read fine.
 *
 * So the rules are checked against the renderer's actual output rather than
 * against a list someone maintains by hand.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  renderPrometheus,
  type MetricsSnapshot,
} from "../../src/db/metrics.js";

const alertsPath = fileURLToPath(
  new URL("../../../deploy/monitoring/alerts.yml", import.meta.url),
);

/**
 * A snapshot with every field populated, so the renderer emits every series it
 * can. Values are irrelevant — only the names are under test.
 */
const fullSnapshot = (): MetricsSnapshot => ({
  computed: [
    { id: "M-1", name: "analyses_started_total", value: 0, unit: "count" },
    {
      id: "M-1",
      name: "analyses_terminal_unsuccessful_total",
      value: 0,
      unit: "count",
    },
    { id: "M-1", name: "analysis_completion_rate", value: 0, unit: "ratio" },
    {
      id: "M-2",
      name: "time_to_first_artifact_p50",
      value: 0,
      unit: "seconds",
    },
    {
      id: "M-2",
      name: "time_to_first_artifact_p95",
      value: 0,
      unit: "seconds",
    },
    {
      id: "M-2",
      name: "time_to_first_artifact_samples",
      value: 0,
      unit: "count",
    },
    { id: "M-3", name: "full_analysis_latency_p50", value: 0, unit: "seconds" },
    { id: "M-3", name: "full_analysis_latency_p95", value: 0, unit: "seconds" },
    {
      id: "M-3",
      name: "full_analysis_latency_samples",
      value: 0,
      unit: "count",
    },
    { id: "M-4", name: "export_rate", value: 0, unit: "ratio" },
    { id: "M-4", name: "exports_total", value: 0, unit: "count" },
    { id: "M-5", name: "return_rate", value: 0, unit: "ratio" },
    { id: "M-5", name: "users_with_analyses_total", value: 0, unit: "count" },
    { id: "M-7", name: "low_quality_flag_rate", value: 0, unit: "ratio" },
    { id: "M-7", name: "feedback_total", value: 0, unit: "count" },
    { id: "M-10", name: "schema_validity_rate", value: 0, unit: "ratio" },
    { id: "M-10", name: "validation_events_total", value: 0, unit: "count" },
  ],
  manual: [],
  operational: [
    { name: "purge_outbox_pending", value: 0, unit: "count", help: "x" },
    { name: "purge_outbox_overdue", value: 0, unit: "count", help: "x" },
    { name: "purge_outbox_failed", value: 0, unit: "count", help: "x" },
    { name: "encryption_plaintext_reads", value: 0, unit: "count", help: "x" },
  ],
  generatedAt: new Date("2026-09-08T00:00:00.000Z"),
});

/** Series names the renderer actually emits, from the rendered text. */
const emittedSeries = (): Set<string> => {
  const names = new Set<string>();
  for (const line of renderPrometheus(fullSnapshot()).split("\n")) {
    // A value line, not a `# HELP` / `# TYPE` comment.
    const match = /^(naigx_[a-z0-9_]+)\s/.exec(line);
    if (match?.[1] !== undefined) {
      names.add(match[1]);
    }
  }
  return names;
};

/** Series names the rule file mentions, ignoring the comment prose. */
const referencedSeries = (): Set<string> => {
  const file = readFileSync(alertsPath, "utf8");
  const names = new Set<string>();
  for (const rawLine of file.split("\n")) {
    const line = rawLine.trim();
    // Comments explain the metrics by name; only expressions are binding.
    if (line.startsWith("#")) continue;
    for (const match of line.matchAll(/naigx_[a-z0-9_]+/g)) {
      names.add(match[0]);
    }
  }
  return names;
};

test("every metric an alert rule references is actually emitted", () => {
  const emitted = emittedSeries();
  const missing = [...referencedSeries()].filter((name) => !emitted.has(name));

  assert.deepEqual(
    missing,
    [],
    `alerts.yml references series the metrics endpoint never emits: ${missing.join(", ")}. ` +
      `Prometheus evaluates these to an empty vector, so the rule is permanently silent.`,
  );
});

test("the requirements NFR-082 and NFR-085 name are each covered by a rule", () => {
  // `NFR-082`: error rate, latency percentiles, completion rate.
  // `NFR-085`: completion rate below the `NFR-010` threshold.
  //
  // Checked by expression content rather than by counting rules, so renaming
  // an alert does not silently drop the coverage it was providing.
  const file = readFileSync(alertsPath, "utf8");

  assert.match(
    file,
    /naigx_analysis_completion_rate\s*<\s*0\.95/,
    "NFR-085 requires an alert on completion rate below the NFR-010 95% threshold",
  );
  assert.match(
    file,
    /naigx_analyses_terminal_unsuccessful_total/,
    "NFR-082 requires error rate to be alerted",
  );
  assert.match(
    file,
    /naigx_full_analysis_latency_p95/,
    "NFR-082 requires latency percentiles to be alerted",
  );
});

test("the Phase 3 silent failures each have an alert", () => {
  // Each of these is a state the application reaches without erroring, and
  // that no user-visible behaviour reveals. If the rule is dropped, the
  // condition becomes unobservable again.
  const file = readFileSync(alertsPath, "utf8");

  for (const series of [
    // A purge past the window quoted to the user — a broken promise.
    "naigx_purge_outbox_overdue",
    // An instruction that gave up.
    "naigx_purge_outbox_failed",
    // The only signal the encryption backfill is unfinished.
    "naigx_encryption_plaintext_reads",
  ]) {
    assert.ok(
      file.includes(series),
      `${series} has no alert rule — the condition it reports would be unobservable`,
    );
  }
});
