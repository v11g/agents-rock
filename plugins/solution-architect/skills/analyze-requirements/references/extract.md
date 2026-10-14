# Extract — client inputs to quoted facts

Read at SKILL.md step 3, before the interview, whenever the user supplies
client material (call transcripts, emails, notes, documents).

## 1. Inputs

- Client files live in `inputs/` beside ARCHITECTURE.md, unless the user
  points elsewhere — then cite them where they are.
- Each file has an ID: `C` call, `E` email, `N` note, `D` other document,
  numbered per kind in date order (`C1`, `C2`, `E1`). Named
  `<ID>-<slug>.<txt|md>` when the skill files them; an existing name is
  kept and the ID recorded on the `**Inputs**` line of `interview-log.md` instead.
- The skill reads inputs, never edits them (hard rule 5: not ours).

## 2. Run

1. Invoke `workflows/extract.js` with
   `args = { files: [{ id, path: <absolute>, date: 'YYYY-MM-DD' }] }`.
   **Never read an input file into the main context yourself.**
2. Save the returned `facts` as `{ "facts": [...] }` to a temp file and run
   `node scripts/check-quotes.mjs --facts <tmp>/facts.json --out <tmp>/checked.json`.
3. Exit 1: re-invoke `extract.js` once, with only the files that missed and
   `fix: <that file's misses>` on each. Append the returned facts to
   `checked.json`'s `facts`, run `check-quotes` again on them, and stop.
   Whatever still misses is dropped.
4. Surface `dropped` (from `extract.js`) and the dropped misses to the user
   before the interview, as research does (`research.md` §4).

## 3. Follow-up questions

When writing needs something the facts do not cover ("what does C1 say
about hosting?"), invoke `extract.js` with that one file and
`question: '<the question>'`, then `check-quotes` its facts. One file, one
question — never re-extract everything.

## 4. Using the facts

- A verified fact is `stated`, cited
  `stated [<src> · <date>](<path relative to ARCHITECTURE.md>) "<quote>"`.
- Quality-goal candidates (`quality-goals.md`) come from facts whose
  `section` is `quality…`; the quote becomes the `Brief says` cell.
- Research (`research.md`) gets `statedFacts: [{ claim: fact }]` as before;
  keep each fact's citation yourself and write it back — research never
  changes a citation.
