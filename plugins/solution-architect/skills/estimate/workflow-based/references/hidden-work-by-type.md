# Hidden work by project type — human reference

Researched add-ons for six project types (78 sources). **Not an agent input**: in testing they made the linker over-link and gave the reviewer no surviving adds. Architects read them when reviewing ARCHITECTURE.md §6 before an estimate. Source and test data: `docs/research/2026-10-06-linking-rubric/`.


---

# Add-on: web/mobile business application (SPA or mobile app + API + database)

Read with ../linking-v3-core.md. Rubric numbers below refer to its questions 1–8.

## Components this type usually has

| Component kind | What it does | Rubric question that finds it | Source |
|---|---|---|---|
| Web SPA / mobile app | Screens a person uses; calls the API over HTTP | 1 (who acts) | [1] |
| Web API / front-end service | Handles client requests, owns business rules and the ordinary tables behind them | 2 (what rule, what data) | [1][2] |
| Background worker | Long-running, batch or scheduled work, triggered by queue messages or a schedule | 3 (no person) | [1] |
| Message queue | Decouples API from worker; stateless on both sides | 3, but 8 (link only when a new queue/topic is added) | [1] |
| Identity provider / login | Authenticates users; often a managed service (Entra ID, Cognito, Firebase) | 8 (link only when sign-in flow changes) | [1][2] |
| Permission / authorization module | Enforces roles or attributes server-side on every request; least privilege | 2 for a new rule, 8 for reuse | [10] |
| Relational database | Tables and constraints; one or several ("polyglot persistence") | 5 (store-specific work only) | [1][2] |
| Cache | Session state and semi-static data for fast reads | 5 / 8 | [1] |
| Object store + CDN | Uploaded files and static assets; files kept out of the web root | 5 (new bucket, retention) | [1][13] |
| Upload pipeline | Issues presigned/expiring upload URLs, validates, renames, scans and re-encodes files | 2 + 3 (scan runs without a person) | [13][14] |
| Notification sender | Sends email / SMS / push via remote providers; owns templates | 1 (who is told) + 4 (outside) | [1][7][15] |
| Push token registry | Stores a registration token per app instance so the server can target a device | 2 (data this feature needs) | [7] |
| Offline local store + sync engine (mobile) | Local DB as source of truth; push/pull queues; conflict resolution | 2 + 3 (sync starts on a timer / connectivity) | [5][6] |
| Audit log | Records who changed what, when, old and new values; tamper-evident, retained per regulation | 2 | [11][12] |
| Tenant onboarding / tenant mapping (SaaS) | Provisions and configures a new tenant; maps tenant → deployment | 2 + 3 (self-serve or provider-run) | [3][4] |
| Telemetry / monitoring | Request and dependency logs, health model, alerts | 8 (link only when a new signal is required) | [2] |

## Work estimates for this type usually miss

- **Offline sync is server work too.** The app needs a local store as source of truth, write queues drained when online, and conflict resolution by timestamp or version; the API must expose `updatedAt`/version fields and incremental (delta) reads. Missed because "works offline" sounds like a client switch. Lands in: mobile app (store + sync) AND the API module that owns the data. [5][6]
- **Push notifications need a token registry and store compliance.** The server must store registration tokens per app instance and send through FCM/APNs; App Store rules require opt-in for promotional pushes and an in-app opt-out, and the app must work without push. Missed because it is priced as "send a message". Lands in: notification sender, push token registry, mobile app settings screen. [7][8]
- **App-store release is a feature-sized task.** Review demo account with backend switched on, privacy-policy link in metadata and in-app, in-app account deletion if sign-up exists, store listing, testing tracks, release notes per language, staged rollout. Missed because none of it appears in the feature list. Lands in: mobile app; account deletion also in the API user module. [8][9]
- **A new role is not a dropdown value.** Authorization must be validated on every request server-side; a new role or "only X may" rule changes the permission module and every endpoint that now enforces it, plus tests for the denial paths. Missed because the UI change looks small. Lands in: permission module + each affected API module. [10]
- **File upload is a pipeline, not a form field.** Allow-listed extensions, signature check (Content-Type can be spoofed), generated filenames, size caps, antivirus/CDR, image re-encoding, storage outside the web root; presigned URLs expire and must match the declared content type. Missed because the first demo "just uploads". Lands in: API (URL issuer + metadata), worker (scan/re-encode), object store only if a new bucket or retention rule is needed. [13][14]
- **Every notification type is a template.** Stored templates carry subject, HTML and text parts with placeholders; rendering failures need an event path so bad data is caught. Missed because email is listed as "a remote service". Lands in: notification sender. [1][15]
- **Audit trail must be designed, not assumed.** What to log is set "during requirements and design": auth success/failure, access-control failures, admin actions, sensitive-data access, with when/where/who/what and old/new values; tamper detection and retention per legal obligation. Missed because framework logs feel free. Lands in: audit log component + each module whose actions must be recorded. [11][12]
- **Accessibility is per screen.** WCAG 2.2 success criteria at level A/AA apply to web and web-on-mobile content; every new screen inherits them. Missed because it is non-functional and untested until audit. Lands in: SPA / mobile app. [16]
- **Tenant onboarding orchestrates several components.** Creating a tenant means provisioning identity, configuration and possibly per-tenant databases or stamps, and recording the tenant → deployment mapping; isolation must be tested. Missed because "sign-up" reads as one form. Lands in: tenant onboarding component, identity, database (Q5 when a per-tenant store is created). [3][4]
- **Write-then-enqueue can lose the second half.** If the API writes the DB and then fails before posting the queue message, the worker never runs; a transactional outbox is extra work. Missed because the happy path hides it. Lands in: API module + worker. [1]

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature promise to work offline? If so, are both the mobile app (local store + sync queue) and the API module owning the data (version fields, delta endpoint) linked — and does the feature actually change them, or only use them?
- Does any feature notify a user? If so, is the notification sender linked, plus the channel piece (push → token registry + opt-in screen; email → that template) — and does the feature actually change them (a new template, a new channel), or only use them?
- Does any feature add a role or an "only X may…" rule? If so, are the permission module and each API module whose endpoints now enforce it linked — and does the feature actually change them (a new rule), or only reuse an existing role (Q8, nothing shared)?
- Does any feature accept a file? If so, are the API (URL issuer, metadata) and the worker (scan/re-encode) linked — and does the feature actually change the object store (a new bucket or retention rule, Q5), or only use it?
- Does any feature need to be auditable or show change history? If so, are the audit log and each module that must emit records linked — and does the feature actually change them (new record kinds), or only use existing platform telemetry?
- Does any feature change what a tenant gets (plan, isolation, region)? If so, is tenant onboarding/mapping linked — and does the feature actually change it, or only use the sign-up screen?

