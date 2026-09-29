/**
 * The app catalogue and the owner's per-analysis app choices (D-94).
 *
 * The catalogue is every integration n8n ships, generated from n8n's own node
 * package by `scripts/app-catalogue.mjs` — so "all available apps" is a real
 * list, not one the model invents, and every app the owner picks is one the
 * n8n download can wire. Choices live in this browser only (`localStorage`,
 * keyed by analysis id): they are the owner's edits to a presentation, not
 * part of the stored analysis, and the page says so.
 */

import { APP_CATALOGUE } from "./app-catalogue";
import { humanise } from "./format";

export interface CatalogueApp {
  readonly type: string;
  readonly name: string;
  readonly categories: readonly string[];
  readonly version: number;
  readonly trigger: boolean;
  readonly docs: string | null;
}

export const CATALOGUE: readonly CatalogueApp[] = APP_CATALOGUE.apps;
export const CATALOGUE_SOURCE = APP_CATALOGUE.source;

const byType = new Map<string, CatalogueApp>(
  CATALOGUE.map((app) => [app.type, app]),
);

export const appByType = (type: string): CatalogueApp | null =>
  byType.get(type) ?? null;

/** n8n's generic building blocks are not "apps you will use". */
const BUILDING_BLOCK_CATEGORIES = new Set(["Core Nodes", "Utility"]);
const BUILDING_BLOCK_TYPES = new Set([
  "n8n-nodes-base.noOp",
  "n8n-nodes-base.stickyNote",
  "n8n-nodes-base.manualTrigger",
]);

export const isBuildingBlock = (app: CatalogueApp): boolean =>
  BUILDING_BLOCK_TYPES.has(app.type) ||
  (app.categories.length > 0 &&
    app.categories.every((c) => BUILDING_BLOCK_CATEGORIES.has(c)));

/**
 * The app behind an n8n node type, as a person would name it. A catalogue
 * hit wins; anything else — a community node, a type newer than the
 * catalogue — is cleaned up rather than dropped. `null` for the two node
 * types that carry no app at all.
 */
export const appNameForType = (type: string): string | null => {
  if (type === "n8n-nodes-base.noOp" || type === "n8n-nodes-base.stickyNote")
    return null;
  const hit = byType.get(type);
  if (hit !== undefined) return hit.name.replace(/ Trigger$/, "");
  const bare = type
    .replace(/^@?[\w-]+\/[\w-]+\./, "")
    .replace(/^n8n-nodes-base\./, "")
    .replace(/Trigger$/, "");
  if (/agent|lmChat|anthropic|gemini|openAi/i.test(bare)) return "AI model";
  return humanise(bare.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());
};

/** Categories in the order the picker lists them: apps first, plumbing last. */
export const categoriesInOrder = (): readonly string[] => {
  const counts = new Map<string, number>();
  for (const app of CATALOGUE) {
    for (const c of app.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      const aBlock = BUILDING_BLOCK_CATEGORIES.has(a[0]) ? 1 : 0;
      const bBlock = BUILDING_BLOCK_CATEGORIES.has(b[0]) ? 1 : 0;
      if (aBlock !== bBlock) return aBlock - bBlock;
      return b[1] - a[1];
    })
    .map(([name]) => name);
};

export const searchApps = (
  query: string,
  category: string | null,
  triggersOnly: boolean,
): readonly CatalogueApp[] => {
  const q = query.trim().toLowerCase();
  return CATALOGUE.filter((app) => {
    if (triggersOnly && !app.trigger) return false;
    if (category !== null && !app.categories.includes(category)) return false;
    if (q === "") return true;
    return (
      app.name.toLowerCase().includes(q) ||
      app.type.toLowerCase().includes(q) ||
      app.categories.some((c) => c.toLowerCase().includes(q))
    );
  });
};

// --- the owner's choices ----------------------------------------------------

/** Step index → catalogue node type. */
export type AppChoices = Readonly<Record<string, string>>;

const key = (analysisId: string) => `naigx.presentation.apps.${analysisId}`;

export const loadChoices = (analysisId: string): AppChoices => {
  try {
    const raw = window.localStorage.getItem(key(analysisId));
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && byType.has(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
};

export const saveChoices = (analysisId: string, choices: AppChoices): void => {
  try {
    if (Object.keys(choices).length === 0) {
      window.localStorage.removeItem(key(analysisId));
    } else {
      window.localStorage.setItem(key(analysisId), JSON.stringify(choices));
    }
  } catch {
    // A private window or blocked storage: the choice still applies to this
    // page view, it just will not survive a reload.
  }
};
