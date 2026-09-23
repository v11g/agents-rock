# Drivers — turning what people say into what §13 can measure

Read during the interview (SKILL.md step 3) and again before writing §13.
`interview.md` owns which questions get asked and the cap on how many; this file
owns what to do with the answers.

## 1. Stakeholders talk in outcomes

Convert, and show the conversion — the original words stay visible in §1, the
characteristic goes to §13. Some outcomes are not characteristics at all.

| They say | Candidate characteristic |
|---|---|
| "mergers and acquisitions coming" | extensibility, scalability, adaptability |
| "time to market" | agility — which is testability plus deployability |
| "user satisfaction" | ambiguous; split it into performance, availability, fault tolerance, security |
| "competitive advantage" | agility, time to market |
| "regulatory deadline" | a hard constraint for §2, not a characteristic |

Keep a candidate only if all three hold:

1. It is a design consideration rather than a domain rule.
2. It influences some structural aspect of the design.
3. It is critical or important to success, not merely desirable.

If defining it needs a subject-matter expert, it is a domain requirement and
belongs in `CONTEXT.md`, not §13. "Elasticity" can be defined without one; a
domain-specific scoring index cannot.

## 2. Scenarios, not adjectives

"Fast", "secure" and "scalable" are unfalsifiable. A scenario has six parts:

```
stimulus     what happens
environment  under what conditions, at what workload
element      which part of the system
response     what the system does
measure      the observable
target       the threshold
priority     must | should | could
```

§13 renders five columns, so the first four fold into one `scenario` cell and
the rest keep their own:

| scenario | measure | target | priority | src |
|---|---|---|---|---|
| checkout submit at peak hour, 400 concurrent carts → order accepted or rejected | p99 end-to-end | 200 ms | must | stated |
| worker killed mid-job → job resumes, no accepted job lost, retried completion has no duplicate effect | recovery time | 30 s | must | assumed |

The cell still has to carry all four folded parts. A `scenario` cell that omits
the conditions is an adjective with extra words — "checkout is fast" gains
nothing from being written as "checkout submit → responds quickly".

## 3. Never invent a target

A target nobody supplied is `assumed`, never `proposed` and never `stated`.

**An `assumed` target on a `must` row is a blocker.** Report it as one: name the
row, say who could supply the number, and keep working on everything it does not
affect. A `must` scenario whose threshold we made up is a design with no
acceptance criterion, and it will read as settled to everyone downstream.

`should` and `could` rows tolerate an `assumed` target. Say so rather than
leaving the reader to infer which holes matter.

The row's `src` describes the **target cell**, and only that cell. A row whose
target the client gave is `stated` even though the scenario was written here and
the priority was assigned here — otherwise every row in a well-sourced §13 turns
`assumed` on the strength of its own prose, and the blocker rule above fires on
all of them. When nobody assigned the priorities, say once under the table that
the column is the document's own reading and invite the correction. That is a
`proposed` judgement about ordering, not an invented threshold.

## 3b. A quality the client rules out

"Availability — n/a, it's a CLI, there is nothing to keep up" is an answer, not a
gap. It has no legal row: `priority` is `must | should | could` and none of them
is true. Record it under the table as `Not applicable — <the reason they gave>`,
tagged with their provenance, and never as a row with an empty target. An
unasked question stays `Not provided — <why>`; the two must not be collapsed,
because one of them is a hole and the other is a decision.

## 4. Prioritise

Ask for the **top three, unordered** — never a full ranking. Then ask which one
they would drop if forced. The answer to the second question is what is actually
critical; the first question only establishes the shortlist.

Name the conflicts explicitly. Cost and simplicity are real characteristics and
they trade directly against scale, elasticity and fault tolerance, so a §13
listing all five without comment is describing a system nobody has costed.
`decision-rules.md` scores how the styles fall on that trade.

Supporting more than about seven characteristics means none of them is driving
anything. Where §13 has grown past that, say which three the structure was
actually designed for.

## Exit

- Every `must` row has a measurable target, or is flagged as a blocker.
- Every characteristic traces back to something a stakeholder said, and the
  conversion is visible rather than assumed.
- Conflicts between the top three are named, not averaged away.
