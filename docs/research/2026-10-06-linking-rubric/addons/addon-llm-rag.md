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
