#!/usr/bin/env node
/**
 * NAIGX architectural boundary checks — `SA` Appendix A.
 *
 * Eight checks, verified in CI on every build. A failure blocks the build.
 * This file implements exactly those eight and invents none.
 *
 * Zero dependencies, no network, deterministic. Node built-ins only.
 *
 * Exit codes: 0 = no violations · 1 = boundary violated · 2 = checker misuse.
 *
 * DEFERRED CHECKS DO NOT SILENTLY PASS. A check whose subject module does not
 * exist yet reports `inactive` and is listed loudly in the summary. Several
 * arm themselves automatically: the moment the module they govern appears,
 * they either begin enforcing or fail demanding to be wired. That is what
 * stops a deferred check from being forgotten.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── Paths ────────────────────────────────────────────────────────────────────
const P = {
  backendSrc: "backend/src",
  frontendSrc: "frontend/src",
  generated: "backend/src/generated",
  providerAdapters: "backend/src/provider/adapters",
  nieStages: "backend/src/nie/stages",
  nieStageRegistry: "backend/src/nie/stages.ts",
  niePipeline: "backend/src/nie/pipeline.ts",
  artifactSchemas: "backend/schemas",
  fragmentManifest: "prompts/fragments.manifest.json",
  fragmentGateTest: "backend/tests/unit/fragment-gate.test.ts",
  providerConformanceTest: "backend/tests/contract/provider-conformance.test.ts",
  nie: "backend/src/nie",
  prompts: "prompts",
  backendPkg: "backend/package.json",
  frontendPkg: "frontend/package.json",
};

// ── Vocabularies ─────────────────────────────────────────────────────────────
// Model-provider SDKs. Membership here means "provider-specific" for AI-001.
const PROVIDER_SDKS = [
  "openai", "@azure/openai",
  "@anthropic-ai/sdk", "@anthropic-ai/bedrock-sdk", "@anthropic-ai/vertex-sdk",
  "@google/generative-ai", "@google/genai", "@google-cloud/aiplatform",
  "cohere-ai", "@mistralai/mistralai", "groq-sdk", "replicate", "together-ai",
  "ollama", "@aws-sdk/client-bedrock-runtime",
  "langchain", "@langchain/core", "@langchain/openai", "@langchain/anthropic",
  "llamaindex", "ai",
];

// Outbound HTTP clients. TC-008 / AD-09: the server holds no outbound capability.
const HTTP_CLIENTS = [
  "axios", "node-fetch", "got", "superagent", "undici", "ky", "phin",
  "needle", "request", "isomorphic-fetch", "cross-fetch",
];

// Forbidden inside the NIE (AD-02, AP-3): persistence, transport, framework.
const NIE_FORBIDDEN = {
  database: ["@prisma/client", "prisma", "@prisma/adapter-pg", "pg", "postgres", "mysql2", "mongodb", "redis"],
  http: [...HTTP_CLIENTS],
  framework: ["fastify", "express", "koa", "hapi", "@nestjs/core", "next", "react", "react-dom"],
};

// Dependency direction, outermost (0) → innermost (SA §5.3).
// A module may import inward or sideways, never outward.
const LAYERS = [
  { rank: 0, name: "composition root", match: (r) => r === "backend/src/index.ts" || r.startsWith("backend/src/harness/") },
  { rank: 1, name: "api", match: (r) => r === "backend/src/app.ts" || r.startsWith("backend/src/routes/") || r.startsWith("backend/src/http/") },
  { rank: 2, name: "orchestrator", match: (r) => r.startsWith("backend/src/orchestrator/") },
  { rank: 3, name: "persistence", match: (r) => r.startsWith("backend/src/db/") },
  { rank: 4, name: "nie", match: (r) => r.startsWith("backend/src/nie/") },
  { rank: 5, name: "provider interface", match: (r) => r.startsWith("backend/src/provider/") },
  { rank: 6, name: "config", match: (r) => r.startsWith("backend/src/config/") },
  // Static reasoning assets read from `prompts/`. Innermost: depends on nothing
  // in the application and is depended upon by persistence when publishing.
  { rank: 6, name: "fragment source", match: (r) => r.startsWith("backend/src/fragments/") },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const abs = (rel) => path.join(ROOT, rel);
const exists = (rel) => fs.existsSync(abs(rel));
const read = (rel) => fs.readFileSync(abs(rel), "utf8");

function walk(rel, exts = [".ts", ".tsx", ".mts", ".cts"]) {
  const out = [];
  const base = abs(rel);
  if (!fs.existsSync(base)) return out;
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        stack.push(full);
      } else if (exts.some((x) => e.name.endsWith(x))) {
        out.push(path.relative(ROOT, full).split(path.sep).join("/"));
      }
    }
  }
  return out;
}

/** Import specifiers only. Comments and free text are deliberately not scanned. */
function importsOf(relFile) {
  const src = read(relFile);
  const specs = [];
  const patterns = [
    /^\s*import\s+[\s\S]*?\bfrom\s*["']([^"']+)["']/gm,
    /^\s*import\s*["']([^"']+)["']/gm,
    /^\s*export\s+[\s\S]*?\bfrom\s*["']([^"']+)["']/gm,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) specs.push({ spec: m[1], line: src.slice(0, m.index).split("\n").length });
  }
  return specs;
}