## Sources

1. Web-Queue-Worker architecture style — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/web-queue-worker
2. Basic web application — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/web-apps/app-service/architectures/basic-web-app
3. Tenancy models for a multitenant solution — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models
4. Tenant onboarding — AWS Well-Architected SaaS Lens. https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-onboarding.html
5. Build an offline-first app — Android Developers. https://developer.android.com/topic/architecture/data-layer/offline-first
6. Offline data sync for mobile apps — Microsoft Learn (Azure Mobile Apps, archived). https://learn.microsoft.com/en-us/previous-versions/azure/developer/mobile-apps/azure-mobile-apps/howto/data-sync
7. FCM architectural overview — Firebase. https://firebase.google.com/docs/cloud-messaging/fcm-architecture
8. App Store Review Guidelines — Apple Developer. https://developer.apple.com/app-store/review/guidelines/
9. Prepare and roll out a release — Google Play Console Help. https://support.google.com/googleplay/android-developer/answer/9859348
10. Authorization Cheat Sheet — OWASP. https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
11. Logging Cheat Sheet — OWASP. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
12. Audit Log — Martin Fowler. https://martinfowler.com/eaaDev/AuditLog.html
13. File Upload Cheat Sheet — OWASP. https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
14. Uploading objects with presigned URLs — Amazon S3 User Guide. https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
15. Using templates to send personalized email — Amazon SES Developer Guide. https://docs.aws.amazon.com/ses/latest/dg/send-personalized-email-api.html
16. WCAG 2 Overview — W3C Web Accessibility Initiative. https://www.w3.org/WAI/standards-guidelines/wcag/

---

# Add-on: data pipeline / analytics platform

Applies on top of ../linking-v3-core.md. Covers batch + streaming ingestion,
lakehouse/warehouse transformation (bronze → silver → gold), and dashboards.

## Components this type usually has

| Component kind | What it does | Rubric Q | Source |
|---|---|---|---|
| Batch connector jobs | Copy/CDC from source DBs, files, SaaS into a landing zone on a schedule | 3, 4 | [1], [7] |
| Event ingest hub | Receives streams, partitions by key, buffers for consumers | 3, 4 | [8], [9] |
| Schema registry / contract | Stores event schemas; enforces compatibility when producers change shape | 2 | [11] |
| Bronze (raw) loader | Appends raw records with ingest time, source, batch id; no business logic | 2 | [3] |
| Stream processor | Joins streams, windows, watermarks, enriches with lookups | 3 | [8] |
| Silver transforms | Dedup, type cast, schema enforcement, late/out-of-order handling | 2 | [3] |
| Gold marts / modelling layer | Dimensional models and aggregates for one business use | 2 | [3], [5] |
| Data quality tests + freshness | Assertions per model/source; warn/error when a source stops updating | 2, 1 | [5] |
| Dead-letter / quarantine handler | Captures malformed or unschema'd records for review and metrics | 3 | [10], [8] |
| Orchestrator / scheduler | DAGs, retries, backfill by data interval, idempotent reruns | 3 | [6] |
| Catalog, lineage, governance | Metadata scans, classification, central access policies | 8 (only when changed) | [2], [7] |
| Serving SQL endpoint | Query interface over gold; row-level security per tenant/role | 1, 5 | [7] |
| Semantic model + dashboards | Measures, reports, alerts on visuals delivered by email/Teams | 1 | [7] |
| Pipeline monitoring | Run logs, malformed-record gauges, SLA/freshness alerts to owners | 1 | [8], [12] |
| Privacy erasure / retention job | Propagates deletes bronze→silver→gold, upstream queues; vacuums history | 5, 3 | [4] |

## Work estimates for this type usually miss

