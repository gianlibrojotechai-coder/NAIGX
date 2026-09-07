/**
 * The `mermaid_diagram` artifact — the architecture, drawn.
 *
 * WHY THE SOURCE IS ALWAYS AVAILABLE. Rendering can fail: Mermaid parses the
 * source at runtime, and a diagram that will not parse is a real outcome
 * rather than an impossible one. When it fails, the source is shown instead of
 * a blank box — `FR-091` treats an unexplained gap as the failure mode worth
 * preventing, and the source is still usable in any Mermaid renderer. The
 * source is also offered alongside a successful render, because the whole
 * point of this artifact is that the user hands it to someone else.
 *
 * WHY THE LIBRARY IS LOADED LAZILY. Mermaid is large and only one of four
 * paths produces a diagram. A dynamic import keeps it out of the main bundle,
 * so a job-description analysis never pays for a renderer it will not use.
 */

import { useEffect, useId, useRef, useState } from "react";

import type { MermaidDiagram } from "../api/types";
import { Badge } from "./ui";

type RenderState =
  | { readonly status: "rendering" }
  | { readonly status: "rendered"; readonly svg: string }
  | { readonly status: "failed"; readonly reason: string };

export function MermaidDiagramView({ diagram }: { diagram: MermaidDiagram }) {
  const [state, setState] = useState<RenderState>({ status: "rendering" });
  const [showSource, setShowSource] = useState(false);
  const sourceId = useId();
  // Mermaid needs a DOM id unique per render; `useId` produces colons, which
  // are not valid in the CSS selectors Mermaid builds internally.
  const domId = useRef(
    `mermaid-${Math.random().toString(36).slice(2, 10)}`,
  ).current;

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          // `strict` keeps any HTML in a node label as text. Labels come from
          // component names, which are model-authored free text, so treating
          // them as markup would be trusting the wrong thing.
          securityLevel: "strict",
          theme: "neutral",
          flowchart: { useMaxWidth: true },
        });
        const { svg } = await mermaid.render(domId, diagram.diagram);
        if (!cancelled) setState({ status: "rendered", svg });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "failed",
          reason:
            error instanceof Error
              ? error.message
              : "The diagram source could not be rendered.",
        });
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [diagram.diagram, domId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          {diagram.node_count} node{diagram.node_count === 1 ? "" : "s"}
        </Badge>
        <span className="text-xs text-slate-600">
          Nodes match the architecture components by construction — the diagram
          is rendered from them, not written alongside them.
        </span>
      </div>

      {state.status === "rendering" && (
        <p className="text-sm text-slate-500 italic">Rendering the diagram…</p>
      )}

      {state.status === "rendered" && (
        <div
          className="border border-slate-200 rounded-md bg-white p-4 overflow-x-auto"
          // The SVG is produced by Mermaid from stored source, under
          // `securityLevel: "strict"`, which escapes label content rather than
          // interpreting it. There is no other way to mount an SVG string.
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      )}

      {state.status === "failed" && (
        <div className="border border-amber-300 bg-amber-50 rounded-md p-4">
          <h4 className="font-medium text-amber-900">
            The diagram could not be drawn
          </h4>
          <p className="text-sm text-amber-900 mt-1">
            The stored source is shown below and remains usable in any Mermaid
            renderer. Reported: {state.reason}
          </p>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => {
            setShowSource((value) => !value);
          }}
          aria-expanded={showSource || state.status === "failed"}
          aria-controls={sourceId}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
        >
          {showSource ? "Hide" : "Show"} Mermaid source
        </button>
        {(showSource || state.status === "failed") && (
          <pre
            id={sourceId}
            className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto text-slate-800"
          >
            {diagram.diagram}
          </pre>
        )}
      </div>
    </div>
  );
}
