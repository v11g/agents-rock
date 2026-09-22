# Decisions — significance, technology costs, acceptance

Read when a choice might warrant an ADR, and again when writing one.
`writing.md` §6 owns where ADRs live and what mattpocock's format requires;
this file is how to answer the questions that format asks.

## 1. Answering the gate

mattpocock's three-part gate — hard to reverse, surprising without context, the
result of a real trade-off — is the only gate, and `writing.md` §6 states it.
What follows says how to answer it rather than by feel. It decides nothing the
gate has not already asked.

Ask whether the choice materially changes:

- system or subsystem **boundaries**
- **data ownership**, or which record is authoritative
- **contracts between parts**
- an important quality — one named in §13
- an **operational dependency** the team must run and be paged for
- the **cost of future change**

Any yes and the decision is hard to reverse or a real trade-off: it earns an
ADR. All no and it is a local choice — record it where it happens, not in
`docs/adr/`. Configuration values are never decisions.

Classify by what the choice moves, never by whether it names a technology. A
technology choice can move a boundary — an execution engine that becomes the
system-wide way work runs is architectural — and a structural-sounding one can
be local. A retry setting is local until it governs externally visible failure
behaviour.

Never split one choice into a paired architectural and technical record to make
the trail look thorough. One choice, one record.

## 2. Link it

Every ADR names what it addresses: a §2 constraint, a §13 quality row, a §15
risk, or a stated goal from §1. An ADR that addresses nothing either has a
justification nobody wrote down, or should not exist.

Name the **revisit trigger** too — the observation that would overturn the
decision, such as a measurement crossing a threshold, a volume arriving, or a
vendor changing terms. A decision with no trigger cannot be revisited on
purpose, only regretted.

## 3. Technology choices

Constrain the **class of choice** before naming a product. A product name
belongs in the decision only when a quality in §13 forces that specific one —
and that fact is itself the architectural part, so say which quality and why.

Compare inside the structure already chosen. The decomposition and deployment
shape narrow the field before product names enter; comparing products first
tends to pick the structure by accident.

Costs go in four rows and never blend into one number:

| Cost | Question |
|---|---|
| Build | What must the team write? |
| Operate | What must the team run, watch, and be paged for? |
| Infrastructure | What does the service or hardware cost? |
| Switching | What does leaving cost later? |

Use ranges where a point estimate is not defensible. Never invent a vendor
price, a service limit, or a team estimate — research it and cite the source
with a date, or mark the claim **unverified** and say how that weakens the
recommendation.

## 4. Status and acceptance

```
proposed → accepted | rejected | deferred
accepted → superseded
```

Write `proposed`. Only the user moves an ADR to `accepted`, and that record
carries a **named decision-maker** and a date. Never read silence, or your own
recommendation, as agreement. Reuse acceptance already given rather than
re-asking for the same decision.

A deferred ADR records what information would unblock it. Decide at the point
where there is enough information but before the team is blocked: deferring out
of fear is a failure, and so is deciding early to look decisive.

Substantive replacement gets a new ID and a `supersedes` link. The superseded
record stays readable — it is the only evidence of why the first answer looked
right.
