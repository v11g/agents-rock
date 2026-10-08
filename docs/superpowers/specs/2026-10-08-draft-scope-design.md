# draft-scope — draft a workflow-based scope document from raw client input

Status: design approved in chat 2026-10-08; this spec awaits review.
Branch: `feat/draft-scope` (from `main` at `220b690`).

## Summary

Today a PO (product owner at Code Engine Studio) reads a client's emails and
call notes and writes, by hand, a scope document in the shape of
`SinKowaWorkflows.docx`: systems, their workflow steps, features,
assumptions and exclusions. The `business-analyst` skill (BA) then copies
that document's lists as confirmed.

`draft-scope` is a new, standalone skill in the `business-analyst` plugin
that does the PO's first pass. It turns raw client input into an editable
DOCX draft in the same shape. The PO edits the draft in Word or Google Docs
and then uses it as they use a hand-written document today.

```
emails / call transcripts ──[draft-scope]──► draft-scope.docx ──PO edits──► (PO's document) ──► BA ──► estimate ──► proposal
```

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | New skill `draft-scope`, sibling of `business-analyst` in the same plugin. Fully standalone: no shared files, no reading the BA's references, no cross-skill tests. | User choice. The BA keeps its rule never to draft systems, workflows or features; the PO stays author of record. |
| D2 | Runs on claude.ai (primary) and Claude Code. Scripts are Python 3 standard library only. | claude.ai sandbox has Python, no Node, no browser; no third-party package can be assumed. |
| D3 | Workflows are text step lines (`Order In → Pack → Pack Review → Shipped`), never images. | Editable in both Word and Google Docs. |
| D4 | No questions to the PO, before or during drafting. Every gap becomes an item in "Questions for the client". | User choice. The BA interviews the PO later on the edited document; asking twice wastes the PO's time. |
| D5 | Method: Discover → Define (first diamond of the Double Diamond) → one single draft → script check → build. No alternative drafts. | The PO's edit is the decision; alternatives only lengthen the read. |
| D6 | Every line in the draft cites a numbered source (E1 email, C1 call, N1 note). Quotes are exact words. Unsourced content is cut. | The PO must be able to trust and trace every line. |
| D7 | A note at the top: the draft only holds what the client said; the PO adds value-add features while editing. | A sourced-only draft is thinner than a hand-written one (e.g. no "AI intake pre-fill"); the note sets that expectation. |
| D8 | One skill folder with step files acting as sub-skills; SKILL.md says which file to read at each step. | On claude.ai each skill is a separate upload and skills cannot reliably call each other; files inside one upload always travel together. |
| D9 | Borrowed ideas are written in our own words; credits in `references/credits.md`. No SKILL.md copied. | Only a few lines of each source apply; copying would import experiments, scoring and action items we deliberately leave out. |

### Borrowed techniques

| Step | Technique | Source | What we take / leave |
| --- | --- | --- | --- |
| Discover | per-source note template | phuryn/pm-skills `summarize-interview` (MIT) | Take the template (date, who, background, current way, what they like, problems, quotes, action items→open points). Add: steps & rules mentioned, what stays as-is, who else owns what. Importance/satisfaction only when the client stated them. |
| Draft: systems | group → name → check | phuryn/pm-skills `analyze-feature-requests` (MIT) | Take the theme grouping. Leave the top-3 ranking, effort and strategic scoring. |
| Draft: assumptions | per-feature risk sweep | phuryn/pm-skills `identify-assumptions-existing` (MIT) | Take the four risks (value, usability, viability, feasibility) as a checklist per feature. Leave the three-perspective pass, confidence ratings, suggested tests. |
| Draft: assumptions | impact × uncertainty grid | phuryn/pm-skills `prioritize-assumptions` (MIT) | Take the 2×2 in words (price impact × input support) to pick at most 8. Leave the numeric formulas and experiments. |
| Discover, Draft | process mapping, impact mapping | BA `references/frameworks.md` (idea only, rewritten) | As-is → to-be steps; every feature points at a stated problem. |
| Draft: questions | question rules | BA `references/interview.md` §2 (idea only, rewritten) | Ask about a real past case; challenge vague words; unknown → assume-if-no-answer; conflicting sources quote both. |

