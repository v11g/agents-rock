# Steps 2–3 — Define and Draft

Work from the notes in `discover-notes.md`. Write `draft.json`
(`references/draft-schema.md`). Rules for every text: `references/rules.md`.

## 2 Define — problems

Merge the notes' problems into 1–6 problems. One sentence each, in the
client's terms ("We run out of flour before we notice"), never a solution
("build an app"). Each carries the exact quotes behind it. A goal line goes
into `scope.covered` only if someone stated a goal.

## 3a Systems

1. List every request and problem from the notes.
2. Group related ones. Name each group as the business area the client
   would name ("Orders", "Stock"), never a technical part ("backend").
3. Check: every request sits in exactly one group. One that fits none
   means regroup; do not force it in.
4. Purpose: one sentence, the area plus the problem it closes; `problem`
   holds that problem's id. No stage, user or detail a source does not
   give.

## 3b Step lines

Only steps a source gives, as `workflows` on the system:
- `main`: the to-be steps in order, 1–5 words each.
- `side`: a branch, with `returnsTo` when it goes back.
- `sub`: a sub-workflow with `name`, `startsAt`, `rejoinsAt`, and `share`
  when the client gave one ("~30% of orders").
A system no source gives steps for has `workflows: []`, and the missing
steps become a client question.

## 3c Features

Per system, what the client asked for or what closes a problem. Name: 2–6
words. `does`: one sentence starting with a verb: who it is for, the
client's number if any, what changes against today. `problem`: the problem
it closes. Use only details a source gives: no data fields, users, devices
or stages the client did not name. Unknown details are client questions.
Thin input gives at most one feature per stated request, worded as
broadly as the request.

## 3d Assumptions

Read `steps/assumptions.md`.

## 3e Scope

`covered`: one or two sentences on what the draft covers. `pillars` only
when a source lists the client's own programme pillars. `exclusions`: only
things a source names, each with `reason` `owned-elsewhere`, `later-phase`
or `no-detail` and that source. Never exclude what no source mentions.

## 3f Client questions

From the notes' open points, gaps (a system with no steps), conflicts and
vague words:
- Ask about a real past case: "Last time … what happened?"
- A vague word is quoted and made measurable: "You wrote \"fast\": by
  what time of day?"
- Sources that disagree: one question quoting both.
- `why`: what changes in the scope with the answer. `assume`: what the draft
  assumes if there is no answer. `refs`: the problem and source ids.
