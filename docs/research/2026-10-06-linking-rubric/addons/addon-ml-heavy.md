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