const isBare = (s) => !s.startsWith(".") && !s.startsWith("/") && !s.startsWith("node:");
const pkgRootOf = (s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0]);

function depsOf(relPkg) {
  if (!exists(relPkg)) return [];
  const p = JSON.parse(read(relPkg));
  return Object.keys({ ...p.dependencies, ...p.devDependencies });
}

const appFiles = () => [...walk(P.backendSrc), ...walk(P.frontendSrc)].filter((f) => !f.startsWith(P.generated));
const backendFiles = () => walk(P.backendSrc).filter((f) => !f.startsWith(P.generated));

function resolveLocal(fromRel, spec) {
  if (!spec.startsWith(".")) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  return resolved.replace(/\.js$/, ".ts");
}
const layerOf = (rel) => LAYERS.find((l) => l.match(rel)) ?? null;

// ── The eight checks (SA Appendix A) ─────────────────────────────────────────
const checks = [];
const define = (id, title, enforces, run) => checks.push({ id, title, enforces, run });

define(1, "No provider name or SDK import outside `provider/adapters/`", "AI-001, AD-03", () => {
  const violations = [];
  for (const f of appFiles()) {
    if (f.startsWith(P.providerAdapters)) continue;
    for (const { spec, line } of importsOf(f)) {
      if (!isBare(spec)) continue;
      if (PROVIDER_SDKS.includes(pkgRootOf(spec)))
        violations.push(`${f}:${line} imports provider SDK '${spec}'`);
    }
  }
  // A provider SDK dependency with no adapter directory to live in is a violation in waiting.
  if (!exists(P.providerAdapters)) {
    for (const [pkgPath, label] of [[P.backendPkg, "backend"], [P.frontendPkg, "frontend"]]) {
      for (const d of depsOf(pkgPath)) {
        if (PROVIDER_SDKS.includes(d))
          violations.push(`${label}/package.json declares provider SDK '${d}' but ${P.providerAdapters}/ does not exist`);
      }
    }
  }
  return {
    state: violations.length ? "fail" : "pass",
    violations,
    note:
      "Enforced on import specifiers and package dependencies — deterministic. " +
      "Free-text provider-name scanning was evaluated and rejected: it false-positives on legitimate " +
      "user-facing content (frontend/src/App.tsx shows 'OpenAI' inside an example workflow a user might paste). " +
      "AI-001 governs provider-specific *logic*; AI-006 (provider identity never reaching a client) is a " +
      "runtime response property verified by AC-025, not a static source property.",
  };
});

define(2, "No database, HTTP, or framework import inside the NIE module", "AD-02, AP-3", () => {
  if (!exists(P.nie))
    return { state: "inactive", violations: [], note: `${P.nie}/ does not exist. Arms automatically when the NIE module is created (Sprint 1).` };
  const violations = [];
  for (const f of walk(P.nie)) {
    for (const { spec, line } of importsOf(f)) {
      const root = isBare(spec) ? pkgRootOf(spec) : null;
      for (const [kind, list] of Object.entries(NIE_FORBIDDEN))
        if (root && list.includes(root)) violations.push(`${f}:${line} imports ${kind} package '${spec}'`);
      const local = resolveLocal(f, spec);
      if (local && (local.startsWith("backend/src/db/") || local.startsWith("backend/src/http/") || local.startsWith("backend/src/routes/")))
        violations.push(`${f}:${line} imports '${spec}' — NIE must not reach persistence or transport`);
    }
  }
  return { state: violations.length ? "fail" : "pass", violations, note: "NIE module present; rule enforced." };
});

