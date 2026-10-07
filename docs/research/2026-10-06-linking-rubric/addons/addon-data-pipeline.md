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
