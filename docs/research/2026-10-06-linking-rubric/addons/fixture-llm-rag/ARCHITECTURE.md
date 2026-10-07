# Helpdesk Copilot — Architecture (fixture, type `llm-rag`)

An internal assistant that answers employee HR/IT policy questions from company
documents with citations, and can open IT tickets on the employee's behalf.
Modelled on the Google Cloud RAG reference architecture (ingestion / serving /
quality-evaluation subsystems) and the Azure baseline chat architecture
(conversation store, prompt versioning, content filters, egress control).

## 5. C4 containers

| Container | Tech | Who uses it |
|---|---|---|
| Chat Web App | React SPA | Employees |
| Admin Console | React SPA | Knowledge managers, ops |
| Assistant API | Node/TypeScript service (Cloud Run) | Chat Web App, Admin Console |
| Ingestion Workers | Python Cloud Run jobs, triggered by Pub/Sub | Scheduler, Admin Console (manual sync) |
| Eval & Ops Jobs | Python Cloud Run jobs, Cloud Scheduler | Scheduler |
| Data Stores | PostgreSQL 16 + pgvector, Cloud Storage bucket | Assistant API, Ingestion Workers, Eval & Ops Jobs |

## 6. Components

| Component | Responsibility | Tech | Deploy unit | src |
|---|---|---|---|---|
| Chat UI | Renders the streaming conversation, shows cited passages inline, and asks the employee to confirm before any tool with side effects runs. | React, SSE | Chat Web App | web/chat |
| Feedback Widget | Captures thumbs up/down and a free-text reason on each answer and posts it to the Assistant API. | React | Chat Web App | web/feedback |
| Source Manager | Lets a knowledge manager connect or remove a SharePoint library, see last-sync status, and trigger a manual sync. | React | Admin Console | admin/sources |
| Eval Dashboard | Shows eval runs over time, per-metric scores, and the review queue of flagged conversations. | React | Admin Console | admin/evals |
| Conversation Service | Creates sessions, stores and reloads message history, enforces that a user can only read their own conversations, applies the 90-day retention rule. | TypeScript, Postgres | Assistant API | api/conversation |
| Orchestrator | Runs the agent loop per turn: routes the request, calls Claude with the current prompt and tools, executes returned tool calls through the Tool Gateway, stops at iteration or token budget. | TypeScript, Anthropic SDK | Assistant API | api/orchestrator |
| Retriever | Embeds the query, runs hybrid (vector + keyword) search over the Vector Index, filters by the caller's document ACLs, reranks, and returns top-k chunks as citable documents. | TypeScript, pgvector | Assistant API | api/retriever |
| Prompt Registry | Stores versioned system prompts and tool lists; fixes the cache-stable order (tools → system → volatile context) and the cache breakpoint; pins the model version. | TypeScript, Postgres | Assistant API | api/prompts |
| Tool Gateway | Holds tool schemas and descriptions, validates tool inputs, enforces the per-tool allow-list and confirmation requirement, returns `is_error` results to the model. | TypeScript | Assistant API | api/tools |
| Ticket Tool Adapter | Maps the `create_it_ticket` tool call to a ServiceNow incident with the employee as requester and returns the ticket number. | TypeScript, ServiceNow REST | Assistant API | api/tools/servicenow |
| Guardrail Filter | Screens user input for prompt injection and denied topics, masks PII in output, and runs a grounding check that flags answers not supported by retrieved chunks. | TypeScript, Claude classifier call | Assistant API | api/guardrails |
| Trace Logger | Records per-call tokens, cache reads, latency, tool spans and cost per conversation to BigQuery; exposes the figures the Eval Dashboard and alerts read. | TypeScript, OpenTelemetry, BigQuery | Assistant API | api/trace |
| Source Connector | Pulls changed, added and deleted files from each connected SharePoint library together with their ACLs, and publishes one ingest message per file. | Python, Microsoft Graph | Ingestion Workers | ingest/connector |
| Document Parser & Chunker | Parses PDF, DOCX and PPTX (including tables and scanned pages via OCR) into text and splits it into overlapping chunks with page references. | Python, Document AI | Ingestion Workers | ingest/parser |
| Embedding Indexer | Embeds chunks, upserts them with metadata and ACLs into the Vector Index, and deletes chunks of files the connector reported removed. | Python, Voyage AI | Ingestion Workers | ingest/indexer |
| Eval Runner | Replays the golden question set nightly, scores faithfulness, context recall and answer relevancy with an LLM judge, stores results, and posts a Slack alert when a metric regresses past threshold. | Python, Ragas-style metrics | Eval & Ops Jobs | evals/runner |
| Vector Index | pgvector tables for chunks with HNSW index, ACL array column and GIN index, and tombstone handling for deleted files. | PostgreSQL 16, pgvector | Data Stores | db/vector |
| Document Blob Store | Bucket holding the raw source files and parsed text for re-indexing, with a 30-day lifecycle rule on parsed intermediates. | Cloud Storage | Data Stores | db/blobs |

## 9. External systems

| System | Used for | Component that integrates |
|---|---|---|
| Anthropic Claude API + Voyage AI | Answer generation, tool calling and judge calls (Claude); text embeddings (Voyage) | Orchestrator, Guardrail Filter, Eval Runner, Retriever, Embedding Indexer |
| Microsoft 365 SharePoint | Source policy documents and their permissions | Source Connector |
| ServiceNow | Creating IT incidents on the employee's behalf | Ticket Tool Adapter |
| Slack | Alerting the knowledge team when answer quality regresses | Eval Runner |
