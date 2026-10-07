# Sentinel — client features

- F1: Real-time fraud decision at checkout — the gateway receives allow / review / block for every card transaction within 100 ms.
- F2: Analyst case review — a fraud analyst opens a flagged transaction, sees why it was flagged, and marks it fraud or legitimate; the verdict becomes a training label.
- F3: Nightly chargeback label ingestion — chargebacks from the card network are matched to past predictions overnight with no one involved, so model accuracy is measured on real outcomes.
- F4: Drift alert — the on-call ML engineer is paged when live feature or score distributions move beyond the production model's baseline.
- F5: Weekly champion/challenger retraining — a new model is trained on fresh labels every week and lands in staging only if it beats the production model on holdout and per-merchant slices.
- F6: Shadow deployment of a candidate model — an ML engineer sends a copy of live traffic to a staging model, compares its scores against production on the dashboard, and promotes or discards it.
