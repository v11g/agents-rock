# Extract — client inputs to quoted facts

Read at SKILL.md step 3, before the interview, on every run: it asks for
client material (§2) and turns it into quoted facts (§3).

## 1. Inputs

- Client files live in `inputs/` beside ARCHITECTURE.md, unless the user
  points elsewhere — then cite them where they are.
- Each file has an ID: `C` call, `E` email, `N` note, `D` other document,
  numbered per kind in date order (`C1`, `C2`, `E1`). Named
  `<ID>-<slug>.<txt|md>` when the skill files them; an existing name is
  kept and the ID recorded on the `**Inputs**` line of `interview-log.md` instead.
- The skill reads inputs, never edits them (hard rule 5: not ours).

## 2. Ask for inputs

Evidence before questions: a fact quoted from a client file is checked word
for word, while a fact from an interview answer is only as good as the
answer. So unless files were given or `inputs/` already holds files, the
run's first card asks for them. It is one card in its own `AskUserQuestion`
call, and it counts toward the interview's 12-question cap:

- Question: "Client material makes this document stronger: every fact taken
  from it carries a checked quote. Do you have call transcripts, emails,
  notes or specs?"
- Options, in this order:
  1. `Added to inputs/ — continue (Recommended)` → list `inputs/`, give
     each file its ID (§1), then run §3.
  2. `The brief is in my message — save it` → §2.1, then §3.
  3. `None — interview only` → log the answer. The final report says
     `0 input files: <n> stated facts cite the interview only`.
- If option 1 is picked but `inputs/` is still empty, say so and continue
  as option 3.
- If the user said not to ask, show no card. A brief in the opening message
  is still saved per §2.1. With no brief, continue as option 3.

### 2.1 Saving a brief from chat

Write the part of the user's message that describes the project to
`inputs/N<n>-brief.md`, using the next free `N` number. Copy it exactly as
the user wrote it: no heading, no summary, no fixes. Date it the day it
arrived. From then on it is an input like any other: extracted (§3), never
edited, never recorded or drift-gated. A later brief gets the next number
and never overwrites an earlier one.

## 3. Run

Skip this section when there are no input files.

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

## 4. Follow-up questions

When writing needs something the facts do not cover ("what does C1 say
about hosting?"), invoke `extract.js` with that one file and
`question: '<the question>'`, then `check-quotes` its facts. One file, one
question — never re-extract everything.

## 5. Using the facts

- A verified fact is `stated`, cited
  `stated [<src> · <date>](<path relative to ARCHITECTURE.md>) "<quote>"`.
- Quality-goal candidates (`quality-goals.md`) come from facts whose
  `section` is `quality…`; the quote becomes the `Brief says` cell.
- Research (`research.md`) gets `statedFacts: [{ claim: fact }]` as before;
  keep each fact's citation yourself and write it back — research never
  changes a citation.