- **Backfill / reprocessing.** Changing a transform means re-running history, not just new data. Missed because only the new logic is counted. Lands in Orchestrator (backfill runner) + the changed transform. [6], [2] (keep raw to repeat ETL).
- **Schema evolution across layers.** A new field or event type touches registry version, bronze (store as string/VARIANT), silver cast, gold column, semantic model. Missed as "just a new column". Lands in Schema registry + every layer crossed. [11], [3].
- **Late-arriving and out-of-order data.** Streaming aggregates need watermark and window decisions and a restatement path. Missed because batch thinking assumes complete data. Lands in Stream processor / Silver. [3], [8].
- **Dead-letter path.** Malformed records need a sink, a metric, and a review flow or data silently vanishes. Missed because only the happy path is designed. Lands in Dead-letter handler + Pipeline monitoring. [10], [8].
- **Tests and freshness per new dataset.** Each new source/model needs `not_null`/`unique` tests and a freshness threshold; a stalled source otherwise fails silently. Lands in Data quality tests. [5].
- **Idempotent loads.** Reruns must upsert or overwrite a partition, never append; `datetime.now()` in logic breaks reruns. Missed because INSERT looks simpler. Lands in Bronze loader / Silver transforms. [6].
- **Privacy deletes propagate.** One DELETE is not enough: silver, gold, streaming tables, upstream Kafka/queues, and VACUUM of 30-day history all need work. Lands in Privacy erasure job + lakehouse store settings. [4].
- **Catalog registration and access policy.** A new dataset must be scanned, classified, and granted centrally. Missed as "platform stuff". Lands in Catalog only when a new classification or policy is needed. [2], [7].
- **Monitoring for the new pipeline.** Someone must be told when a run fails or data is stale. Lands in Pipeline monitoring. [8], [12] (DataOps undercurrent).

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature add a new source or event type? If so, is each layer the data crosses linked — connector/ingest hub, schema registry, bronze loader, silver transform, gold mart, data quality tests — and does the feature actually change each one (new schema, cast, column, test), or does the data only pass through it unchanged?
- Does any feature change a metric definition? If so, are the gold mart and the semantic model linked, plus the backfill runner when history must be restated — and does the feature actually change them, or only read them?
- Does any feature promise "live" data or "within N minutes"? If so, are the stream processor and pipeline monitoring (freshness alert) linked rather than the batch scheduler — and does the feature actually change them (a new window, a new alert), or only use an existing stream?
- Does any feature delete or retain personal data? If so, are the erasure job and the lakehouse store (vacuum/retention rules — the one common case where the store itself gets work, Q5) linked — and does the feature actually change them, or only use them?
- Does any feature add a dashboard over existing gold tables? If so, is the semantic model/dashboards linked — and does the feature actually change any pipeline layer beneath, or only read from it?
- Does any feature include a step triggered by a schedule or an arriving file, or by an arriving event? If so, is the orchestrator (schedule/file) or the stream processor (event) linked — and does the feature actually change it (a new DAG, a new stream job), or only use an existing run?

## Sources

1. Modern Data Analytics Reference Architecture on AWS — https://docs.aws.amazon.com/reference-architecture-diagrams/latest/modern-data-analytics-on-aws/modern-data-analytics-on-aws.html
2. AWS Well-Architected Data Analytics Lens, Characteristics — https://docs.aws.amazon.com/wellarchitected/latest/analytics-lens/characteristics-1.html
3. Databricks, What is the medallion lakehouse architecture? — https://docs.databricks.com/aws/en/lakehouse/medallion
4. Azure Databricks, Prepare your data for GDPR compliance — https://learn.microsoft.com/en-us/azure/databricks/security/privacy/gdpr-delta
5. dbt Docs, Add sources to your DAG (source freshness, source tests) — https://docs.getdbt.com/docs/build/sources
6. Apache Airflow, Best Practices (idempotency, partitions, testing DAGs) — https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html
7. Azure Architecture Center, Analytics end-to-end with Microsoft Fabric — https://learn.microsoft.com/en-us/azure/architecture/example-scenario/dataplate2e/data-platform-end-to-end
8. Azure Architecture Center, Stream processing with Azure Databricks — https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/data/stream-processing-databricks
9. Google Cloud blog, Pub/Sub launches direct path to BigQuery — https://cloud.google.com/blog/products/data-analytics/pub-sub-launches-direct-path-to-bigquery-for-streaming-analytics
10. Google Cloud blog, Goodbye Hadoop: building a streaming pipeline (Qubit; dead-letter topic) — https://cloud.google.com/blog/products/data-analytics/goodbye-hadoop-building-a-streaming-data-processing-pipeline-on-google-cloud
11. Confluent, Schema Evolution and Compatibility — https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html
12. Joe Reis (co-author, Fundamentals of Data Engineering), The Data Engineering Lifecycle and Undercurrents, 4 Years Later — https://joereis.substack.com/p/the-data-engineering-lifecycle-and

---

# Add-on: LLM application (chat/assistant, RAG, agents) — `llm-rag`

Use with ../linking-v3-core.md. Question numbers below refer to the core rubric.

## Components this type usually has

