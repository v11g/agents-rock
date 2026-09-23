# Research — phase order, workflow invocation, provenance rules

Read during the research phase (SKILL.md step 4), after the interview and
before any writing starts. Defines the order research runs in, exactly how to
invoke `workflows/research.js`, and how provenance travels from its result
into ARCHITECTURE.md.

## 1. Phase order, and why

Domain → Stack → per-aspect Design, always in that order:

1. **Domain** — concepts, canonical vocabulary, comparable systems. Runs
   first because bounded contexts constrain component boundaries: design
   cannot be proposed before the domain that shapes it is known.
2. **Stack** — verify every stated tech claim; research integration facts
   (auth, rate limits, cost) for gaps the interview or scan left open.
3. **Design** (greenfield only) — per-aspect proposals for components, data,
   deployment, security, constrained by the Domain phase's findings.

**Brownfield skips phase 3 entirely** — the code scan already owns observed
design facts, so there is nothing to propose. Its Stack phase also narrows:
it fills only the gaps the scan could not observe, never re-deriving what
the scan already knows.

## 2. Invoking the workflow

Invoke `workflows/research.js` via the Workflow tool, passing the `args`
object below. The script runs its phases (skipping Design in brownfield mode
per §1) and returns a result object; nothing else calls the research agents.

```
args = {
  mode: 'greenfield' | 'brownfield',
  projectType: string,
  domain: string,
  statedFacts: [{ claim: string }],
  gaps: string[],
}
```

Where each field comes from:

| field | source |
|---|---|
| `mode` | mode detected in SKILL.md step 1 (target has code → `brownfield`) |
| `projectType` | detected or confirmed per `project-types.md` |
| `domain` | the interview's domain answer (brownfield: scan/README if not asked) |
| `statedFacts` | interview answers recorded provenance `stated` (`interview.md`) — each becomes `{ claim }`; the Stack phase attempts to verify each one |
| `gaps` | §9 External Integrations candidates the scan found no config for — an integration the code imports or calls but no env var, secret, or config key documents |

Return value: `{ domain, stack, aspects, dropped }` — `domain`, `stack`, and
`aspects` are fact arrays; `dropped` is the failure list (see §4).

## 3. Provenance rules

Verbatim — apply these exactly, do not paraphrase into something weaker:

> `researched` requires a source; an unverifiable stated claim **stays
> `stated`** — never upgraded; agent proposals are `proposed`; scan output
> is `observed`.

Research produces those four. A fifth value, `assumed`, exists for a number
nobody supplied that the document invented to keep moving — research never
produces one, and `writing.md` §3 owns the full vocabulary. Nothing outside
those five may appear in a table's `src` column or a prose fact's inline tag.

A fact's provenance never changes once assigned except by the rule above: `stated`
can be confirmed but is never silently promoted to `researched` just because
an agent looked at it and found nothing to contradict it.

## 4. The dropped-items contract

`result.dropped` is a list of `{ item, reason }` entries — one per research
job whose agent returned nothing. This is not an internal log to discard:

**Every entry in `result.dropped` must be surfaced to the user before
writing begins.** Present it plainly (what was attempted, why it came back
empty) so the user can decide to re-run it, supply the fact by hand, or
accept the resulting honest absence. Writing must never start on a research
result the user hasn't seen the gaps in — a thin result must never present
as complete.
