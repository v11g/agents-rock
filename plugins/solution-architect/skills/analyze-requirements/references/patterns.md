# Patterns — techniques with their trade-offs

Working knowledge, loaded on demand. Nothing here is a source to cite: a technique
earns its place in a document because this project's drivers justify it, never
because it appears on this page. Every entry states what it costs, because an
entry without a cost is a recommendation pretending to be a fact.

## Trade-Off Analysis
**When**: every non-trivial choice, especially when one option looks obviously correct.
**How**: state the benefits of the leading option; deliberately hunt its negatives; tabulate advantages against disadvantages; ask which competing characteristic matters more *here*.
**Costs**: time, and it never yields a correct answer — it converts an unanswerable question into an answerable one.

## Architecture Quantum Analysis
**When**: deciding monolith against distributed, and where data lives.
**How**: find the smallest independently deployable artifact with high functional cohesion whose synchronous dependencies — the database included — sit inside it. Count quanta: one set of characteristics → monolith; differing sets → distributed.
**Costs**: a shared database collapses everything into one quantum regardless of how many services deploy separately.

## Fitness Functions
**When**: anything important but not urgent — modularity, layer rules, complexity baselines, security conformity.
**How**: pick the characteristic and its objective measure; choose a mechanism (metric, monitor, unit test, chaos experiment); wire it into CI or production; explain it to developers before imposing it.
**Costs**: build time and maintenance, and it is useless if developers do not understand the purpose. Code review is not a substitute — it happens too late.

## Top-Three Prioritisation
**When**: as soon as stakeholders start ranking characteristics.
**How**: ask for the top three in any order — never a full ranking.
**Costs**: less precise than a full ordering, but achievable; the discussion is the real deliverable.

## The Cull-One Exercise
**When**: after a first pass at identifying characteristics.
**How**: ask which one they would eliminate if forced. Cull from the explicit list — implicit characteristics usually underpin general success.
**Costs**: forces a judgment call, which is the point; it establishes what is critically necessary rather than merely wanted.

## Actor/Actions Component Discovery
**When**: the generic default for §6, especially with distinct roles or older processes.
**How**: identify actors — including the system itself, for internally initiated events — and the actions each performs; map those to components; then split by differing architecture characteristics.
**Costs**: less aligned to domain-driven or message-based designs than event storming.

## Event Storming
**When**: domain-driven designs where messages and events are the communication substrate.
**How**: determine the events that occur from requirements and roles; build components around event and message handlers.
**Costs**: assumes a message-based system. It produces the eventual message set as a byproduct.

## Layers of Isolation
**When**: layered architecture, to keep a layer replaceable.
**How**: close every layer in the major request flow; open a layer only for a deliberate bypass; document which is which and why.
**Costs**: closed layers cause the sinkhole anti-pattern; open layers destroy isolation. Measure the sinkhole percentage — 20% is fine, 80% means the style is wrong.

## Adding a Layer to Enforce a Decision
**When**: an access restriction cannot be governed by the current structure.
**How**: promote the restricted artifacts into a new layer; keep the layer above closed; mark the new layer open so it does not become mandatory.
**Costs**: one more layer of indirection, bought in exchange for structural enforcement instead of discipline.

## Pipes and Filters
**When**: one-way processing flows — ETL, EDI, telemetry, shell-style pipelines.
**How**: classify each step as producer, transformer, tester, or consumer. Keep filters stateless, independent and single-task; keep pipes unidirectional, point-to-point and small-payload.
**Costs**: excellent modularity and testability for a monolith; poor elasticity, scalability and fault tolerance.

## Microkernel Plug-ins
**When**: customisability, feature extensibility, per-client or per-jurisdiction variation.
**How**: define the core as minimal functionality or the happy path; push all custom processing into independent plug-ins with no inter-plug-in dependencies; register them; standardise contracts per domain and adapt third-party ones.
**Costs**: runtime plug-ins cut deployment risk but need a module system. Compile-time plug-ins are simpler but force full redeployment. Remote plug-ins buy decoupling and asynchrony but make the architecture distributed — and still leave one quantum.

## Federated Shared Libraries
**When**: a service-based architecture on a shared database.
**How**: logically partition the database into data domains; one entity-object library per partition, as fine-grained as well-defined domains allow; lock the unavoidable common library to the team that owns the database.
**Costs**: more libraries to version, in exchange for schema changes touching only the affected services. A single shared library is the worst of the options.

