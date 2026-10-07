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
