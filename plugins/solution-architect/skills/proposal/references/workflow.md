# Workflow mode — Systems & Workflows proposal page

Read when `estimation.json` has `inputs.scopeMode: "workflow"`. The page
copies the format of the proposal sent to Sin Kowa: Scope, one section per
system (its workflow diagrams and a Feature | What it does table),
Milestones, Assumptions & exclusions, Cost estimate. Every fact on it comes
from data; you write only the sentences, in `proposal-inputs.json`. There
is no proposal.md, and nobody edits one: the human reads the page, asks for
changes in chat, and downloads the DOCX or PDF to send.

## 1. Where each part comes from

| Part | Source |
| --- | --- |
| Systems, workflows, features and what each does, scope.out | `requirements.json` (the BA package the estimate names) |
| Milestone contents, assumptions, exclusions, price | `estimation.json` |
| Title, byline, scope intro, one optional sentence per system, milestone client names and what each demonstrates | `proposal-inputs.json` (you) |

Prices are USD. The team changes the currency, and adds an About-us or
next-steps section if they want one, in the copy they send — never in a
skill file.

## 2. Flow

1. **Gate.** `estimation.json` exists with `scopeMode: "workflow"`, and the
   `requirements.json` it names exists. A missing estimate → stop: "run the
   estimate skill first." `validate.mjs` (step 4) re-runs the estimate's own
   validation; a finding there → stop and name the estimate skill.
2. **Interview, one question at a time, only what is unknown.** Client name;
   tech level (non-tech | low-tech | technical, as classic
   `references/interview.md` §1); the firm name (`firm` from the profile,
   classic §3 lookup — ask only the name if there is no profile). Then show
   the milestones (`computed.features[].milestone`, with the features each
   finishes) and propose a client name and one "what it demonstrates" line
   for each; the user corrects them.
3. **Write `proposal-inputs.json`** beside `estimation.json` (§3).
4. **Validate:** `node scripts/validate.mjs --estimation <dir>/estimation.json
   --inputs <dir>/proposal-inputs.json` — fix findings, re-run until clean.
5. **Render:** `node scripts/render.mjs --estimation <dir>/estimation.json
   --inputs <dir>/proposal-inputs.json --mermaid-bundle <path> --out <dir>/dist`
   — the same mermaid bundle as classic step 8. It re-runs validation and
   writes nothing on a finding.
6. **Fresh-eyes review** of `dist/proposal.html` (`references/review.md`,
   Workflow mode); fix in `proposal-inputs.json`, steps 4–5 again.
7. **Serve and hand over.** `node ../analyze-requirements/scripts/serve.mjs <dir>`.
   Tell the user: the URL; that the page has Download PDF and Download DOCX
   buttons; that prices are USD and currency, About-us and next steps are
   theirs to change in the sent copy. Changes → edit `proposal-inputs.json`
   (or, for a fact, the BA package or estimate) → steps 4–7 again.

## 3. `proposal-inputs.json`

```json
{
  "client": "Sin Kowa",
  "title": "Sin Kowa Digital Transformation",
  "firm": "Code Engine Studio",
  "date": "2026-10-07",
  "techLevel": "non-tech",
  "jargonAllow": [],
  "scopeIntro": "This proposal covers two systems for Phase 1 …",
  "systems": { "SYS-002": "It closes the paper delivery-order gap …" },
  "milestones": {
    "M1 - Walking skeleton": { "name": "Digitise core records", "demonstrates": "Orders move through each stage on screen …" }
  }
}
```

- `title` becomes "<title> — Systems & Workflows Proposal"; `date` is today
  (ISO) and shows as "Oct 7, 2026 · <firm>".
- `systems` is optional, keyed by the BA system id; the sentence follows the
  system's own purpose line.
- `milestones` needs an entry for every milestone the estimate uses, keyed
  by its estimate name, and no others. The page numbers them in order.

## 4. Sentence rules (validate.mjs refuses each)

The title counts as a sentence: it is the page heading.

- No price of any kind in a sentence (`$40k`, `USD 5,000`, `12k SGD`,
  `5,000 dollars`, `RM 20,000`, `1.2 million usd`): the only prices on the
  page are the estimate's.
- No internal ID (`FEAT-001`, `SYS-002`, `FR-003` …) and no engineer
  milestone name (`M1 - Walking skeleton`): name the thing in words.
- `non-tech`: no word from the jargon list (`scripts/lib/jargon.mjs`) unless
  listed in `jargonAllow` because the client uses it.
- No timeline, rate, team or score: the estimate produces none for the
  client (the fresh-eyes review catches what no script can).