Considered and rejected: `prioritize-features` (ranks scope; the draft keeps
everything asked for), `interview-script` (a full interview script; no one
is interviewed), `opportunity-solution-tree` (its useful parts duplicate
Define), the brainstorm, experiment and metrics skills (invent features or
plan post-build work), story mapping (groups by time order; systems are
business areas).

## Flow

```
0 Intake     number every source (E1, C1, N1 …); keep each as a text file so quotes can be checked
1 Discover   one note per source (steps/discover.md)
2 Define     3–6 problems in the client's words, each with quotes and sources; a goal line only if someone stated one
3 Draft      write draft.json (steps/draft.md, steps/assumptions.md)
               3a systems → 3b step lines → 3c features → 3d assumptions → 3e scope + exclusions → 3f client questions
4 Check      python3 scripts/check.py → fix → re-run until clean; then the model checks (steps/check.md)
5 Build      python3 scripts/build_docx.py → draft-scope.docx (+ discover-notes.md)
             claude.ai: present both files. Claude Code: give their paths.
             Last line: edit in Word or Google Docs, then use it with the business-analyst skill.
```

## Writing rules (references/rules.md)

- **Problems**: 3–6. One sentence each, in the client's terms ("We can't
  invoice until the paper DO comes back"), never a solution ("build an
  app"). At least one exact quote. Lists every source that mentions it.
