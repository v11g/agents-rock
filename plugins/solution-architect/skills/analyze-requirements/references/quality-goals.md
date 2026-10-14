# Quality goals — catalogue, filter, top 3

Read during the interview (SKILL.md step 3), before any §13 card. Defines
which quality goals may be proposed, how a candidate earns a place, and how
the top 3 are confirmed. Method from *Fundamentals of Software Architecture*
(Richards & Ford, ch. 4–5), in our own words.

## 1. Catalogue

Propose only these names, spelled exactly as here — §4 `Serves` and the
validator match on them.

| Goal | Book term | Changes the design when… |
| --- | --- | --- |
| Speed | performance | a user waits on a step with a number attached |
| Spike handling | elasticity | load jumps by a stated multiple in a short window |
| Growth | scalability | users or data grow steadily past one machine |
| Uptime | availability | an outage window costs money or trust |
| Data recovery | recoverability (RPO/RTO) | lost or late data has a stated cost |
| Reliability | reliability | a failure must never leave wrong or half-written state |
| Security | security | data or actions need protection beyond standard login |
| Integration | interoperability | a named external system is the source of record |
| Low cost | cost | a budget or running-cost ceiling is stated |
| Ease of change | evolvability | rules, partners or products change often |
| Simplicity | simplicity | a small team or short timeline must maintain it |

## 2. Filter — what makes a candidate

A goal is a candidate only when both hold:

1. **The input shows it** — an exact quote from the user's message, a
   document they supplied, or the code scan. No quote, no candidate.
2. **It changes the design** — something must be built differently for it.
   A goal every system has but that needs nothing special (card payments
   handled by the payment provider → Security) is not a candidate; it goes
   to "Also considered" with that reason.

Show 4–6 candidates, never the whole catalogue. Recommend 3, unranked.

## 3. Cards

Skip both rounds when the user said not to ask (§4).

Round 1 — one `AskUserQuestion` call, two cards:

- **Quality goals.** Question text lists each candidate with its quote, ★ on
  the recommended 3. Options: `Confirm top 3 (Recommended)` · `Swap in
  <strongest runner-up>` · `Swap in <second runner-up>`. Further runners-up
  stay in the question text; the user reaches them through Other.
- **Trade-off.** "If budget forces it, which gives way first?" Options: the
  three picks, the one with the weakest quote first and `(Recommended)`.

Round 2 — one call, one card per pick (≤ 3): "<Goal> target?" Options: two
measurable targets drawn from the input (recommended first), then `No
target yet`.

## 4. Thin input and pre-answered goals

- Fewer than 3 candidates: round 1 carries ONE open card — "Which qualities
  matter most for this system (up to <n>), each with a measurable target?"
  (<n> = empty slots) — answered through Other. Its answer fills every
  empty slot it can. When the
  picks are not known in round 1, the trade-off card moves to round 2 with
  the target cards (still max 3 cards per call; split into a second call if
  needed). §13 never exceeds 6 cards of the 12-question cap.
- A goal the user already named in their message is answered — no card for
  it (interview.md hard rule 3); its row is `stated`.
- The user said not to ask ("don't ask me any"): no card. Take the 3
  candidates with the strongest quotes; the weakest gives way first. Target
  from the input, else `Not provided — not asked`.
- A slot still empty (declined, or fewer than 3 candidates) renders its
  Goal cell as `Not provided — <who declined/why>`. Never invent a goal to
  fill a row.
- `No target yet` renders the Target cell `Not provided — no target set`.

## 5. Provenance

`src` is the source of the Target (writing.md §3a), never of the pick: a
Target quoted from the input or an answer is `stated`; one you suggested is
`proposed`. An unconfirmed pick does not change `src`. The trade-off pick
is recorded only by the "(gives way first)" label.
