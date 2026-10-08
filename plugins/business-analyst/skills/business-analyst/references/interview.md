# Clarification interview

Behave like an experienced BA interviewer: extract everything from the
inputs first, then ask only about holes, highest impact first.

## §1 Question priority

- **P1 — blocking**: scope or architecture cannot reasonably proceed
  without the answer. Mark `architectureBlocker: true` when the answer
  changes system boundaries, integrations, decision authority, or data
  ownership.
- **P2 — high impact**: could materially change scope, complexity, or cost.
- **P3 — detail**: safely deferred; record in the register, don't ask now.

Triage rule: ask P1s first, one question per turn, and wait for the
answer before choosing the next — each answer re-ranks the gaps. Never
move to P2 while an easy-to-answer P1 is open. Every question you ask closes
(§2b); only gaps you never ask stay open questions.

Ask through the host's question tool: `AskUserQuestion` in Claude Code,
the multiple-choice question tool on claude.ai. No such tool → ask the one
question in plain text and stop. Put the summary of what you extracted
and the frameworks picked in the message before the first question, not
inside it.

## §2 Question rules

1. Never ask what the inputs already answer.
2. Ground every question in what the client said: "You mentioned approved
   contracts are stored in SharePoint. Does the new system need to A. read
   from it, B. write back, C. both, D. neither?" In the question tool the
   options are the choices (at most 4); free text arrives through "Other".
   Never recommend: no option is labelled or ordered as your pick. Options
   are: real answers when the input suggests them; one or more
   assumptions, each of which starts with "Assume" and states its
   boundary ("Assume under 1 hour offline; longer is a change request");
   and "Leave <thing> out of scope". There is no "Don't know" option.
   An option that rests on the input cites its input quote: the file,
   the place and the exact words, copied, not paraphrased
   (SinKowaProposal.docx, System 4: "dead spots inside the warehouse").
   An option with no input quote cites nothing; its "Assume" already
   says it is a guess. An assumption's boundary is a scale and a limit
   ("hours offline: under 1"). Take the limit from the input quote first,
   else the usual value for that kind of business, else the smallest
   scope still safe to price; past the limit is a change request.
3. Explain why a question matters when the answer is expensive to get.
4. Adapt: each round of answers reprioritizes the remaining gaps.
5. Prefer a real example over an abstract description: "walk me through
   the last time this happened" beats "how does this normally work".
6. Challenge vague words (see the banned list in writing.md): "how fast is
   fast — what is acceptable in seconds?"
7. Distinguish **unknown** (client doesn't know yet — offer the
   assumptions that bound it)
   from **undecided** (client must choose — present the options and the
   consequence of each).
8. Contradictions are surfaced, never resolved silently (§5).
9. Never cite register ids (`CONFLICT-`, `Q-`, `FR-`, `ASM-`, …) in a
   question. They are internal until requirements.md exists, and the user
   has never seen them. Point at the input instead: the document, its
   section or page, and a short quote. On a re-run you may add the id in
   brackets after the plain question.

## §2a Who is answering

Never ask where an answer comes from — not up front, and not tacked onto
another question ("also say whether the client told you"). Facts from the
input documents keep the labels the evidence supports. Systems, features
and workflows an input document lists are `confirmed`, source the
document: the PO wrote that list for the estimate.
Never draft systems, workflows or features yourself. Workflows come only
from the input: a diagram, or steps it lists. A system the input gives no
steps for has no workflow, and its features have `steps: []`. A gap you
see (a missing step, a feature the evidence implies) is a question for
the user; a yes adds it. A system, feature or workflow the user asks for
in the interview is `confirmed`, source `PO in interview, <date>`: the
PO's list is decided, like an input document. Every other answer closes
per §2b.

An undecided workflow (say, one a 0.3.x package drafted) is asked with
only these options:

- the steps exactly as the input lists them, if it lists any;
- "No workflow for <system>: its features stay, on no step" — remove the
  workflow and its steps from every feature; a feature left with no step
  gets `steps: []`;
- the PO lists the steps through "Other".

Never offer a step order the input does not give. Leaving a workflow out
never removes a feature.

## §2b How a question ends

Every question you ask closes one of three ways:

| The user picks | You record |
| --- | --- |
| a real answer, or one typed through "Other" | the item it settles, label `confirmed`, source the user (the client, when the user says "the client told me") |
| "Assume …" | an ASM row: the option's text, impact high for P1 / medium for P2 / low for P3, status `accepted` (the PO decided it, so it never blocks `READY_FOR_ARCHITECTURE`), source `PO in interview, <date>`; the review page shows it ★ New |
| "Leave … out of scope" | FR scope `out` (or a `scope.out` entry when there is no FR); Part 3 lists it |
| "Drop this assumption" (offered only on a question about an input assumption) | that input ASM row's status `resolved`; the review page no longer shows it. Any other answer sets the row `accepted`, its words unchanged |

The user types "don't know" (or similar) in "Other" → ask once more with
the same options and say they must pick an assumption or leave it out —
the estimate cannot price an open gap. An asked question never stays
open. Gaps you never ask (P3) stay in the open-questions register for
engineers; the review page never shows it.

## §3 Sequencing shapes

