# Decision rules — defaults, thresholds, smells

Working knowledge, loaded on demand. These are starting positions and the
conditions that overturn them, not findings. A rule here never justifies a
sentence in a document; the project's own drivers do. Where a rule sets a number,
that number is a rule of thumb — the project's measured value always wins, and
where no measurement exists the claim is `proposed`, never `observed`.

## Defaults

| When | Do | Because |
|---|---|---|
| One set of characteristics suffices | **Monolith** | Simplicity and cost are real characteristics, not concessions |
| Different parts need different characteristics | **Distributed** | A monolith forces the strictest requirement onto everything |
| Choosing a communication style | **Synchronous by default, async when necessary** | Async costs data synchronisation, deadlocks, race conditions and debuggability |
| Two services have mismatched throughput | **Async plus a queue** | Synchronous calls weld their operational characteristics together |
| A transaction is needed across services | **Fix the granularity instead** | Transaction boundaries are a granularity signal, not a pattern to reach for |
| Services need constant chatter to function | **Merge them back** | Domain isolation is not worth the communication overhead |
| Reuse would couple two contexts | **Duplicate** | Reuse is coupling |
| Tempted to name a product in a decision | Name the **class** of choice | Unless a characteristic forces the product — and then the product is itself architectural |
| A requirement needs a domain expert to define it | It is a **domain requirement**, not a characteristic | Elasticity can be defined without one; a domain-specific index cannot |
| A stakeholder demands an extreme number | **Divide and conquer** | Rarely does the whole system need it — find the part that does |
| Deciding when to decide | **Last responsible moment** | Before the team is blocked, after the choice can be justified |

## Style scorecard

Indicative rankings against each other in the general case. They are **not
measurements of your system**. Check any rating that drives a recommendation
against the project's own quality scenarios before citing it, and say that you
did.

| | Layered | Pipeline | Microkernel | Service-Based | Event-Driven | Space-Based | Microservices |
|---|---|---|---|---|---|---|---|
| **Partitioning** | Tech | Tech | Dom+Tech | **Domain** | Tech | Dom+Tech | **Domain** |
| **Quanta** | 1 | 1 | 1 | 1→many | 1→many | 1→many | 1→many |
| Deployability | 1 | 2 | 3 | 4 | 3 | 3 | 4 |
| Elasticity | 1 | 1 | 1 | 2 | 3 | **5** | **5** |
| Evolutionary | 1 | 3 | 3 | 3 | **5** | 3 | **5** |
| Fault tolerance | 1 | 1 | 1 | 4 | **5** | 3 | 4 |
| Modularity | 1 | 3 | 3 | 4 | 4 | 3 | **5** |
| **Overall cost** | **5** | **5** | **5** | 4 | 3 | 2 | 1 |
| Performance | 2 | 2 | 3 | 3 | **5** | **5** | 2 |
| Reliability | 3 | 3 | 3 | 4 | 3 | 4 | 4 |
| Scalability | 1 | 1 | 1 | 3 | **5** | **5** | **5** |
| **Simplicity** | **5** | **5** | 4 | 3 | 1 | 1 | 1 |
| Testability | 2 | 3 | 3 | 4 | 2 | 1 | 4 |

Read it as: cost and simplicity trade directly against scale, elasticity and
fault tolerance. Nothing scores well on both halves, so a design claiming both
has hidden the bill somewhere.

## Selection tree

- Customisability or per-client variation → **Microkernel**
- One-way processing flow (ETL, telemetry) → **Pipeline**
- Unknown shape, tight budget, small application → **Layered**, keeping reuse minimal and inheritance shallow
- Modularity with transactional integrity, without granularity pain → **Service-Based**, the pragmatic default
- Highly coupled domain, such as multi-page dependent forms → **Service-Based**, not microservices
- Responsiveness and scale with a dynamic flow → **Event-Driven**; broker for responsiveness, mediator for workflow control
- Very high concurrency with unpredictable spikes where the database is the ceiling → **Space-Based**
- Genuinely differing operational characteristics per component, and the budget to run them → **Microservices**
- Reuse is the organising goal → **stop**. Architectures organised around reuse fail on exactly that premise.

## Thresholds

Rules of thumb. Cite the project's measurement where one exists; otherwise the
claim is `proposed`.

| Metric | Value |
|---|---|
| Cyclomatic complexity | **< 5** preferred, < 10 commonly tolerated, > 50 unsalvageable |
| Characteristics to support | **Top 3**, unordered |
| Services in a service-based architecture | **4–12**, around 7 typical |
| Sinkhole requests | 20% fine · **80% means the style is wrong** |
| Replicated cache ceiling | **100 MB**; prefer distributed above ~500 MB |
| Space-based threshold | **> 10,000 concurrent users** |
| First-page render budget | **500 ms** |
| Replication latency planning default | **100 ms** |
| Risk score: low / medium / high | 1–2 / 3–4 / **6–9** |
| Three nines | 8h 46m a year — **86 seconds a day** |
| Five nines | 5m 35s a year — **1 second a day** |

## Smells

| If you see… | You are probably looking at… |
|---|---|
| A manager class per database entity | **Entity trap** — that is an object-relational mapping, not an architecture |
| The same decision re-debated monthly | The justification was never recorded — it belongs in an ADR |
| A decision that lives only in an email or a chat thread | No system of record — link the decision, do not restate it |
| "We must have zero downtime" | Availability matters here; go and get the real numbers |
| A service returning 45 fields so a caller can use one | **Stamp coupling** — measure what it costs on the wire |
| Sagas everywhere | Granularity mistakes were made upstream |
| A diagram nobody can act on | Too high level to be of use to anyone |
| A beautiful diagram early in design | Attachment to the artifact — stay low-fidelity longer |
| A canonical shared entity every consumer depends on | Every consumer now pays for every other consumer's needs |
| "It is faster to call the database directly" | State the reason first, then the constraint it breaks |

## Non-negotiables

1. Everything is a trade-off. If you cannot see it, keep looking.
2. Record why, not how.
3. There is never a best architecture — only the least worst for these drivers.
4. Every decision gets challenged. Budget for the conversation.
5. "It depends" is correct. The job is enumerating **what** it depends on.
