# Interview — prereq gate, client context, profile

Read before asking anything. Pre-fill from evidence, ask only holes, one
question at a time.

## 0. Prereq gate + evidence load

Both files must exist or the skill stops:

- No ARCHITECTURE.md → stop: "run the analyze-requirements skill first."
- No estimation.json → stop: "run the estimate skill first."

Read ARCHITECTURE.md, estimation.json, and estimation.md. Load the firm
profile (see §3). Then state what is already known: scope, milestones,
cost, risks, tech stack. The user corrects anything stale before questions
begin.

## 1. Client context — the only-human-knows questions

1. Client name, and who decides (owner? IT manager? founder?).
2. **Tech level: non-tech / low-tech / technical.** This sets the document's
   language everywhere — non-tech bans jargon outright (the validator
   enforces a deny-list; `jargon_allow` in frontmatter overrides per term
   when the client themselves uses it).
3. The client's business problem, in their words — seeds Background &
   Objectives.
4. What the client cares about most: price, speed, or reliability — shapes
   the Executive Summary's emphasis.
5. Validity period — default 30 days from today; compute the date for
   `valid_until`.

## 2. Gaps + confirmation

- Out-of-scope items beyond what estimation.md already excludes?
- Anything the client already rejected or demanded (constraints)?
- Anything in ARCHITECTURE.md or estimation.md that conflicts or is unclear
  → ask, never guess.

## 3. Firm profile

Lookup order: `<project>/.claude/proposal-profile.json` →
`~/.claude/proposal-profile.json` → none. Project scope wins when both exist.

Shape:

```json
{
  "firm": "Code Engine Studio",
  "contact": "hello@codeenginestudio.com",
  "website": "https://codeenginestudio.com",
  "blurb": "One-paragraph plain-language introduction.",
  "relevant_work": [{ "name": "Clinic scheduler", "oneliner": "what it was, outcome" }]
}
```

- Found → show it, confirm or edit; save edits back to the same scope.
- Not found → interview the fields, then ask: "store globally
  (~/.claude/proposal-profile.json) or project-level
  (.claude/proposal-profile.json)?" and write the chosen file.
- Corrupt/unreadable → warn, re-interview, rewrite.
