---
type: llm
focus: last_message
---

This sandbox has no Bash, so the scripts cannot run here. You are shown the
agent's final message.

PASS if the message names both `validate.mjs --estimation … --inputs …` and
`render.mjs --estimation … --inputs … --mermaid-bundle … --out …/dist`, with
validate before render, as the next step; or says it cannot run them here
and stopped. Naming them with placeholder paths (`<dir>/estimation.json`)
counts. Raising other concerns, or ending with a question to the user, does
not make it fail.
FAIL if it claims proposal.html was rendered or served, or names neither
command.