| Component kind | What it does | Rubric question that finds it | Source |
|---|---|---|---|
| Chat UI (streaming + citation rendering) | The screen a person types in; streams tokens, shows cited passages, collects thumbs up/down | 1 | [8], [4] |
| Orchestrator / agent loop | Routes the request, calls the model, runs the tool loop, enforces stop conditions (max iterations, budget) | 2 | [1], [3] |
| Prompt registry | Versioned system prompts and tool lists; owns cache-breakpoint order (tools → system → messages) | 2, 8 | [2], [8] |
| Retriever | Embeds the query, runs vector/hybrid search, reranks, applies metadata and permission filters | 2 | [6], [9] |
| Ingestion pipeline (connector → parser → chunker → embedder → indexer) | Pulls source documents on a schedule or event, splits, embeds, upserts, removes stale chunks | 3 | [9], [6] |
| Vector index / store | Stores chunk vectors + metadata; indexes (HNSW), ACL columns, tombstones, retention | 5 | [9], [10] LLM08 |
| Conversation store | Persists sessions and message history for multi-turn context; retention and ownership checks | 2, 5 | [8] |
| Tool gateway + tool adapters | Tool schemas and descriptions, execution, allow-list, confirmation gates, `is_error` handling | 4 | [3], [10] LLM06 |
| Guardrail filter | Checks user input and model output: injection, denied topics, PII masking, grounding check | 2 | [7], [10] LLM01/05 |
| Eval runner + golden set + judge | Replays a question set, scores faithfulness / context recall / relevancy, stores results | 3 | [9], [11] |
| Trace / usage logger | Per-call tokens, cache hits, latency, tool spans, cost per conversation; feeds alerts | 2 | [8], [5] |
| Feedback capture | Turns a thumbs-down or "report" into a review item and an eval candidate | 1 | [8], [9] |

## Work estimates for this type usually miss

- **Eval-set upkeep.** Every new document type, tool, or prompt change needs new golden questions and a judge rubric; missed because "testing" is read as unit tests. Lands in Eval runner. [9], [11]
- **Deletes and re-syncs.** Updated or removed source documents must drop their stale chunks, or the assistant keeps answering from them; missed because ingestion is priced as a one-time upload. Lands in Ingestion indexer + Vector index. [6], [9]
- **Permission-aware retrieval.** Document ACLs have to be captured at ingest and filtered at query time; missed because "auth" is assumed to be covered by login. Lands in Connector, Retriever, Vector index. [6], [10] LLM02/LLM08
- **Tool safety.** Least-privilege credentials per tool, parameter validation, human confirmation before side effects, error results returned to the model; missed because a tool call looks like one API call. Lands in Tool gateway. [1], [3], [10] LLM06
- **Guardrails on both sides.** Input filtering for injection plus output checks for PII and grounding; missed because the model is assumed to "handle safety". Lands in Guardrail filter. [7], [10] LLM01/LLM05
- **Cache layout.** Prompt caching is a prefix match; any change to tools or system text invalidates everything after it, so breakpoint placement and hit-rate monitoring are real work. Lands in Prompt registry + Orchestrator. [2]
- **Token and cost telemetry.** `max_tokens` caps, per-user quotas, rate limits, cost per conversation; missed because billing is assumed to be the vendor's problem. Lands in Trace logger + Orchestrator. [8], [10] LLM10, [5]
- **Model and prompt pinning.** Pinning model versions and re-running evals when the provider ships a new model; missed because it is seen as config. Lands in Prompt registry + Eval runner. [8]
- **Parsing per document type.** PDFs with tables, scanned pages, slides, and spreadsheets each need parser work; missed because "documents" is one word in the brief. Lands in Parser/chunker. [6]
- **Conversation retention.** Purging stale conversations and bounding history length; missed because history is "just a table". Lands in Conversation store. [8]

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any RAG feature add a new document type or source? If so, are the Connector, Parser/chunker, Embedding indexer and Eval runner (new golden questions) linked — and does the feature actually change each one (a new parser, a new chunking rule, new questions), or only pass documents through it?
- Does any feature let the agent act on the outside (ticket, email, write)? If so, are the Tool gateway, the adapter, the Guardrail filter and the Chat UI confirmation step linked, not the adapter alone — and does the feature actually change each one (a new tool schema, a new allow-list entry, a new confirmation gate), or only use it?
- Does any feature decide who may see what? If so, are the Retriever (filter), the Vector index (ACL column/index — Q5 applies) and the Connector (ACL capture) linked — and does the feature actually change them, or only use an existing filter?
- Does any feature change the system prompt, tool list or model? If so, are the Prompt registry and Eval runner linked — and does the feature actually change the Orchestrator (cache breakpoints move), or only use it?
- Does any feature need a new index, metadata column, tombstone or retention rule on the Vector index? If so, is the Vector index linked — and does the feature actually change it, or only upsert ordinary chunks through the Embedding indexer?
- Does any feature tell the knowledge team something? If so, is the component that integrates with the channel (Q1/Q4) linked rather than the dashboard that merely displays the same data — and does the feature actually change it (a new message kind, a new channel), or only use it?

## Sources

1. Anthropic — Building effective agents — https://www.anthropic.com/research/building-effective-agents
2. Anthropic — Prompt caching — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
3. Anthropic — Tool use with Claude (overview) — https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
4. Anthropic — Citations — https://platform.claude.com/docs/en/build-with-claude/citations
5. AWS — Well-Architected Generative AI Lens — https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/generative-ai-lens.html
6. AWS — Amazon Bedrock Knowledge Bases — https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html
7. AWS — Amazon Bedrock Guardrails — https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html
8. Microsoft — Baseline Foundry chat reference architecture — https://learn.microsoft.com/en-us/azure/architecture/ai-ml/architecture/baseline-openai-e2e-chat
9. Google Cloud — Infrastructure for a RAG-capable generative AI application using Vertex AI — https://docs.cloud.google.com/architecture/rag-capable-gen-ai-app-using-vertex-ai
10. OWASP — Top 10 for LLM Applications 2025 — https://genai.owasp.org/llm-top-10/
11. Ragas — Available metrics — https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/

