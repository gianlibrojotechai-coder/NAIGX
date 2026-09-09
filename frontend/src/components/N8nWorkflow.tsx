/**
 * `n8n_workflow` — the importable scaffold, with the guide beside it (D-71).
 *
 * Two things a person needs here: the file, and the same notes the file
 * carries, readable before importing. The download is the artifact itself,
 * serialised as n8n reads it; nothing is re-shaped on the client.
 */

import { useState } from "react";

import type { N8nWorkflow } from "../api/types";
import { Badge } from "./ui";

const noteBody = (content: string): string[] =>
  content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.replace(/^#+\s*/, "").replace(/\*\*/g, ""));

export function N8nWorkflowView({
  workflow,
  analysisId,
}: {
  workflow: N8nWorkflow;
  analysisId: string;
}) {
  const [saved, setSaved] = useState(false);
  const stepNodes = workflow.nodes.filter(
    (node) => node.type !== "n8n-nodes-base.stickyNote",
  );
  const notes = workflow.nodes.filter(
    (node) => node.type === "n8n-nodes-base.stickyNote",
  );
  const stepNotes = notes.filter((note) => note.name.startsWith("Note — step"));
  const wiring = notes.find((note) => note.name === "Wiring notes");

  const download = () => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `naigx-n8n-workflow-${analysisId}.json`;
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">
          A scaffold, not a finished workflow
        </p>
        <p className="mt-1 text-sm text-amber-900">
          The node types and the wiring import as-is. Every node&apos;s
          parameters are still at their defaults: open each node and set it up
          from the note beside it. {String(workflow.naigx.steps_mapped)} of{" "}
          {String(stepNodes.length)} steps mapped to a known n8n node
          {workflow.naigx.steps_unmapped.length > 0
            ? `; placeholders for: ${workflow.naigx.steps_unmapped.join(", ")}.`
            : "."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={download}
          className="px-4 py-2 rounded-md bg-accent-400 text-slate-50 font-mono text-sm font-semibold uppercase tracking-[0.12em] hover:bg-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-300"
        >
          Download for n8n ↓
        </button>
        <p className="text-sm text-slate-600">
          {saved
            ? "Saved. In n8n: Workflows → Import from File, then follow the notes left to right."
            : "A .json file. In n8n: Workflows → Import from File."}
        </p>
      </div>

      <ol className="space-y-2">
        {stepNodes.map((node, index) => {
          const note = stepNotes[index];
          const placeholder = node.type === "n8n-nodes-base.noOp";
          return (
            <li
              key={node.name}
              className="rounded-md border border-slate-200 bg-slate-100 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden="true"
                  className="shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-semibold grid place-items-center"
                >
                  {index + 1}
                </span>
                <span className="font-mono text-sm font-semibold text-accent-300">
                  {node.name}
                </span>
                <Badge tone={placeholder ? "warning" : "neutral"}>
                  {placeholder
                    ? "replace this placeholder"
                    : node.type.replace("n8n-nodes-base.", "")}
                </Badge>
              </div>
              {note !== undefined && (
                <ul className="mt-1.5 ml-7 space-y-0.5 text-sm text-slate-700">
                  {noteBody(String(note.parameters["content"] ?? ""))
                    .slice(1)
                    .map((line, i) => (
                      <li key={`${node.name}-${String(i)}`}>{line}</li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {wiring !== undefined && (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wiring notes
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {noteBody(String(wiring.parameters["content"] ?? ""))
              .slice(1)
              .map((line, i) => (
                <li key={String(i)}>{line.replace(/^-\s*/, "")}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
