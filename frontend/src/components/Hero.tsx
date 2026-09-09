/**
 * The opening (D-68 §3, owner's reference: a near-black ground, one large
 * headline with a single italic accent word, annotation chips drifting
 * around it, a floating status card, a mono-caps call to action).
 *
 * Built from NAIGX's own world rather than anyone's brand: the chips are the
 * reasoning stages that will touch the input, and the floating card is a
 * real verdict from the recorded corpus (jd-002, the build_first case). Every
 * word on the card is a stored field, so the hero never promises a result
 * the pipeline does not produce.
 *
 * The moving parts are CSS: the chips drift on slow independent orbits, the
 * accent word gets a selection frame that draws itself, the card's rows tick
 * in. All of it stops under `prefers-reduced-motion: reduce`, and none of
 * it is read by assistive technology — the chips and the card are
 * `aria-hidden`, and the headline and paragraph carry the meaning.
 */

const CHIPS: readonly {
  label: string;
  tone: string;
  className: string;
  delay: number;
}[] = [
  {
    label: "Reader · Stage 1",
    tone: "border-sky-700 text-sky-800",
    className: "left-[1%] top-[10%]",
    delay: 0,
  },
  {
    label: "Analyst · Stage 3",
    tone: "border-amber-700 text-amber-800",
    className: "left-[46%] top-[2%]",
    delay: 1.8,
  },
  {
    label: "Judge · Stage 7",
    tone: "border-rose-600 text-rose-700",
    className: "left-[6%] bottom-[8%]",
    delay: 3.4,
  },
  {
    label: "Builder · Stage 9",
    tone: "border-emerald-600 text-emerald-700",
    className: "left-[40%] bottom-[4%]",
    delay: 2.6,
  },
];

export function Hero() {
  return (
    <div className="relative isolate overflow-hidden rounded-xl px-6 pt-14 pb-10 sm:px-10 sm:pt-20">
      {/* The drifting chips — decoration with a cursor, like a shared canvas. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CHIPS.map((chip, index) => (
          <div
            key={chip.label}
            className={`drift absolute hidden sm:block ${chip.className}`}
            style={{
              ["--i" as string]: index + 2,
              ["--drift-delay" as string]: `${String(chip.delay)}s`,
            }}
          >
            <span
              className={`rise inline-flex items-center gap-1.5 rounded-md border bg-slate-50/80 px-2.5 py-1 font-mono text-[12px] tracking-wide ${chip.tone}`}
              style={{ ["--i" as string]: index + 2 }}
            >
              <span className="cursor-glyph" />
              {chip.label}
            </span>
          </div>
        ))}
      </div>

      <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="max-w-2xl">
          <h2
            className="rise text-5xl font-semibold leading-[1.05] tracking-tight text-slate-950 sm:text-6xl xl:text-7xl"
            style={{ ["--i" as string]: 0, textWrap: "balance" }}
          >
            Decide first, then{" "}
            <span className="selection-frame relative inline-block px-2">
              <em className="not-italic italic font-serif text-accent-300">
                build
              </em>
            </span>
            .
          </h2>
          <p
            className="rise mt-6 max-w-xl text-lg text-slate-600"
            style={{ ["--i" as string]: 1 }}
          >
            Paste a job posting, a business problem, a workflow, or a design
            brief. NAIGX works out which it is, reasons it through, and shows
            you the conclusion first — with everything it rests on one click
            below.
          </p>
        </div>

        {/* A real verdict from the recorded corpus, as a card beside the text. */}
        <div
          aria-hidden="true"
          className="rise lift pointer-events-none hidden w-72 justify-self-end rounded-lg border border-slate-200 bg-white p-4 text-left shadow-2xl lg:block"
          style={{ ["--i" as string]: 5 }}
        >
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Verdict · job description
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-800">
            {[
              ["intent_brief", "generated", 6],
              ["skill gaps", "2 decisive", 7],
              ["portfolio_suggestions", "generated", 8],
            ].map(([name, state, i]) => (
              <li
                key={String(name)}
                className="rise flex items-center gap-2"
                style={{ ["--i" as string]: Number(i) }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <span className="font-mono text-[12px]">{name}</span>
                <span className="ml-auto text-xs text-slate-500">{state}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[11px] text-slate-500">
              5 stages · 217 s
            </span>
            <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-900">
              build first
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