---

# Add-on: public API / developer platform (read linking-v3-core.md first)

## Components this type usually has

| Component kind | What it does | Rubric q. | Source |
|---|---|---|---|
| Gateway / key authenticator | Terminates TLS, validates API key or OAuth token, resolves key -> tenant/plan; keys identify, they do not authorize | 1, 8 | [1][3] |
| Rate limiter + quota enforcer | Per-key throttling (rate/burst) and per-period quotas; returns 429 + `x-ratelimit-*` headers | 2, 8 | [1][10] |
| Scoped-key / permission model | Restricted keys with per-resource permissions, test vs live mode, IP/ASN access policies | 2, 8 | [8][4] |
| Version negotiator | Reads version header, routes to handler, applies compat transforms; date-named versions with 24-month support | 2 | [7][11][12] |
| Idempotency layer | Stores first response per `Idempotency-Key` (~24h), replays it, rejects same key with different params | 2, 5 | [6] |
| Standard error + validation envelope | One error schema, request validation against OpenAPI, pagination/filter conventions | 2 | [14] |
| Long-running operation handler | For >10s work returns an Operation resource the client polls | 2, 3 | [13] |
| Event outbox + webhook dispatcher | Signs (HMAC + timestamp), delivers, retries with backoff for days, no ordering guarantee | 3, 4 | [5] |
| Usage meter / aggregator | Rolls access logs into per-key usage, emits meter events to billing, exposes usage to the developer | 3, 4 | [9][2] |
| Key lifecycle worker | Rotation with grace window, expiry, unused-key limiting, compromise revocation | 3 | [8] |
| Developer portal | Signup, org/app management, key console, webhook endpoint console, usage view | 1 | [2] |
| API reference + changelog | Docs rendered from the spec, per-version changelog, deprecation/sunset notices | 1 | [11][7] |
| SDK + spec pipeline | Lints spec, diffs for breaking changes, regenerates typed SDKs pinned to a version | 8 | [7][12] |
| Analytics / access log export | Per-key request logs to observability (Datadog, Prometheus); feeds support + abuse detection | 2 | [3][2] |
| Inventory / environment registry | Which versions and endpoints are live where; retires debug and old versions | 8 | [4] |

## Work estimates for this type usually miss

- **Every new endpoint is also a version diff and an SDK release.** A
  required field or type change is breaking under a date-pinned scheme, and
  typed SDKs pin a version; missed because "it's one more field". Lands in:
  version negotiator, SDK + spec pipeline, changelog. [7][11][12]
- **Every new event type is webhook work, not a log line.** A new
  `shipment.delivered` needs an outbox write, a payload schema per API
  version, signing, retries, a portal toggle and docs. Lands in: event
  outbox + dispatcher, webhook endpoint console, API reference. [5]
- **Every billable action needs a meter.** Charging per label means a
  meter event with a stable idempotency identifier, aggregation rule, and a
  surface where the developer sees it; missed because billing is "Stripe's
  job". Lands in: usage aggregator, usage view, billing integration. [9]
- **Every new resource needs object-level authorization.** Ownership check
  on every ID (BOLA) and property-level filtering of response fields; missed
  because the gateway "already authenticates". Lands in: the resource module
  and the scoped-key permission model. [4][1]
- **Non-idempotent POST.** A create endpoint without idempotency double-charges
  on client retry; missed as "the client's problem". Lands in: idempotency layer. [6]
- **Rate limits are a product decision per endpoint.** Expensive endpoints
  need their own cost or point budget (secondary limits); missed because one
  global limit was assumed. Lands in: rate limiter config, docs. [10][4]
- **Test mode is a second environment.** Sandbox keys must hit fake carriers
  and never touch live data; missed when only the live path is priced. Lands
  in: key authenticator, resource modules, external adapters. [8]

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature add or change a response field? If so, are the resource
  module, the version negotiator and the SDK + spec pipeline linked — and does
  the feature actually change each one (a new compat transform, a regenerated
  SDK), or only use them?
- Does any feature fire a new event? If so, are the event outbox, the webhook
  dispatcher config (new type), the webhook console and the docs linked — and
  does the feature actually change each one, or only use an existing event type?
- Does any feature make a call billable? If so, are the usage aggregator and
  the billing integration linked — and does the feature actually change the
  usage ledger store (a new partition or retention rule), or only write through it?
- Does any feature create a resource? If so, is the idempotency layer linked —
  and does the feature actually change the idempotency cache store (TTL or key
  scope), or only use it?
- Does any feature change key permissions, modes or limits? If so, are the
  scoped-key model and the key console linked — and does the feature actually
  change them (a new permission, mode or limit), or only check a key?
- Does any feature add a long-running action? If so, are the operation handler
  and the worker linked — and does the feature actually change them (a new
  operation type, a new job), or only use an existing one?

## Sources

