/**
 * Shared presentation primitives.
 *
 * Two rules are enforced here rather than repeated in every view:
 *
 *   · **Provenance is never colour alone** (`NFR-063`). Every provenance badge
 *     carries a word and a glyph as well as a tint, so the distinction
 *     survives greyscale, colour blindness and a screen reader.
 *   · **Absence is stated, not hidden** (`FR-044`, `FR-045`). `Unavailable`
 *     exists so a null field renders as an explicit "not available, and here
 *     is why" rather than vanishing — a missing section and a section with
 *     nothing in it are different facts.
 */

import { useId, useState, type ReactNode } from "react";

import type { Provenance } from "../api/types";

/** A collapsible result section (`FR-040` — individually collapsible). */
export function Section({
  title,
  step,
  subtitle,
  children,
  defaultOpen = true,
  accent,
  action,
}: {
  title: string;
  step: number;
  subtitle?: string | undefined;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Non-interactive marker — a badge. Rendered inside the toggle. */
  accent?: ReactNode;
  /**
   * An interactive control, rendered *beside* the toggle rather than inside it.
   *
   * ⚠️ It cannot go in `accent`. A button nested inside the header button is
   * invalid HTML, and the browser resolves it by breaking one of the two — so
   * a copy control placed there would either not fire or would collapse the
   * section instead of copying.
   */
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <h2 className="flex items-center">
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex-1 min-w-0 flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-inset"
        >
          <span className="shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-semibold grid place-items-center">
            {step}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-slate-900">{title}</span>
            {subtitle !== undefined && (
              <span className="block text-sm text-slate-500 mt-0.5">
                {subtitle}
              </span>
            )}
          </span>
          {accent}
          <span
            aria-hidden="true"
            className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
        </button>
        {action !== undefined && (
          <span className="shrink-0 pr-5 pl-2">{action}</span>
        )}
      </h2>
      {open && (
        <div id={contentId} className="px-5 pb-5 pt-1">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * A provenance marker.
 *
 * `unknown` is a provenance the store actually uses — it is how an unresolved
 * element is recorded — so it gets a treatment of its own rather than being
 * folded into "inferred", which would overstate what the analysis knows.
 */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const style =
    provenance === "stated"
      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
      : provenance === "inferred"
        ? "bg-amber-50 text-amber-900 border-amber-300"
        : "bg-slate-100 text-slate-700 border-slate-300";
  const glyph =
    provenance === "stated" ? "✓" : provenance === "inferred" ? "~" : "?";

  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 border rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${style}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {provenance}
    </span>
  );
}

/** The legend `FR-043` requires, so the treatment needs no tutorial. */
export function ProvenanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span className="font-medium">How to read provenance:</span>
      <span className="inline-flex items-center gap-1.5">
        <ProvenanceBadge provenance="stated" /> written in the job description
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ProvenanceBadge provenance="inferred" /> derived, not written
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ProvenanceBadge provenance="unknown" /> not determinable from the input
      </span>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger" | "warning" | "success" | "info";
}) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700 border-slate-300",
    danger: "bg-rose-50 text-rose-900 border-rose-300",
    warning: "bg-amber-50 text-amber-900 border-amber-300",
    success: "bg-emerald-50 text-emerald-900 border-emerald-300",
    info: "bg-sky-50 text-sky-900 border-sky-300",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 border rounded px-2 py-0.5 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * States that something is not available, and why.
 *
 * Used wherever the store holds null. The alternative — omitting the section —
 * would let a reader assume the question was never asked.
 */
export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-slate-500 italic border-l-2 border-slate-300 pl-3 py-1">
      {children}
    </p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}
