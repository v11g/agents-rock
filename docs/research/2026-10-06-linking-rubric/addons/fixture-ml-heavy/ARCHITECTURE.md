# Sentinel — Real-time Payment Fraud Scoring Platform

Reference fixture for the ML-heavy project type. Modelled on Google's MLOps
level-2 pipeline (automated training → validation → registry → serving,
with drift-triggered retraining) and Azure MLOps v2 (inner loop / registry /
outer loop with staging gate and monitoring). Sentinel trains its own
gradient-boosted fraud models and scores every card transaction of a payment
gateway inside 100 ms. Chargebacks arrive 30–90 days later and become labels.

## 1. Purpose

Return allow / review / block for each transaction; let fraud analysts review
flagged cases; keep the model fresh as fraud patterns shift.

## 5. C4 containers

- **Risk Analyst Console** — React SPA; used by fraud analysts (case review) and ML engineers (model health, promotion).
- **Scoring API** — Python/FastAPI on Kubernetes; called by the gateway's Checkout Service for every transaction.
- **Feature Platform** — Apache Flink streaming jobs + Redis (online) + BigQuery (offline); used by Scoring API and ML Pipeline Platform.
- **ML Pipeline Platform** — Vertex AI Pipelines (Kubeflow) on GKE + MLflow; run on schedule, on drift events, or by ML engineers.
- **Monitoring & Feedback Service** — Python workers on Kubernetes; reads prediction logs and labels, alerts ML engineers, emits retrain events.
- **Data Warehouse** — BigQuery datasets + GCS buckets; the store behind Feature Platform, pipelines and monitoring.

## 6. Components

| Component | Responsibility | Tech | Deploy unit | src |
|---|---|---|---|---|
| Case Review UI | Shows analysts a flagged transaction with its score, top contributing features and history; records a fraud / legit verdict. | React, TanStack Query | Risk Analyst Console | web/src/cases |
| Model Health UI | Shows ML engineers drift charts, realized precision/recall per model version, shadow-vs-production comparisons, and the promote / rollback buttons. | React, Recharts | Risk Analyst Console | web/src/models |
| Prediction Service | Receives a transaction, fetches features by card/merchant key, runs the active model, returns score and decision within 100 ms p99. | FastAPI, ONNX Runtime | Scoring API | scoring/predict |
| Decision Policy Engine | Maps a score to allow / review / block using per-merchant thresholds and hard rules (velocity caps, blocked BINs); owns override precedence. | Python rules module | Scoring API | scoring/policy |
| Model Rollout Controller | Loads approved model versions from the registry; hot-swaps without downtime; splits traffic for shadow and canary deployments. | Python, Kubernetes ConfigMap watch | Scoring API | scoring/rollout |
| Prediction Logger | Writes every request's features, score, decision, model version and latency to the prediction log table asynchronously. | Pub/Sub → BigQuery streaming insert | Scoring API | scoring/logger |
| Stream Feature Processor | Computes near-real-time aggregates (transaction count and amount per card over 10 min / 1 h / 24 h, merchant decline rate) from the transaction stream. | Apache Flink, Kafka | Feature Platform | features/stream |
| Online Feature Store | Serves the latest feature values per entity key with sub-5 ms reads; enforces per-feature TTL. | Redis Cluster | Feature Platform | features/online |
| Offline Feature Store | Stores feature history and feature definitions; builds point-in-time-correct training sets so no future values leak. | BigQuery, Feast registry | Feature Platform | features/offline |
| Data Validation Step | Checks each training extract against the expected schema and training-time statistics; fails the run on missing columns, type changes or large skew. | TensorFlow Data Validation | ML Pipeline Platform | pipelines/validate |
| Training Pipeline | Orchestrates extract → validate → prepare → train → evaluate; records params, metrics and artifacts for each run. | Vertex AI Pipelines, XGBoost, MLflow tracking | ML Pipeline Platform | pipelines/train |
| Model Validation Gate | Compares the candidate to the production champion on holdout and per-merchant-segment slices and on a fairness check; registers to staging only if it wins. | Python, MLflow evaluate | ML Pipeline Platform | pipelines/gate |
| Model Registry | Versions each model with lineage (data snapshot, code commit, params), its training-time feature distributions, stage (staging / production / archived) and approver. | MLflow Model Registry on Cloud SQL | ML Pipeline Platform | pipelines/registry |
| Pipeline Trigger | Starts the training pipeline on a weekly schedule, on a drift event, or when new labels exceed a count threshold. | Cloud Scheduler, Pub/Sub, Cloud Functions | ML Pipeline Platform | pipelines/trigger |
| Drift Monitor | Compares hourly live feature and score distributions against the production model's training baseline (PSI, KS test); alerts ML engineers on breach. | Python worker, scipy | Monitoring & Feedback Service | monitoring/drift |
| Label Joiner | Matches incoming chargebacks and analyst verdicts to logged predictions by transaction id; writes the labels table; computes realized precision/recall per model version. | Python worker, BigQuery | Monitoring & Feedback Service | monitoring/labels |
| Training Data Warehouse | Holds raw transactions, the prediction log, labels and feature history; owns partitioning by day and the 2-year retention policy. | BigQuery, GCS | Data Warehouse | infra/bigquery |

## 9. External systems

| System | Used for | Component that integrates |
|---|---|---|
| Gateway Checkout Service | Sends each transaction for scoring and acts on the returned decision | Prediction Service |
| Card Network Chargeback Feed (SFTP, daily) | Delivers chargeback records that become fraud labels 30–90 days after the transaction | Label Joiner |
| BIN / Issuer Lookup API | Enriches transactions with issuing bank, card type and country | Stream Feature Processor |
| PagerDuty and Slack | Pages the on-call ML engineer and posts drift / retraining notices | Drift Monitor |