1. AWS — Usage plans and API keys for REST APIs. https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html
2. Google Cloud — What is Apigee? https://docs.cloud.google.com/apigee/docs/api-platform/get-started/what-apigee
3. Kong — Gateway plugin hub. https://developer.konghq.com/plugins/
4. OWASP — API Security Top 10 (2023). https://api-security.owasp.org/editions/2023/en/0x11-t10/
5. Stripe — Receive events in your webhook endpoint. https://docs.stripe.com/webhooks
6. Stripe — Idempotent requests. https://docs.stripe.com/api/idempotent_requests
7. Stripe — API versioning. https://docs.stripe.com/api/versioning
8. Stripe — API keys. https://docs.stripe.com/keys
9. Stripe — Record usage for billing. https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage
10. GitHub — Rate limits for the REST API. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
11. GitHub — REST API versions. https://docs.github.com/en/rest/about-the-rest-api/api-versions
12. Google AIP-180 — Backwards compatibility. https://google.aip.dev/180
13. Google AIP-151 — Long-running operations. https://google.aip.dev/151
14. Google AIP — General guidance index (pagination, errors, request identification). https://google.aip.dev/general

---

# Add-on: ML-heavy product (custom-trained models in production)

Scope: systems that train their own models and run them live — training
pipeline, feature store, registry, serving, drift monitoring, retraining.
Not LLM-API apps (separate add-on). Sculley et al. show the model code is a
small box inside a much larger system of data, serving and monitoring
plumbing [2]; estimates that price "the model" miss most of the work.

## Components this type usually has

| Component kind | What it does | Rubric question that finds it | Source |
|---|---|---|---|
| Feature pipeline (batch and/or streaming) | Computes model inputs from raw events on a schedule or stream (e.g. "txns per card, last 10 min") | 3 (runs without a person) | [1], [7] |
| Online feature store | Low-latency key lookup of precomputed features at prediction time | 2 (data read), 5 if a new store/TTL rule | [1], [3], [7] |
| Offline feature store + feature registry | Point-in-time-correct training sets; shared feature definitions so training and serving agree | 2 | [1], [7] |
| Data validation step | Schema and distribution checks on incoming training data; blocks the run on anomalies | 3 | [1] |
| Training pipeline / orchestrator | DAG: extract → validate → prepare → train → evaluate → register | 3 | [1], [4], [5] |
| Model evaluation & validation gate | Candidate vs champion on holdout and slices; fairness/responsible-AI checks; decides registration | 2 (owns the promotion rule) | [1], [3], [5] |
| Model registry | Versions, lineage (data, code, params), stage (staging/prod), approvals | 2, 5 if new metadata or stage | [3], [4], [5] |
| Metadata / experiment store | Records each pipeline run: params, metrics, artifacts | 2 | [1], [4] |
| Prediction service (online endpoint or batch scorer) | Loads the approved model, fetches features, returns a score | 1 (what the caller uses), 4 (if the caller is external) | [4], [5] |
| Model loader / rollout controller | Hot-swaps versions; routes traffic for shadow, canary, A/B | 2 | [3], [4], [7] |
| Decision / policy layer | Turns a score into an action (thresholds, overrides, rules) | 2 (owns the business rule) | [2] action limits |
| Prediction logger | Writes inputs, features, score, model version per request ("log and wait") | 2, 5 for the log table's partition/retention | [7] |
| Label / feedback joiner | Joins delayed ground truth (chargebacks, clicks, analyst verdicts) to logged predictions | 3, 4 (labels often arrive from outside) | [6], [2] feedback loops |
| Drift & performance monitor | Two-sample tests on feature and prediction distributions vs training baseline; realized accuracy once labels land | 3, 1 (who is told) | [1], [5], [6] |
| Retraining trigger | Schedule / drift event / new-label count → starts the training pipeline | 3 | [1], [5] |
| Labeling / review UI | Humans confirm, correct or label cases; their verdicts become training labels | 1 | [5] (CV labeling), [2] |

## Work estimates for this type usually miss

- **Writing every feature twice.** Training code computes a feature in SQL/pandas; serving recomputes it in the request path. Mismatch = training-serving skew [1], [7]. Missed because the feature "already exists" in the notebook. Lands in the feature pipeline AND the online store, not the model.
- **Point-in-time joins.** A training set that joins today's feature values to last year's events leaks the future. Missed because it looks like an ordinary join. Lands in the offline feature store / training pipeline [1], [7].
- **Getting labels at all.** Ground truth arrives late — seconds for clicks, months for fraud [6]. Someone must store predictions, wait, join, and store the outcome. Missed because teams assume accuracy is measurable at launch. Lands in the prediction logger, the label joiner, and a new warehouse table (Q5) [6], [7].
- **A baseline to drift against.** The monitor needs the training-time distribution snapshot stored with the model. Missed because "monitoring" sounds like dashboards. Lands in the registry (what is stored per version) and the monitor [1], [6].
- **The promotion gate.** Candidate vs champion, per-slice metrics, bias checks, human approval before prod [3], [5]. Missed because teams plan "train then deploy". Lands in the evaluation gate and the registry's stage model.
- **Multi-version serving.** Shadow, canary and rollback need the serving layer to hold two models and split traffic [4], [7]. Missed because the first deploy only has one model. Lands in the model loader / rollout controller.
- **Downstream consumers of a score.** Changing a model changes everything that reads its output (CACE, undeclared consumers) [2]. Missed because the change request names only the model. Lands in the decision layer and any consumer that re-tunes thresholds.
- **Configuration as a first-class artifact.** Feature lists, thresholds, hyperparameters must be versioned with the model or runs are not reproducible [2], [4]. Missed because config "is just a YAML". Lands in the registry and the training pipeline.
- **Validating new upstream data.** Each new source is an unstable data dependency [2]; it needs schema checks before it enters training [1]. Missed because the source "is just another table". Lands in the data validation step.
- **Retraining compute and cost.** Stateless weekly retraining re-reads all data; stateful fine-tuning cuts cost ~45x in one reported case [7]. Missed because training is budgeted once. Lands in the training pipeline and trigger.

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature add a new model input? If so, are the feature pipeline, the offline and online feature stores, data validation and the training pipeline linked rather than only "the model" — and does the feature actually change each one (a new computation, a new schema check), or only read an existing feature?
- Does any feature change what the model predicts (new label, new class, new target)? If so, are the label joiner, the evaluation gate and the monitor linked — and does the feature actually change them (new ground truth, new metrics), or only use the existing ones?
- Does any feature show a score to a person or act on it? If so, is the decision/policy layer linked, not just the prediction service — and does the feature actually change it (a new threshold, override or rule), or only read a score?
- Does any feature start retraining, drift alerts or label ingestion without a person? If so, are the trigger or worker (Q3) and the component that tells the ML engineer (Q1) linked — and does the feature actually change them (a new trigger condition, a new alert), or only use an existing schedule?
- Does any feature change what is stored or decided about a model (new stage, approval, metadata)? If so, is the registry linked — and does the feature actually change it, or only load a model from it?
- Does any feature create a prediction-log or label table? If so, is the warehouse/object store linked (Q5 — partitioning and retention rules) — and does the feature actually change the store, or only write rows into an existing table?