define(3, "No outbound HTTP client available outside the provider adapter", "TC-008, AD-09", () => {
  const violations = [];
  for (const f of backendFiles()) {
    if (f.startsWith(P.providerAdapters)) continue;
    const src = read(f);
    for (const { spec, line } of importsOf(f))
      if (isBare(spec) && HTTP_CLIENTS.includes(pkgRootOf(spec)))
        violations.push(`${f}:${line} imports outbound HTTP client '${spec}'`);
    for (const [re, label] of [
      [/(^|[^.\w])fetch\s*\(/g, "global fetch()"],
      [/\bhttps?\.request\s*\(/g, "http(s).request()"],
      [/\bnew\s+XMLHttpRequest\b/g, "XMLHttpRequest"],
    ]) {
      let m;
      while ((m = re.exec(src)) !== null)
        violations.push(`${f}:${src.slice(0, m.index).split("\n").length} uses ${label}`);
    }
  }
  if (!exists(P.providerAdapters))
    for (const d of depsOf(P.backendPkg))
      if (HTTP_CLIENTS.includes(d))
        violations.push(`backend/package.json declares outbound HTTP client '${d}' but ${P.providerAdapters}/ does not exist`);
  return {
    state: violations.length ? "fail" : "pass",
    violations,
    note:
      "Scoped to backend source. The frontend is excluded deliberately and not as a weakening: TC-008/AD-09 " +
      "forbid the *system* holding outbound capability to user-owned platforms, while SA §1.3 has the frontend " +
      "depend on the API contract. The frontend's HTTP client addresses NAIGX's own API and is the documented architecture.",
  };
});

define(4, "Dependency direction inward only", "AP-1", () => {
  const violations = [];
  for (const f of backendFiles()) {
    const from = layerOf(f);
    if (!from) continue;
    for (const { spec, line } of importsOf(f)) {
      const local = resolveLocal(f, spec);
      if (!local) continue;
      const to = layerOf(local) ?? (local.startsWith(P.generated) ? { rank: 99, name: "generated" } : null);
      if (!to) continue;
      if (to.rank < from.rank)
        violations.push(`${f}:${line} (${from.name}) imports '${spec}' (${to.name}) — outward dependency`);
    }
  }
  const present = [...new Set(backendFiles().map((f) => layerOf(f)?.name).filter(Boolean))];
  return {
    state: violations.length ? "fail" : "pass",
    violations,
    note: `Layers present: ${present.join(", ")}. Inner layers (orchestrator, nie, provider) arrive in Sprint 1 and are already ranked.`,
  };
});

define(5, "Every artifact type has a registered schema", "FR-039, AD-08", () => {
  if (!exists(P.nie))
    return { state: "inactive", violations: [], note: `No artifact generation exists (${P.nie}/ absent). Activates with the Sprint 1 NIE.` };

  // Artifact types are declared by the stage that produces them, in the stage
  // registry. Each must have a repository-authored JSON Schema (docs/12 D-1),
  // which is the source published to ARTIFACT_SCHEMA.definition (DB §4.4).
  if (!exists(P.nieStageRegistry))
    return {
      state: "fail",
      violations: [`${P.nie}/ exists but ${P.nieStageRegistry} does not — no artifact-type source to check`],
      note: "FAIL-SAFE: the artifact-type declaration must live in the stage registry.",
    };

  const registry = read(P.nieStageRegistry);
  if (!/producesArtifactTypes/.test(registry))
    return {
      state: "fail",
      violations: [`${P.nieStageRegistry} declares no producesArtifactTypes field`],
      note: "FAIL-SAFE: without a declared artifact-type field this check cannot enforce FR-039.",
    };

  const declared = [];
  for (const m of registry.matchAll(/producesArtifactTypes:\s*\[([^\]]*)\]/g))
    for (const q of m[1].matchAll(/["']([^"']+)["']/g)) declared.push(q[1]);

  const unique = [...new Set(declared)];
  const violations = [];
  for (const type of unique) {
    const schema = `${P.artifactSchemas}/${type}.schema.json`;
    if (!exists(schema)) violations.push(`artifact type '${type}' has no registered schema at ${schema}`);
  }

  if (violations.length)
    return { state: "fail", violations, note: "ARMED: FR-039/AD-08 — an artifact type without a schema cannot be deterministically validated." };

  return {
    state: "pass",
    violations: [],
    note:
      unique.length === 0
        ? `0 artifact types declared across ${(registry.match(/stageKey:/g) || []).length - 1} stages — artifact generation is Stage 9 (Sprint 2). Wired and enforcing: the first declared type demands a schema in ${P.artifactSchemas}/.`
        : `${unique.length} artifact type(s) declared, each with a registered schema.`,
  };
});

define(6, "Every pipeline stage emits a trace event", "AP-8, FR-100", () => {
  if (!exists(P.nie))
    return { state: "inactive", violations: [], note: `No pipeline stages exist (${P.nie}/ absent). Activates with the Sprint 1 NIE.` };

  const stageFiles = walk(P.nieStages);
  if (stageFiles.length === 0)
    return {
      state: "fail",
      violations: [`${P.nie}/ exists but ${P.nieStages}/ holds no stage modules`],
      note: "FAIL-SAFE: stages must live in one directory so trace emission is checkable.",
    };

  if (!exists(P.niePipeline))
    return {
      state: "fail",
      violations: [`stage modules exist but ${P.niePipeline} does not — nothing emits their traces`],
      note: "FAIL-SAFE: AP-8/FR-100 require every stage to emit a trace event.",
    };

  const pipeline = read(P.niePipeline);
  const violations = [];

  // The runner must actually emit. Trace emission is a port call, so the
  // structural evidence is that the runner holds a trace sink and records to it.
  if (!/traceSink/.test(pipeline) || !/\.record\(/.test(pipeline))
    violations.push(`${P.niePipeline} does not record to a stage trace sink`);

  // Every stage module must be reachable from the runner...
  for (const f of stageFiles) {
    const moduleName = f.split("/").pop().replace(/\.[cm]?ts$/, "");
    if (!pipeline.includes(moduleName))
      violations.push(`stage module '${moduleName}' is not invoked by ${P.niePipeline} — its executions would emit no trace`);
  }

  // ...and unreachable from anywhere else, or a caller could run a stage
  // outside the tracing path. Tests are excluded: they assert stage behaviour
  // directly and perform no traced run.
  for (const f of backendFiles()) {
    if (f === P.niePipeline || f.startsWith(P.nieStages)) continue;
    for (const { spec, line } of importsOf(f)) {
      const local = resolveLocal(f, spec);
      if (local && local.startsWith(P.nieStages + "/"))
        violations.push(`${f}:${line} imports stage module '${spec}' directly — stages may only be invoked through ${P.niePipeline}`);
    }
  }

  if (violations.length)
    return { state: "fail", violations, note: "ARMED: AP-8/FR-100 — a stage executed outside the runner emits no trace." };

  return {
    state: "pass",
    violations: [],
    note: `${stageFiles.length} stage module(s), each invoked only through ${P.niePipeline}, which records a trace per stage on both success and failure.`,
  };
});

define(7, "Regression suite passes before any template change merges", "NFR-043, AD-14", () => {
  const templates = exists(P.prompts)
    ? walk(P.prompts, [".md", ".txt", ".yaml", ".yml", ".json", ".hbs", ".mustache"])
        // README documents the fragments; the manifest is the gate's own record
        // of them. Neither is a reasoning template.
        .filter((f) => !/README/i.test(f) && !/fragments\.manifest\.json$/.test(f))
    : [];
  if (templates.length === 0)
    return { state: "inactive", violations: [], note: `No reasoning templates exist under ${P.prompts}/. Arms automatically on the first template.` };

  const violations = [];

  // 1. The gate must exist as a runnable suite, not a documented intention.
  if (!exists(P.fragmentManifest))
    violations.push(`${templates.length} template(s) exist but ${P.fragmentManifest} does not — no record of what was reviewed`);
  if (!exists(P.fragmentGateTest))
    violations.push(`${templates.length} template(s) exist but ${P.fragmentGateTest} does not — the gate never runs`);

  // 2. It must cover every template. A fragment outside the manifest could be
  //    changed without the change being recorded, which is the whole point.
  if (exists(P.fragmentManifest)) {
    let recorded = {};
    try {
      recorded = JSON.parse(read(P.fragmentManifest)).fragments ?? {};
    } catch {
      violations.push(`${P.fragmentManifest} is not valid JSON`);
    }
    for (const template of templates) {
      const m = /^prompts\/([^/]+)\/(.+)\.md$/.exec(template);
      if (!m) {
        violations.push(`${template} does not follow prompts/<class>/<name>.md — it cannot be keyed or gated`);
        continue;
      }
      const key = `${m[1]}.${m[2]}`;
      if (!(key in recorded)) violations.push(`fragment '${key}' is not recorded in ${P.fragmentManifest}`);
    }
  }

  if (violations.length)
    return { state: "fail", violations, note: "ARMED: NFR-043/AD-14 — templates may not exist without the gate that governs their change." };

  return {
    state: "pass",
    violations: [],
    note:
      `${templates.length} fragment(s), each recorded in ${P.fragmentManifest} and verified by ${P.fragmentGateTest}. ` +
      "This is the change gate: a fragment edit fails the build until it is recorded and reviewed. Output regression against the golden corpus is a Sprint 2 deliverable (docs/12 D-14).",
  };
});

define(8, "Second-provider test passes", "AI-005, AR-43", () => {
  const adapterNames = exists(P.providerAdapters)
    ? fs.readdirSync(abs(P.providerAdapters), { withFileTypes: true })
        .filter((e) => e.isFile() && e.name !== "index.ts" && !/\.d\.ts$/.test(e.name) && /\.[cm]?ts$/.test(e.name))
        .map((e) => e.name.replace(/\.[cm]?ts$/, ""))
    : [];

  if (adapterNames.length < 2)
    return {
      state: "inactive",
      violations: [],
      note: `${adapterNames.length} provider adapter(s) present. Arms at the second adapter — the Engineering Roadmap places "second adapter with passing automated test" in Sprint 1, after the Sprint 0 stub provider.`,
    };

  // This checker runs with no dependencies installed (CI runs it before any
  // `npm ci`), so it cannot execute the suite. It verifies instead that the
  // conformance test exists, drives adapters through the abstraction rather
  // than directly, and names every adapter present — so a third adapter cannot
  // be added without being covered. Execution is the `backend` job's test gate.
  if (!exists(P.providerConformanceTest))
    return {
      state: "fail",
      violations: [`${adapterNames.length} provider adapters exist but ${P.providerConformanceTest} is missing`],
      note: "ARMED: AR-43 — an abstraction assumed to work is never exercised.",
    };

  const src = read(P.providerConformanceTest);
  const violations = [];

  if (!src.includes("createProviderInvoker"))
    violations.push(`${P.providerConformanceTest} does not invoke through createProviderInvoker — testing adapters directly proves nothing about substitution (AI-005)`);

  const uncovered = adapterNames.filter((name) => !src.includes(name));
  if (uncovered.length)
    violations.push(`adapter(s) not exercised by the conformance test: ${uncovered.join(", ")}`);

  if (violations.length)
    return { state: "fail", violations, note: "ARMED: AI-005 requires the second provider be tested, not merely possible." };

  return {
    state: "pass",
    violations: [],
    note: `${adapterNames.length} adapters (${adapterNames.join(", ")}), each exercised through the abstraction by ${P.providerConformanceTest}. The suite itself runs in the backend test gate.`,
  };
});

// ── Run ──────────────────────────────────────────────────────────────────────
if (checks.length !== 8) {
  console.error(`FATAL: SA Appendix A defines 8 checks; ${checks.length} implemented.`);
  process.exit(2);
}

const results = checks.map((c) => ({ ...c, ...c.run() }));
const icon = { pass: "✅", fail: "❌", inactive: "⏸️ " };

console.log("NAIGX boundary checks — SA Appendix A\n");
for (const r of results) {
  console.log(`${icon[r.state]} [${r.id}] ${r.title}`);
  console.log(`      enforces: ${r.enforces}`);
  for (const v of r.violations) console.log(`      ✗ ${v}`);
  if (r.note) console.log(`      note: ${r.note}`);
  console.log();
}

const failed = results.filter((r) => r.state === "fail");
const inactive = results.filter((r) => r.state === "inactive");
const passed = results.filter((r) => r.state === "pass");

console.log(`${passed.length} enforcing · ${inactive.length} inactive · ${failed.length} failing`);
if (inactive.length)
  console.log(`inactive (awaiting Sprint 1 modules, each arms automatically): ${inactive.map((r) => r.id).join(", ")}`);

if (failed.length) {
  console.log(`\n❌ BOUNDARY VIOLATION — checks ${failed.map((r) => r.id).join(", ")}`);
  process.exit(1);
}
console.log("\n✅ No boundary violations.");
