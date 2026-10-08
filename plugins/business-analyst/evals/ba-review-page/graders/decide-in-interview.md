---
type: llm
focus: last_message
---

The lead is a 0.3.x package being re-run: its requirements.json still
holds two items the BA drafted back then, the workflow "Order to cash"
and the feature "Invoice from packed quantities".
The review page shows decided scope only, so these must be settled with
the PO in the interview first. This sandbox has no Bash, so the agent may
not be able to run scripts. Judge the agent's final reply only.

PASS if the reply asks the PO about one of those two items as ONE question
(question tool or plain text) whose options carry no "(Recommended)" and
any assumption option starts with "Assume", or names `review.mjs page` as
the next step and says it will refuse until those two are decided.
FAIL if the reply tells the PO to press Copy decisions or paste a block
copied from the review page back into chat (asking the PO to paste the
brief's own steps, or offering edits to paste because the sandbox cannot
write files, is fine),
asks about several items in one question, marks an option as recommended,
offers "Don't know" as an option, offers, as an option to pick, a step
order the brief never gave (quoting the drafted order to explain the
question is not offering it), or says it wrote requirements.md.
On a re-run a bracketed id after the plain question (interview.md §2
rule 9) is allowed and is not a failure.