## Sources

1. Google Cloud — MLOps: Continuous delivery and automation pipelines in machine learning — https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning
2. Sculley et al. — Hidden Technical Debt in Machine Learning Systems (NeurIPS 2015) — https://proceedings.neurips.cc/paper/2015/file/86df7dcfd896fcaf2674f757a2463eba-Paper.pdf
3. AWS Well-Architected Framework — Machine Learning Lens — https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/machine-learning-lens.html
4. Microsoft Learn — MLOps: Model management, deployment and monitoring with Azure Machine Learning — https://learn.microsoft.com/en-us/azure/machine-learning/concept-model-management-and-deployment
5. Azure Architecture Center — Machine learning operations (MLOps v2) — https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/machine-learning-operations-v2
6. Chip Huyen — Data Distribution Shifts and Monitoring (Designing Machine Learning Systems, ch. 8 excerpt) — https://huyenchip.com/2022/02/07/data-distribution-shifts-and-monitoring.html
7. Chip Huyen — Real-time machine learning: challenges and solutions — https://huyenchip.com/2022/01/02/real-time-machine-learning-challenges-and-solutions.html

---

# Add-on: IoT / connected devices

Extends ../linking-v3-core.md. Rubric question numbers refer to that file.

## Components this type usually has

| Component kind | What it does | Rubric question that finds it | Source |
|---|---|---|---|
| Device firmware / edge agent | Samples sensors, runs local rules, reconnects with backoff | 3 (runs without a person) | [2] |
| Store-and-forward buffer (on device) | Durable FIFO of messages while offline; replays on reconnect | 3, 2 | [2] |
| Device identity module | Per-device X.509 key in secure element; cert refresh and replacement | 4, 8 (changes only) | [1] |
| Provisioning service + template/hook | Swaps a claim credential for a unique cert, registers the thing, assigns groups; custom pre-provisioning check | 3, 4 | [8], [11] |
| Message broker / cloud gateway | MQTT/AMQP ingress, persistent sessions, connect/disconnect lifecycle events | 3 | [10], [15] |
| Device registry + groups + fleet index | Thing metadata (model, firmware, site), static/dynamic groups, search | 2 | [3] |
| Device twin / shadow | Desired vs reported state, delta, works while device offline | 2, 3 | [6], [12] |
| Routing / rules engine | Filters and fans telemetry out to streams, stores, alerts; error action | 3 | [9], [14] |
| Ingestion stream + normalizer | Queue between broker and compute; validates schema versions | 3 | [4] |
| Telemetry stores (hot time-series, cold raw archive) | Recent queryable readings; raw archive for reprocessing | 5 (only for retention/partition/new store) | [4] |
| OTA / jobs orchestrator + device update agent | Signed image, staged rollout, abort threshold, timeout, A/B rollback | 3, 4 | [7], [13] |
| Fleet management console + API layer | Ops UI and the API that insulates users from the MQTT data plane | 1 | [1], [13] |
| Device health / security monitor | Offline detection from lifecycle events, cert-expiry audit, anomaly quarantine | 3 | [2], [5] |
| Alert / notification sender | Delivers fleet alerts to people (SMS, email, push) | 1, 4 | [2] |
| Installer / companion app | Trusted-user provisioning, Wi-Fi credentials, device-to-site binding | 1 | [8] |

## Work estimates for this type usually miss

