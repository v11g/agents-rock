# systems-thinking

Models the system producing a problem, rather than tracing one cause.

Answers: **what system is producing this?**

## Frameworks

| Framework | Use it when |
| --- | --- |
| Iceberg Model | A symptom keeps returning and the layers under it are unexamined. |
| System Map | Two or more actors, and the relationships between them are unclear. |
| Causal Loop | The variables are known and suspected of feeding back on each other. |
| Leverage Points | You need to know where to intervene. |

Selection is first-match-wins in that reverse order — where-to-intervene
first, iceberg last. The skill shortlists two and recommends one; you pick.

## Usage

```
/reasoning:systems-thinking "<problem>"
/reasoning:systems-thinking causal_loop "<problem>"
```

Or let `problem-router` classify the problem first and hand it over.

When the evidence runs out before the framework's stopping rule fires and
you're there to answer, it asks you for the missing piece — one question
at a time, each naming where to look — instead of stopping short.

## What it will not do

- Name a fix, or write one.
- Produce an adoption plan, a sequence, or an owner — that is
  `systemic-design`, which is not built in this release.
- Run on a bounded one-function defect. That is `problem-solving`.

## Output

Six core fields plus exactly one framework block, per the shared contract
in `references/contract.md`. Evidence and assumptions stay separable, and
a diagram appears only when the structure contains a cycle.