- **Systems**: business areas the client would name ("Warehouse
  operations", not "WMS backend"). Grouping: list every request from
  Discover, group related ones, name each group, check that every request
  is in exactly one group; a request that fits no group means regroup, not
  force. Purpose line = the area + the problem it closes.
- **Step lines**: to-be only, 2–5 words per step. Side paths name where they
  return. Sub-workflows name where they start and rejoin, plus their share
  if the client gave one ("~30% of orders"). A system with no steps in the
  input has no step line; that gap is a client question.
- **Features**: name of 2–5 words. "What it does" is one verb-first
  sentence: who it is for, the client's number if any, what changes versus
  today. Each feature points at a problem.
- **Assumptions**: per feature, ask the four risk questions ("what must be
  true for this to work?"). Sort with the grid:

  |  | input supports it | input silent |
  | --- | --- | --- |
  | big price impact | Assumption | Assumption + client question |
  | small price impact | drop | client question only |

  At most 8 in the document. Each names the feature it came from.
- **Exclusions**: in Scope, each with one reason: owned by someone else,
  later phase, or no process detail yet; each cites a source.
- **Client questions**: about a real past case ("Last time an item couldn't
  be packed, when did you find out?"). Each says why it matters and what to
  assume if there is no answer. Sources that disagree: one question quoting
  both.
- **Language**: no vague words (banned list in rules.md: fast, seamless,
  efficient, user-friendly, robust, easy …); client numbers kept exactly,
  never rounded away; no internal ids in text the PO reads except source
  numbers.

## Discover note template (steps/discover.md)

```
Source: C1 · call · 12 Sep · Riverside Bakery owner, our PO
Background:            …
Current way of working: … (as-is steps, in order)
What stays as-is:      …
Who else owns what:    …
Problems:              … (importance / satisfaction only if stated, else –)
Steps & rules mentioned: …
Quotes:                "…" (exact)
Open points:           … (become client questions)
```

Saved together as `discover-notes.md` next to the docx, so the PO can see
where each line came from. Not part of the docx.

## Document shape (draft-scope.docx)

Same order as `SinKowaWorkflows.docx`, with ★ marking sections it lacks:

1. Title `<Client> — Scope draft`, date, the D7 note.
2. ★ Sources: number, kind, date, who/subject.
3. ★ Problems we heard: P1…P6, sentence, quotes, sources.
4. Scope: what is covered; client pillars table only if the input contains
   one; exclusions with reasons.
5. One section per system: name, purpose line, step lines (main, side
   paths, sub-workflows), feature table `Feature | What it does | From`.
6. Assumptions (≤ 8): text, from feature, source.
7. ★ Questions for the client: question, why it matters, assume if no
   answer, related problem or sources.

## draft.json (references/draft-schema.md)

The model writes the draft as JSON first. Top level: `client`, `date`,
`sources[{id, kind, date, who, file}]`, `problems[{id, text, quotes[{source,
text}]}]`, `scope{covered, pillars?, exclusions[{text, reason, source}]}`,
`systems[{name, purpose, problem, workflows[{kind: main|side|sub, steps,
returnsTo?, startsAt?, rejoinsAt?, share?, source}], features[{name, does,
problem, source}]}]`, `assumptions[{text, feature, source}]`,
`questions[{text, why, assume, refs}]`. The exact field list is fixed in
`draft-schema.md` and enforced by `check.py`.

## check.py

Exit 0 when clean; else one line per finding and exit 1.

- every quote appears word for word in its source file (whitespace
  normalised); on a miss, print the closest sentence from that file;
- every `source` / `refs` id exists in `sources`;
- every problem is pointed at by ≥ 1 feature or ≥ 1 question;
- limits: 3–6 problems, ≤ 8 assumptions, step and feature names 2–5 words;
- no banned vague word in any text field;
- required fields present (draft-schema.md).

The model then checks what a script cannot (steps/check.md): client numbers
kept, grouping makes sense, every problem lands in some system.

## build_docx.py

Python standard library only (`zipfile` + hand-written WordprocessingML),
the same approach as the proposal's in-page DOCX writer. Headings, plain
paragraphs, tables, step lines as text. Must open in Word, LibreOffice and
Google Docs.

## Files

```
plugins/business-analyst/skills/draft-scope/
├── SKILL.md
├── steps/        discover.md · draft.md · assumptions.md · check.md
├── references/   rules.md · draft-schema.md · credits.md
├── scripts/      check.py · build_docx.py
└── scripts/test/ node:test files that run the Python scripts (so `npm test` covers them) + fixtures
plugins/business-analyst/evals/draft-scope-rich/
plugins/business-analyst/evals/draft-scope-thin/
```

`business-analyst` plugin 0.4.0 → 0.5.0; marketplace entry updated.

## Testing

- **check.py**: one failing fixture per rule (reworded quote, unknown
  source id, problem with no feature or question, 9 assumptions, 7
  problems, 6-word step, banned word, missing field) and one clean pass.
- **build_docx.py**: output is a valid zip with `word/document.xml`; every
  section present in order; step lines present as text; tables have the
  expected columns.
- **Evals** (fictional client "Riverside Bakery", no real client data;
  inputs seeded as files):
  - `draft-scope-rich`: 3 emails + 1 call transcript with planted traps,
    each with a grader:
    - solution-language request ("build an app so we stop running out of
      flour") → stated as a problem, not a feature;
    - vague word ("deliveries must be fast") → a client question, no
      "fast" in a feature;
    - a share ("about 30% of orders are custom cakes") → "~30%" kept on
      the sub-workflow;
    - keep-as-is ("orders come by WhatsApp, that stays") → assumption or
      exclusion;
    - owned elsewhere ("the courier company handles routes") → exclusion,
      reason owned by someone else;
    - conflict (call "same day" vs email "next morning") → one question
      quoting both;
    - noise (talk about the café's music) → absent from the draft;
    - plus: no question to the user, systems are business areas, ≤ 8
      assumptions.
  - `draft-scope-thin`: one short email → short draft, mostly client
    questions, no invented systems or features.
  - The eval sandbox has no shell, so graders judge the drafted content in
    the reply; the scripts are covered by their unit tests.
- **Manual (plan task 1)**: upload to claude.ai, run once on the
  Riverside Bakery inputs; confirm the step files are read when SKILL.md
  says, both scripts run, and the docx opens in Google Docs.

## Out of scope

- Interviewing the PO or the client.
- Any change to the `business-analyst` skill.
- Images or drawn diagrams in the docx.
- Alternative drafts or feature ranking.
- Re-running on an edited draft (the edited document goes to the BA).

## Risks

- **System grouping** is the weakest step and no script can judge it; the
  PO's edit is the safety net.
- **claude.ai loading** of step files is assumed from how skills are
  packaged, not tested; plan task 1 checks it first.
- **Thin input** gives a draft that is mostly questions; by design (D4).