- **Offline replay and late data.** Device must buffer to disk, cap the buffer, replay FIFO; ingestion must accept out-of-order and duplicate readings. Missed because the happy path assumes an always-on link. Lands in: edge buffer, ingestion normalizer. [2], [4]
- **Twin reconciliation on reconnect.** Device must subscribe, fetch the full desired document, drop stale versions. Missed because "remote config" looks like a console form. Lands in: device-side shadow sync client. [12], [6]
- **Rollout safety for firmware.** Canary group, rollout rate, abort criteria, timeout, fallback version. Missed because "ship v2" sounds like a file upload. Lands in: jobs orchestrator, update agent, registry groups. [7], [13]
- **Certificate lifecycle.** Expiry audit, rotation via an OTA job, revocation list. Missed because devices outlive their certs and nobody prices year two. Lands in: identity module, health monitor, CA integration. [1]
- **Provisioning claim hardening.** Allow-list of manufactured serials, pre-provisioning hook, disabling a misused claim. Missed because provisioning looks fully managed. Lands in: provisioning hook, registry. [8], [3]
- **Schema versions coexisting in the fleet.** Normalizer must accept N firmware payload versions at once. Missed because the fleet is imagined homogeneous. Lands in: ingestion normalizer. [4]
- **Connectivity state machine.** Lifecycle events + keep-alive + wait-before-alert so brief drops don't page anyone. Missed because "tell me when it goes dark" sounds like a dashboard filter. Lands in: device health monitor. [3], [2]
- **Decommissioning.** Block connection, revoke cert, erase device and cloud data, support ownership change. Missed as "delete the row". Lands in: registry, identity module, CA, telemetry stores (retention). [16], [17], [18]
- **Device diagnostics to the cloud.** Separate diagnostics topic and remote troubleshooting path, distinct from telemetry. Lands in: edge agent, routing rules. [2]
- **User API layer over the data plane.** Users never touch MQTT directly; every user-facing read of device state needs the API layer with per-user authorization. Lands in: console API. [1]
- **Topic namespace and per-device policy.** A new message kind means new topics and policy changes bound to the device identity. Lands in: broker policy (Q8 — it changes). [1]

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature set something on a device remotely? If so, are the console API, the twin/shadow and the device-side sync client linked — and does the feature actually change each one (a new desired-state field, new apply logic after reconnect), or only use an existing setting path?
- Does any feature need readings from an outage? If so, are the on-device buffer and the ingestion normalizer (dedupe, late data) linked — and does the feature actually change the time-series store (retention or partitioning), or only write through it?
- Does any feature change firmware or certificates? If so, are the update agent, the jobs/rollout orchestrator and the registry groups it targets linked, plus the identity module when certs rotate — and does the feature actually change them (a new job type, a new group, a new cert flow), or only run an existing job?
- Does any feature add a new sensor or message kind? If so, are the firmware sampler, the broker topic/policy (Q8, because it changes), the ingestion normalizer and the hot store schema linked — and does the feature actually change each one (a new topic, a new schema version, a new column), or does the message only pass through unchanged?
- Does any feature onboard a device? If so, are the installer app, the provisioning template/hook, the registry and any CA or ERP lookup linked — and does the feature actually change them (a new hook check, a new group assignment), or only use the managed broker, which is pass-through?
- Does any feature alert a person? If so, are the alert evaluator (Q3) and the notification sender (Q1/Q4) linked rather than the console — and does the feature actually change them (a new alert condition, a new channel), or only display in the console?

## Sources

1. AWS Well-Architected IoT Lens — Identity and access management — https://docs.aws.amazon.com/wellarchitected/latest/iot-lens/identity-and-access-management.html
2. AWS Well-Architected IoT Lens — Failure management — https://docs.aws.amazon.com/wellarchitected/latest/iot-lens/failure-management.html
3. AWS Well-Architected IoT Lens — Prepare — https://docs.aws.amazon.com/wellarchitected/latest/iot-lens/prepare.html
4. AWS Well-Architected IoT Lens — Workload architecture — https://docs.aws.amazon.com/wellarchitected/latest/iot-lens/workload-architecture.html
5. AWS Well-Architected IoT Lens — Operate — https://docs.aws.amazon.com/wellarchitected/latest/iot-lens/operate.html
6. AWS IoT Core Developer Guide — Device Shadow service — https://docs.aws.amazon.com/iot/latest/developerguide/iot-device-shadows.html
7. AWS IoT Core Developer Guide — Job configurations (rollout, abort, timeout, retry) — https://docs.aws.amazon.com/iot/latest/developerguide/job-rollout-abort.html
8. AWS IoT Core Developer Guide — Fleet provisioning — https://docs.aws.amazon.com/iot/latest/developerguide/provision-wo-cert.html
9. AWS IoT Core Developer Guide — Rules for AWS IoT — https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html
10. Microsoft Learn — Introduction to Azure IoT (reference architecture) — https://learn.microsoft.com/en-us/azure/iot/iot-introduction
11. Microsoft Learn — Overview of Azure IoT Hub Device Provisioning Service — https://learn.microsoft.com/en-us/azure/iot-dps/about-iot-dps
12. Microsoft Learn — Understand Azure IoT Hub device twins — https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-device-twins
13. Microsoft Learn — Introduction to Device Update for Azure IoT Hub — https://learn.microsoft.com/en-us/azure/iot-hub-device-update/understand-device-update
14. Microsoft Learn — Understand Azure IoT Hub message routing — https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-messages-d2c
15. Eclipse Hono — Component view — https://eclipse.dev/hono/docs/architecture/component-view/
16. IoT Security Foundation — IoT Security Assurance Framework Release 3.0 — https://iotsecurityfoundation.org/wp-content/uploads/2021/11/IoTSF-IoT-Security-Assurance-Framework-Release-3.0-Nov-2021-1.pdf
17. Industrial Internet Consortium — Industrial Internet Reference Architecture v1.9 — https://www.digitaltwinconsortium.org/pdf/IIRA-v1.9.pdf
18. ETSI EN 303 645 V2.1.1 — Cyber Security for Consumer IoT: Baseline Requirements — https://www.etsi.org/deliver/etsi_en/303600_303699/303645/02.01.01_60/en_303645v020101p.pdf
