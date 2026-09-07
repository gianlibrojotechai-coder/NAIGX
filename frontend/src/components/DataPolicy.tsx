/**
 * Data handling policy (`NFR-031`, `PRD O-5`, `DBQ-2`, `DBQ-7`).
 *
 * ⚠️ `NFR-031` REQUIRES THIS TO BE REACHABLE **BEFORE FIRST SUBMISSION**, not
 * merely to exist somewhere. A policy linked only from a footer on a results
 * page is published after the decision it was meant to inform. The link lives
 * beside the submission form for that reason.
 *
 * ⚠️ EVERY NUMBER HERE IS THE REAL CONFIGURED VALUE, and each one is load
 * bearing:
 *
 *   · 7 days  — stage traces (`DB §8.3`), unclaimed anonymous analyses
 *               ([D-45](../../../docs/20-D-45-Anonymous-Expiry-And-Token-Lifetime.md)),
 *               and the **backup window** (`DBQ-7`,
 *               [D-51](../../../docs/26-D-51-Self-Hosted-PostgreSQL.md)).
 *   · 30 days — provider invocation and validation records, which hold no
 *               user content (`DB §8.3`).
 *   · 24 hours — the trace-purge window quoted by `API-011`/`API-023`.
 *
 * ⚠️ THE BACKUP WINDOW IS THE ONE MOST EASILY LEFT OUT, AND OMITTING IT WOULD
 * MAKE THE DELETION PROMISE FALSE. `DB §12.4` and `DBQ-7` are explicit:
 * deletion is immediate in the live database, and a copy persists in backups
 * for up to 7 more days. Saying "deleted permanently" without that is a
 * statement the system does not honour.
 *
 * Written as plain prose rather than legal boilerplate. `NFR-031` asks for the
 * policy to be *accessible*, and a page nobody can read has not been published
 * in any sense that matters.
 */

import { useEffect, useRef } from "react";

export function DataPolicy({ onClose }: { onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus moves to the heading when the panel opens, so a screen-reader user
  // lands on the policy rather than being left where they were. `M-17`.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="data-policy-heading"
      className="rounded-lg border border-slate-300 bg-white p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <h2
          id="data-policy-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          How your data is handled
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <p className="text-sm text-slate-700">
        This describes what actually happens to what you submit. The retention
        periods below are the values the system is configured with, not
        intentions.
      </p>

      <section aria-labelledby="dp-what" className="space-y-2">
        <h3 id="dp-what" className="font-semibold text-slate-900">
          What is stored
        </h3>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>
            The text you submit, and the analysis produced from it.
          </li>
          <li>
            If you have an account: your email address, and a record of when you
            signed in — including a <strong>one-way hash</strong> of your IP
            address. The address itself is never stored.
          </li>
          <li>
            Reasoning traces — the intermediate steps behind an analysis, kept
            so a bad result can be diagnosed without re-running it.
          </li>
        </ul>
      </section>

      <section aria-labelledby="dp-encryption" className="space-y-2">
        <h3 id="dp-encryption" className="font-semibold text-slate-900">
          Encryption
        </h3>
        <p className="text-sm text-slate-700">
          Your submitted text and the reasoning traces are encrypted in the
          database, using a key held by a managed key service rather than on the
          server itself. Someone who obtained a copy of the database would not
          thereby obtain your content.
        </p>
      </section>

      <section aria-labelledby="dp-retention" className="space-y-2">
        <h3 id="dp-retention" className="font-semibold text-slate-900">
          How long it is kept
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-700">
            <caption className="sr-only">
              Retention periods by data type
            </caption>
            <thead>
              <tr className="border-b border-slate-300">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  What
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Kept for
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <th scope="row" className="py-2 pr-4 font-normal">
                  Your analyses, while your account exists
                </th>
                <td className="py-2">
                  Until you delete them, or delete your account
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <th scope="row" className="py-2 pr-4 font-normal">
                  An analysis made without an account, never claimed
                </th>
                <td className="py-2">7 days, then deleted automatically</td>
              </tr>
              <tr className="border-b border-slate-200">
                <th scope="row" className="py-2 pr-4 font-normal">
                  Reasoning traces (contain your submitted content)
                </th>
                <td className="py-2">7 days</td>
              </tr>
              <tr className="border-b border-slate-200">
                <th scope="row" className="py-2 pr-4 font-normal">
                  Timing and cost records (contain no content of yours)
                </th>
                <td className="py-2">30 days</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-4 font-normal">
                  Database backups
                </th>
                <td className="py-2">7 days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="dp-deletion" className="space-y-2">
        <h3 id="dp-deletion" className="font-semibold text-slate-900">
          When you delete something
        </h3>
        <p className="text-sm text-slate-700">
          Deletion is immediate and permanent in the live database — there is no
          recycle bin and no soft delete. Reasoning traces are removed
          separately, within 24 hours.
        </p>
        <p className="text-sm text-slate-700">
          <strong>
            A copy may persist in encrypted backups for up to 7 more days.
          </strong>{" "}
          Backups exist so the service can be restored after a failure, and they
          cannot be edited to remove one record. After 7 days the backup
          containing it is deleted automatically, and the content is gone.
        </p>
      </section>

      <section aria-labelledby="dp-ai" className="space-y-2">
        <h3 id="dp-ai" className="font-semibold text-slate-900">
          AI models and training
        </h3>
        <p className="text-sm text-slate-700">
          Your content is <strong>never used to train any model</strong>. When
          an analysis runs against a live model provider, your submitted text is
          sent to that provider to produce the result and for no other purpose.
        </p>
      </section>

      <section aria-labelledby="dp-control" className="space-y-2">
        <h3 id="dp-control" className="font-semibold text-slate-900">
          What you can do
        </h3>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Export everything held about you, in a machine-readable form.</li>
          <li>Delete any analysis, or all of them at once.</li>
          <li>
            Delete your account, which removes your analyses and their traces.
          </li>
        </ul>
        <p className="text-sm text-slate-600">
          All three are in your account settings. None of them requires
          contacting anyone.
        </p>
      </section>
    </section>
  );
}