- **Funnel** (broad → narrow): default for vague inputs ("we need a
  chatbot"). Start at business problem, narrow to workflows, rules, edge
  cases.
- **Pyramid** (narrow → broad): for detailed-but-suspect inputs (a feature
  list with no why). Start from a concrete feature, climb to the goal it
  serves — features that climb to no goal are asked, and close like
  every asked question (§2b).
- **Diamond** (narrow → broad → narrow): for existing-system work. Start
  from the pain point, widen to the surrounding process, narrow back to
  the change.

## §4 The nine layers

Work through these progressively; the depth mode decides how far.

1. **Business context** — why now, cost of doing nothing, desired outcome,
   success metric. Ask: "What business result should improve, and how will
   you measure it?"
2. **Stakeholders and actors** — users, deciders, approvers, external and
   system actors. Per actor: goal, decisions, information needed, pain.
3. **Current state (as-is)** — trigger, steps, decisions, handoffs,
   systems, manual work, exceptions, workarounds. Always request a recent
   real example.
4. **Business rules** — explicit and implied. Per rule: statement, source,
   two concrete examples (one inside, one outside the boundary).
5. **Scenarios** — happy path, alternatives, edge cases, errors, missing
   information, cancellation, human intervention.
6. **Future state** — pain point → desired change → required capability.
   Capabilities, not implementations.
7. **Functional requirements** — convert validated capabilities into FRs
   with traces (goal, workflow, rules) and acceptance scenarios.
8. **NFRs** — investigate only relevant areas (security, privacy,
   performance, availability, auditability, compliance, retention,
   localization, device support). Never run the full list mechanically.
9. **Integrations and data** — systems, direction (read/write/both),
   identity, then per entity: source of truth, ownership, volume,
   sensitivity, retention, synchronization.

## §5 Contradiction protocol

When two statements conflict: record a `CONFLICT-` entry quoting both
statements with their sources. To the user, show the two quotes and where
each appears in the input ("PRD §Assumptions says … ; PRD §System 1,
Offline sync says …"), never the entry or its id, and ask which holds (or
whether both do under different conditions). Never pick an
interpretation yourself. A conflict stays open until the client resolves
it; open conflicts block READY_FOR_ARCHITECTURE.

## §6 Depth modes

Default STANDARD; never ask. Use QUICK or DEEP only when the user names it.

- **QUICK**: layers 1, 2, 6, 7 only; P1 questions only; one interview round.
- **STANDARD**: all layers; P1 + P2; iterate until P1s are answered or
  explicitly parked.
- **DEEP**: all layers; P1–P3; example mapping on every complex rule;
  scenario tables for every critical FR.

## §7 Scope mode

Ask the mode in one question through the host's question tool. In the
question text, name the cues below that the input shows ("Your PRD names
two business areas, Warehouse ops and Invoicing, and draws a to-be
workflow"), or say it shows none. Mark no option as your pick. The options
say what each mode gives:

- "Workflow: systems, their steps and features"
- "Classic: one flat list of requirements"

The cues:

1. Two or more named business areas, each with its own features
   ("Warehouse ops", "Invoicing" — the word "system" is not required).
2. A to-be workflow, drawn as a diagram or listed as steps. An as-is
   diagram alone is not a cue: classic mode records as-is workflows too.

Skip the question when the user already named a mode, or on a re-run
(keep the existing `scopeMode`). Absent means `classic`.

Workflow mode adds one question group after workflows:

1. **Systems** — the business areas the client would name ("Warehouse
   operations", not "WMS backend"). One purpose line each.
2. **To-be workflows**: only those the input draws or lists as steps
   (short step names, 2–5 words, plus side exits and loops; sub-workflows
   say where they start and rejoin). A system without one is fine.
3. **Features**: per system, what the client asked for. Each one points at
   the steps it serves (`["*"]` for platform-wide ones such as login; `[]`
   when its system has no workflow) and lists its FRs. Every in-scope FR
   must land in a feature; an FR that fits nowhere is a question for the
   user, not a new feature.

Everything here comes from the input or the user's answers. Nothing is
drafted, so every system, workflow and feature is `confirmed` before the
review page (§8 refuses anything else). A workflow that grows in the
interview keeps its id.

## §8 PO review page (workflow mode)

After the fresh-eyes review, show the PO the scope in the shape of their
own document. Per system the page shows its purpose, the workflows the
input drew, and a feature table; then the assumptions. Rows added in the
interview carry ★ New and "Added: <source>". The page is read-only:
nothing to answer, nothing to paste. Open questions never appear on it.

1. `node scripts/review.mjs page --json <dir>/requirements.json --out <dir>/review.html`.
   Exit 1 → show its lines.
   - `not decided; ask the PO in the interview` → ask that item as one
     question (§2; an undecided workflow takes only the §2a options),
     record the answer (§2b), and re-run.
   - Any other line → fix those fields in the JSON (no ids in text the PO
     sees) and re-run.
2. Show it.
   - claude.ai: present the file. It shows as a file card, and a click
     opens the page beside the chat. Don't rebuild it as an artifact.
   - Claude Code: give the path.

   Then ask one question through the host's question tool: "Does the
   review page read like your document?" Options: "Approve: go on to
   requirements.md and the readiness report" and "Change something: say
   what in Other". Neither is your pick. No question tool → ask it in
   plain text and stop. Approve → step 11.
3. A change (through Other, or in chat) is a re-run (SKILL.md Re-run). Ask one question per
   unclear change and edit the JSON. Re-run `scope` once requirements.md
   exists; before that, validate with `--json` only. Then go to step 1
   again and ask again.

The user says skip or later → go to step 11.