## Broker Topology
**When**: simple event flows needing high responsiveness and decoupling.
**How**: processors accept events, act, and advertise what they did via topics — always advertise, even when nobody listens; that hook is the extensibility.
**Costs**: highly decoupled, scalable, responsive and fault tolerant, but with no workflow control, error handling, recoverability, restart, or data consistency.

## Mediator Topology
**When**: workflow control, error handling, recoverability or restart are required.
**How**: a domain-scoped mediator accepts the initiating event, issues commands to dedicated queues, waits for an acknowledgement per step, and holds transaction state persistently.
**Costs**: more coupling, lower scalability, lower performance, lower fault tolerance, and difficulty modelling dynamic flows — expect a hybrid, with a broker for the dynamic parts.

## Workflow Event Pattern
**When**: error handling in asynchronous flows, without sacrificing responsiveness.
**How**: the consumer delegates the error immediately and moves to the next message; a workflow processor diagnoses, repairs programmatically, and resubmits; unfixable messages go to a human dashboard for manual repair and resubmission.
**Costs**: repaired messages are processed out of sequence. Where order matters within a context, queue subsequent messages for that context and replay them in order after the fix.

## Preventing Data Loss in Messaging
**When**: any asynchronous flow that persists data.
**How**: persistent queues plus synchronous send from producer to broker; client acknowledge mode from broker to consumer; a transactional commit with last-participant support from consumer to database.
**Costs**: synchronous send blocks the producer; client acknowledge holds messages longer.

## Request-Reply Messaging
**When**: a synchronous need inside an asynchronous architecture — an order ID, a confirmation number.
**How**: two queues per channel. Prefer the correlation-ID technique: record the request message ID and wait on the reply queue with a selector matching it.
**Costs**: temporary queues are simpler, but the broker must create and delete one per request, which slows it badly at volume. Request-reply also welds both processors into the same quantum.

## Replicated and Distributed Caching
**When**: choosing a cache per processing unit, not per application.
**How**: replicated for small, relatively static, low-update data where fault tolerance is critical. Distributed for large, highly dynamic, high-update data where consistency is critical.
**Costs**: replicated gives performance and no single point of failure; distributed gives consistency but is itself a single point of failure and adds remote latency.

## Data Pumps
**When**: space-based architecture, keeping the database off the transactional path.
**How**: the updating unit owns sending the change asynchronously, with guaranteed delivery and preserved order. On total cache loss the first unit to take the lock requests data, a reader queries and returns it through the reverse pump, and the lock releases.
**Costs**: eventual consistency between cache and database. Readers are invoked only on total crash, full redeploy, or archive retrieval.

## Sidecar and Service Mesh
**When**: microservices needing consistent operational concerns without domain coupling.
**How**: put monitoring, logging and circuit breakers in a sidecar in each service, owned by a shared infrastructure team; connect sidecars through the service plane into a mesh giving global operational control.
**Costs**: splits duplicated domain concerns from reused operational ones — the deliberate correction to reuse-everything service architectures.

## Saga Pattern
**When**: sparingly. Only when two services need vastly different characteristics yet still require transactional coordination.
**How**: a mediator calls each part, records success or failure, and coordinates. On error it sends undo requests to every successful part, via pending state or an explicit do/undo per operation.
**Costs**: violates the decoupling the split was for, and couples the parts by value. Pending state gets complex under asynchrony and generates heavy network traffic; do/undo more than doubles design, implementation and debugging work. Sagas as the dominant feature mean the granularity is wrong.

## Risk Matrix
**When**: qualifying architecture risk for §15 without reducing it to an adjective.
**How**: impact (1–3) multiplied by likelihood (1–3), impact scored first; 1–2 low, 3–4 medium, 6–9 high. Unproven technology scores 9 automatically — the matrix does not apply to something nobody has measured. Accumulate by criterion and by area, and show direction of travel where a fitness function supplies it.
**Costs**: still involves judgment, but removes most of the subjectivity from the label.

## Third-Party Library Governance
**When**: recording a decision that adopts a library or framework.
**How**: require two answers — whether it overlaps functionality that already exists, and what the technical *and* business justification is. Then scale the decision to the blast radius: special-purpose, the implementer decides; general-purpose, the implementer analyses and an architect approves; framework, the architect decides.
**Costs**: slows adoption, in exchange for preventing duplicate functionality and invasive framework sprawl.
