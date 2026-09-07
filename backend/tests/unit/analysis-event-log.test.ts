/**
 * Unit — the analysis event log (`API-025`, `API §7.4`).
 *
 * The guarantees under test are the ones a client actually depends on:
 * sequence numbers that let it detect a gap, a `plan` that arrives before any
 * `artifact` so the layout does not jump, a terminal event before close, and
 * resumption from `Last-Event-ID` that delivers what was missed and nothing
 * else.
 *
 * The last one is the reason this is a log rather than a broadcast: a client
 * that drops at event 4 and reconnects must receive 5 onward exactly once.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAnalysisEventLog,
  type SequencedEvent,
} from "../../src/events/analysis-event-log.js";
import type { AnalysisEvent } from "../../src/nie/events.js";

const ID = "analysis-1";

const classification: AnalysisEvent = {
  type: "classification",
  determinedType: "job_description",
  confidence: 0.9,
  candidateTypes: [],
  wasLowConfidence: false,
};

const plan: AnalysisEvent = {
  type: "plan",
  planned: ["portfolio_suggestions"],
  omitted: [],
};

const artifact: AnalysisEvent = {
  type: "artifact",
  artifactType: "portfolio_suggestions",
  content: { projects: [] },
};

const complete: AnalysisEvent = {
  type: "complete",
  status: "completed",
  degraded: false,
  timedOut: false,
  artifactCounts: { generated: 1, failed: 0, omitted: 0 },
};

const collect = () => {
  const received: SequencedEvent[] = [];
  return { received, listener: (e: SequencedEvent) => received.push(e) };
};

// --- sequencing -----------------------------------------------------------

test("sequence numbers are monotonic from 1", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  const { received, listener } = collect();
  log.subscribe(ID, 0, listener);

  log.publish(ID, classification);
  log.publish(ID, plan);
  log.publish(ID, artifact);

  assert.deepEqual(
    received.map((e) => e.sequence),
    [1, 2, 3],
    "a gap in these numbers is how a client detects a lost frame (API §7.4)",
  );
});

test("sequences are per analysis, not global", () => {
  const log = createAnalysisEventLog();
  log.open("a");
  log.open("b");
  log.publish("a", classification);
  log.publish("b", classification);

  const a = collect();
  const b = collect();
  log.subscribe("a", 0, a.listener);
  log.subscribe("b", 0, b.listener);

  assert.equal(a.received[0]?.sequence, 1);
  assert.equal(
    b.received[0]?.sequence,
    1,
    "two streams do not share a counter",
  );
});

test("plan precedes any artifact event", () => {
  // `API §7.4` — the client knows what to expect before results arrive, so the
  // layout does not jump as artifacts land.
  const log = createAnalysisEventLog();
  log.open(ID);
  const { received, listener } = collect();
  log.subscribe(ID, 0, listener);

  log.publish(ID, plan);
  log.publish(ID, artifact);

  const planAt = received.findIndex((e) => e.event.type === "plan");
  const artifactAt = received.findIndex((e) => e.event.type === "artifact");
  assert.ok(planAt >= 0 && artifactAt > planAt);
});

// --- resumption -----------------------------------------------------------

test("a reconnecting subscriber receives only what it missed", () => {
  const log = createAnalysisEventLog();
  log.open(ID);

  const first = collect();
  const subscription = log.subscribe(ID, 0, first.listener);
  log.publish(ID, classification);
  log.publish(ID, plan);
  subscription?.unsubscribe();

  // Published while nobody is listening — the case a broadcast would lose.
  log.publish(ID, artifact);

  const resumed = collect();
  log.subscribe(ID, 2, resumed.listener);

  assert.deepEqual(
    resumed.received.map((e) => e.sequence),
    [3],
    "resumption delivers what was missed and nothing already seen",
  );
});

test("resuming from 0 replays the whole stream", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  log.publish(ID, classification);
  log.publish(ID, plan);

  const { received, listener } = collect();
  log.subscribe(ID, 0, listener);

  assert.deepEqual(
    received.map((e) => e.sequence),
    [1, 2],
    "a late first connection still gets everything",
  );
});

test("replay is followed by live delivery, with no duplication", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  log.publish(ID, classification);

  const { received, listener } = collect();
  log.subscribe(ID, 0, listener);
  log.publish(ID, plan);

  assert.deepEqual(
    received.map((e) => e.sequence),
    [1, 2],
    "the replayed event is not re-sent when the live path starts",
  );
});

// --- terminal behaviour ---------------------------------------------------

test("a terminal event marks the log complete", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  assert.equal(log.isComplete(ID), false);

  log.publish(ID, complete);
  assert.equal(log.isComplete(ID), true);
});

test("an error event is terminal too", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  log.publish(ID, {
    type: "error",
    code: "internal_error",
    message: "something went wrong",
    stageNumber: null,
  });
  assert.equal(log.isComplete(ID), true);
});

test("subscribing to a finished analysis replays and does not follow", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  log.publish(ID, classification);
  log.publish(ID, complete);

  const { received, listener } = collect();
  const subscription = log.subscribe(ID, 0, listener);

  assert.equal(received.length, 2, "the terminal event is replayed");
  assert.equal(received[1]?.event.type, "complete");
  assert.ok(subscription, "a subscription is still returned, already spent");
});

// --- isolation ------------------------------------------------------------

test("an unknown analysis has no log", () => {
  const log = createAnalysisEventLog();
  assert.equal(
    log.subscribe("never-ran", 0, () => undefined),
    undefined,
    "the caller decides what a missing log means; this layer does not guess",
  );
});

test("a throwing subscriber does not stop the others or the publisher", () => {
  // `API-025`: "Stream failure never fails the analysis." A broken pipe is a
  // delivery problem, and the reasoning is already persisted.
  const log = createAnalysisEventLog();
  log.open(ID);
  const healthy = collect();

  log.subscribe(ID, 0, () => {
    throw new Error("client vanished");
  });
  log.subscribe(ID, 0, healthy.listener);

  assert.doesNotThrow(() => {
    log.publish(ID, classification);
    log.publish(ID, plan);
  });
  assert.equal(
    healthy.received.length,
    2,
    "the surviving subscriber keeps receiving",
  );
});

test("unsubscribing twice is safe", () => {
  const log = createAnalysisEventLog();
  log.open(ID);
  const subscription = log.subscribe(ID, 0, () => undefined);

  assert.doesNotThrow(() => {
    subscription?.unsubscribe();
    subscription?.unsubscribe();
  });
});

// --- memory ---------------------------------------------------------------

test("a completed log is evicted once nothing is listening", () => {
  // Bounded by eviction rather than by hope: a long-running instance must not
  // accumulate one buffer per analysis it has ever run.
  let clock = 0;
  const log = createAnalysisEventLog({
    retentionMs: 1_000,
    now: () => clock,
  });

  log.open(ID);
  log.publish(ID, complete);
  assert.equal(log.isComplete(ID), true);

  clock = 2_000;
  log.publish("other", classification); // any write sweeps

  assert.equal(
    log.subscribe(ID, 0, () => undefined),
    undefined,
    "the finished log is gone once its retention window passes",
  );
});

test("an in-flight log is never evicted", () => {
  let clock = 0;
  const log = createAnalysisEventLog({ retentionMs: 1, now: () => clock });

  log.open(ID);
  log.publish(ID, classification);

  clock = 1_000_000;
  log.publish("other", classification);

  assert.ok(
    log.subscribe(ID, 0, () => undefined),
    "a running analysis keeps its log however long it takes",
  );
});
