import type { Analysis } from "./api/types";

/**
 * D-93 — the one-page presentation exists for the job-description path only.
 * Kept out of the component file so fast refresh sees a components-only
 * module.
 */
export const hasPresentation = (analysis: Analysis): boolean => {
  const type =
    analysis.classification?.user_override_type ??
    analysis.classification?.determined_type ??
    null;
  return type === "job_description" && analysis.verdict !== null;
};
