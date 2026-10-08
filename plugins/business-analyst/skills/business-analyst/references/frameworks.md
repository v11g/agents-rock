# Framework selection

Pick by symptom, never apply all. Justify each pick to the user in one
line. Two frameworks per engagement is typical; four is the ceiling.

| Symptom in the input | Framework |
| --- | --- |
| Request names a solution, problem unclear ("we need a chatbot") | 5 Whys |
| Manual workflow described; stated process may differ from reality | Contextual inquiry |
| Multiple actors, approvals, handoffs | Process mapping |
| Feature list with no link to outcomes | Impact mapping |
| Complex or ambiguous business rules, edge cases matter | Example mapping |
| Product scope / MVP boundary undefined | Story mapping |
| Behavior must be precise, rule-heavy | Specification by example |
| Requirements mature enough to test | Given / When / Then |

## 5 Whys
Ask "why" down from the stated solution until a business problem appears
(usually 3–5 levels). Produces: root problem, motivation, outcome.
Example: "We need a chatbot" → why → "support tickets take 2 days" → why →
"tier-1 answers are manual" → root problem: repetitive tier-1 load.

## Contextual inquiry
Ask the client to walk through a recent real case, step by step, naming
systems and people. Produces: the actual process, workarounds, hidden
steps, pain points. Trigger phrase: "Walk me through the last time…"

## Process mapping
Draw the as-is flow (actors, decisions, handoffs) as a mermaid flowchart;
confirm; then draw to-be. Produces: WF- entries, decision points,
exceptions.

## Impact mapping
WHY (business goal) → WHO (actors) → HOW (behavior change) → WHAT
(capability). A feature that maps to no WHY is asked about, and closes
like every asked question: an answer, an "Assume …" pick, or out of
scope (interview.md §2b).

## Example mapping
Per story: rules (blue), examples per rule (green), questions (red).
Every complex BR- gets at least one example inside and one outside the
boundary — these become SC- entries.

## Story mapping
Activities across the top, tasks below, slice releases horizontally.
Produces: capabilities, journey order, MVP line → scope in/future.

## Specification by example
Turn each agreed rule into concrete input → expected-output rows
(the Part 4 tables). Disagreement over a row = an undiscovered rule.

## Given / When / Then
Final form for acceptance: `Given <state> When <event> Then <outcome>`.
Use once requirements are stable; earlier it hardens guesses.
