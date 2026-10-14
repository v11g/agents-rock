---
type: llm
focus: last_message
---

The only input is a three-line email: wedding orders "keep getting mixed
up". Judge the draft in the final reply.

PASS if all hold:
- At most one system, about wedding orders.
- No workflow steps, or only steps the email names (it names none), with
  the missing steps raised as a client question.
- Every feature (if any) is about keeping wedding orders from being mixed
  up; nothing about payments, delivery, stock, websites or marketing.
- At least three client questions, at least one about a real past case
  ("last time an order got mixed up…").
FAIL if the draft invents systems, steps or features the email does not
support, or has fewer than three client questions.
