/**
 * Unit — the spend guard (D-67 §3).
 *
 * Every test here is a way money leaks if it fails: a cap compared as a
 * float, a reserve charged after the run instead of before, a window that
 * rolls over on local time, or an unreadable ledger read as "nothing spent".
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSpendGuard,
  unitsToUsd,
  usdToUnits,
  utcDayStart,
  utcMonthStart,
  type SpendReader,
} from "../../src/orchestrator/spend-guard.js";

const NOW = new Date("2026-09-09T13:45:00.000Z");

const reader = (byWindow: {
  day?: string;
  month?: string;
  fail?: boolean;
}): SpendReader & { asked: Date[] } => {
  const asked: Date[] = [];
  return {
    asked,
    spentSince(since) {
      asked.push(since);
      if (byWindow.fail) return Promise.reject(new Error("trace store down"));
      if (since.getTime() === utcDayStart(NOW).getTime()) {
        return Promise.resolve(byWindow.day ?? "0");
      }
      return Promise.resolve(byWindow.month ?? "0");
    },
  };
};

test("decimal USD strings convert exactly, never through a float", () => {
  assert.equal(usdToUnits("5.00"), 500_000_000n);
  assert.equal(usdToUnits("0.30"), 30_000_000n);
  assert.equal(usdToUnits("0.1") + usdToUnits("0.2"), usdToUnits("0.3"));
  assert.equal(unitsToUsd(usdToUnits("3.13207200")), "3.1320");
  assert.throws(() => usdToUnits("-1"));
  assert.throws(() => usdToUnits("1e3"));
  assert.throws(() => usdToUnits("$5"));
});

test("windows are UTC calendar windows", () => {
  assert.equal(utcDayStart(NOW).toISOString(), "2026-09-09T00:00:00.000Z");
  assert.equal(utcMonthStart(NOW).toISOString(), "2026-09-01T00:00:00.000Z");
});

test("a guard with no cap at all refuses to exist", () => {
  assert.throws(() =>
    createSpendGuard({
      caps: {},
      reserveUsd: "0.30",
      reader: reader({}),
    }),
  );
});

test("admits while spent plus the reserve fits under every cap", async () => {
  const r = reader({ day: "1.50", month: "12.00" });
  const guard = createSpendGuard({
    caps: { perDayUsd: "2.00", perMonthUsd: "20.00" },
    reserveUsd: "0.30",
    reader: r,
    now: () => NOW,
  });
  const decision = await guard.admit();
  assert.equal(decision.admitted, true);
  if (decision.admitted) {
    // Tightest window is the day: 2.00 − 1.50 − 0.30.
    assert.equal(decision.remainingUsd, "0.2000");
  }
  // Both windows were consulted, from their UTC starts.
  assert.deepEqual(
    r.asked.map((d) => d.toISOString()),
    ["2026-09-09T00:00:00.000Z", "2026-09-01T00:00:00.000Z"],
  );
});

test("the reserve is charged BEFORE the run: under the cap but within a reserve of it is a refusal", async () => {
  const guard = createSpendGuard({
    caps: { perDayUsd: "2.00" },
    reserveUsd: "0.30",
    reader: reader({ day: "1.80" }),
    now: () => NOW,
  });
  const decision = await guard.admit();
  assert.equal(decision.admitted, false);
  if (!decision.admitted) {
    assert.equal(decision.reason, "cap_reached");
    assert.equal(decision.window, "day");
    assert.equal(decision.capUsd, "2.00");
    assert.equal(decision.spentUsd, "1.8000");
    assert.equal(decision.resetsAt.toISOString(), "2026-09-10T00:00:00.000Z");
  }
});

test("exactly at the cap is admitted; one unit over is not", async () => {
  const at = createSpendGuard({
    caps: { perDayUsd: "2.00" },
    reserveUsd: "0.30",
    reader: reader({ day: "1.70" }),
    now: () => NOW,
  });
  assert.equal((await at.admit()).admitted, true);
  const over = createSpendGuard({
    caps: { perDayUsd: "2.00" },
    reserveUsd: "0.30",
    reader: reader({ day: "1.70000001" }),
    now: () => NOW,
  });
  assert.equal((await over.admit()).admitted, false);
});

test("the monthly cap refuses independently of the daily one", async () => {
  const guard = createSpendGuard({
    caps: { perDayUsd: "5.00", perMonthUsd: "20.00" },
    reserveUsd: "0.30",
    reader: reader({ day: "0.50", month: "19.90" }),
    now: () => NOW,
  });
  const decision = await guard.admit();
  assert.equal(decision.admitted, false);
  if (!decision.admitted) {
    assert.equal(decision.window, "month");
    assert.equal(decision.resetsAt.toISOString(), "2026-10-01T00:00:00.000Z");
  }
});

test("an unreadable ledger is a refusal, not a free pass", async () => {
  const guard = createSpendGuard({
    caps: { perDayUsd: "5.00" },
    reserveUsd: "0.30",
    reader: reader({ fail: true }),
    now: () => NOW,
  });
  const decision = await guard.admit();
  assert.equal(decision.admitted, false);
  if (!decision.admitted) {
    assert.equal(decision.reason, "spend_unknown");
    assert.equal(decision.spentUsd, undefined);
  }
});
