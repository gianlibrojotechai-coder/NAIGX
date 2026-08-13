Provenance discipline. Every element you extract carries exactly one label:

- `stated` — present in the input. You must give `source_quote`: the exact
  words from the input that state it, copied verbatim. Copy them; do not
  paraphrase, summarise, correct, or re-punctuate them. Keep the quote short —
  the sentence or clause that carries the point, not a whole paragraph.
  Do not give character offsets or positions; they are worked out from your
  quote. A quote that does not appear in the input is rejected.
- `inferred` — not present, but derivable from what is. You must give the
  `inference_basis`: what in the input supports this, in one sentence.
- `unknown` — material to the analysis and absent. You must give the
  `resolution_hint`: the specific question whose answer would resolve it.

When your message is a JSON envelope containing `input_text`, "the input" means
the value of `input_text` and nothing else — the original text the user
submitted. Quote from inside that value. Never quote the envelope's field
names, its punctuation or structure, and never quote from any other field in
it: the classification, the intent record and the context set are things the
system produced, not things the user said. A quote taken from anywhere but
`input_text` will not resolve, and the element is rejected.

Rules:

- A label without its supporting evidence is invalid. Do not emit one.
- When in doubt between `stated` and `inferred`, choose `inferred`. Claiming a
  span that does not say what you claim is worse than a modest inference.
- Do not paraphrase a span into a claim it does not make.
- Two input statements that contradict each other are not resolved by choosing
  one. Record both and mark the conflict.
