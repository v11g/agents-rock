# RideMetrics — analytics platform for a taxi fleet operator

Modelled on the Azure Architecture Center "Stream processing with Azure
Databricks" reference (taxi trip + fare streams, neighbourhood enrichment,
rolling averages) extended with the batch, lakehouse, catalog and reporting
layers of "Analytics end-to-end with Microsoft Fabric". Medallion layering per
Databricks docs; batch orchestration per Apache Airflow best practices; gold
modelling and tests per dbt.

## 1. Purpose

Give fleet operations and finance a single place to see trip volume, revenue
and tip-per-mile by neighbourhood, live and historically, and to satisfy rider
privacy requests.

## 5. C4 containers

| # | Container | Tech | Who uses it |
|---|---|---|---|
| C1 | Ingestion Gateway | Azure Event Hubs, Data Factory copy jobs | Taxi devices (producers), source DBs; data engineers configure |
| C2 | Lakehouse Processing | Azure Databricks (Spark Structured Streaming, Delta Lake on ADLS), dbt | Data engineers |
| C3 | Orchestrator | Apache Airflow | Data engineers, finance (manual backfill trigger) |
| C4 | Serving Warehouse | Fabric Warehouse / SQL analytics endpoint | Analysts, BI tools, privacy officer (request table) |
| C5 | Analytics Portal | Power BI + Data Activator | Ops managers, finance, executives |
| C6 | Platform Services | Microsoft Purview, Azure Monitor / Log Analytics, Key Vault | Platform team, data stewards |

## 6. Components

| Component | Responsibility | Tech | Deploy unit | src |
|---|---|---|---|---|
| Event Ingest Hub | Receives trip and fare events from taxi devices, partitioned by taxi id so both streams for one cab land on the same partition. | Event Hubs (2 hubs, auto-inflate) | C1 Ingestion Gateway | infra/eventhubs/ |
| Schema Registry | Holds versioned Avro schemas for each event type and rejects producer changes that break backward compatibility. | Event Hubs Schema Registry | C1 Ingestion Gateway | schemas/ |
| Batch Connector Jobs | Copies the dispatch database (nightly CDC) and partner CSV drops into the bronze landing zone. | Data Factory copy jobs | C1 Ingestion Gateway | pipelines/adf/ |
| Bronze Loader | Appends raw events and files to bronze Delta tables with ingest timestamp, source and batch id; no transformation. | Spark job, Delta | C2 Lakehouse Processing | jobs/bronze/ |
| Stream Processor | Joins trip and fare streams on taxi id + pickup time with a 10-minute watermark, enriches with neighbourhood lookup, writes 5-minute windowed averages to silver. | Spark Structured Streaming | C2 Lakehouse Processing | jobs/stream/ |
| Dead-Letter Handler | Routes malformed or schema-mismatched records to a quarantine table and emits a malformed-record count per source. | Spark job, Delta | C2 Lakehouse Processing | jobs/deadletter/ |
| Silver Transforms | Deduplicates, casts types, drops invalid rows and resolves late-arriving trips into conformed trip, fare and driver tables. | Spark / Delta Live Tables | C2 Lakehouse Processing | jobs/silver/ |
| Gold Marts | Builds dimensional models and aggregates (tips per mile by neighbourhood, driver scorecard, daily revenue) from silver. | dbt on Databricks SQL | C2 Lakehouse Processing | dbt/models/gold/ |
| Data Quality Tests | Runs not_null/unique/accepted_values tests on every model and freshness thresholds on every declared source; fails the run on error. | dbt tests + source freshness | C2 Lakehouse Processing | dbt/tests/, dbt/models/sources.yml |
| Privacy Erasure Job | Reads the deletion-request table, deletes the rider from bronze, propagates to silver and gold, updates request status. | Spark job (MERGE … DELETE) | C2 Lakehouse Processing | jobs/privacy/ |
| DAG Scheduler | Defines Airflow DAGs for nightly loads, dbt runs and tests; partitions by data interval so reruns are idempotent. | Airflow DAGs | C3 Orchestrator | dags/ |
| Backfill Runner | Reprocesses a chosen date range by deleting the affected partitions then reloading silver and gold. | Airflow parameterised DAG | C3 Orchestrator | dags/backfill/ |
| Serving SQL Endpoint | Exposes gold tables over T-SQL with row-level security per fleet operator; hosts the deletion-request table. | Fabric Warehouse | C4 Serving Warehouse | warehouse/ |
| Semantic Model | Defines measures (avg tip per mile, utilisation %, revenue) and relationships over gold tables. | Power BI dataset (Direct Lake) | C5 Analytics Portal | bi/model/ |
| Dashboards | Operations and executive reports: live neighbourhood map, driver scorecards, daily revenue. | Power BI reports | C5 Analytics Portal | bi/reports/ |
| Metric Alerts | Evaluates rules on dashboard visuals and sends email/Teams messages when a KPI crosses a threshold. | Data Activator | C5 Analytics Portal | bi/alerts/ |
| Data Catalog & Lineage | Scans lakehouse and Power BI assets, assigns sensitivity labels, records lineage, holds glossary terms. | Microsoft Purview | C6 Platform Services | governance/purview/ |
| Pipeline Monitoring | Collects Spark logs and metrics (including malformed counts), run durations and freshness; alerts the on-call engineer on failure or SLA breach. | Azure Monitor + Log Analytics | C6 Platform Services | infra/monitoring/ |

## 9. External systems

| System | Used for | Component that integrates |
|---|---|---|
| Taxi meter and payment devices | Produce trip and fare events | Event Ingest Hub |
| Dispatch operational database (SQL Server) | Driver, vehicle and shift reference data, nightly CDC | Batch Connector Jobs |
| Weather data partner (daily CSV via SFTP) | Weather by hour and zone for demand analysis | Batch Connector Jobs |
| Microsoft Teams / Exchange Online | Deliver KPI alerts and pipeline-failure notices | Metric Alerts, Pipeline Monitoring |

## 10. Store and retention rules

Bronze is append-only and retained 2 years; Delta history is retained 30 days
then VACUUMed; silver and gold are rebuilt from bronze on backfill. Rider PII
exists in bronze and silver only; gold is keyed by surrogate ids.
