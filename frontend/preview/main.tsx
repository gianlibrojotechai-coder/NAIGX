/**
 * A standalone render of the D-93 presentation with sample data, for looking
 * at the design without a backend. Not shipped: `vite build preview` only.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import "./preview.css";
import { AmbientBackground } from "../src/components/AmbientBackground";
import { AnalysisView } from "../src/components/AnalysisView";
import { JobPresentation } from "../src/components/JobPresentation";
import { sample } from "./sample";

export function Preview() {
  const [full, setFull] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50">
      <AmbientBackground />
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-sky-700 bg-clip-text text-transparent">
              NAIGX
            </span>
          </h1>
          <p className="text-sm text-slate-600">
            A decision, then the reasoning behind it.
          </p>
          <span className="ml-auto rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900">
            Preview · sample data
          </span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Result view"
            className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm font-medium"
          >
            {(
              [
                ["presentation", "Presentation"],
                ["full", "Full analysis"],
              ] as const
            ).map(([key, label]) => {
              const active = (key === "full") === full;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFull(key === "full");
                  }}
                  className={`rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {full ? (
          <AnalysisView analysis={sample} />
        ) : (
          <JobPresentation
            analysis={sample}
            onShowFull={() => {
              setFull(true);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
