# ColdWatch — connected refrigeration monitoring (fixture)

A grocery chain fits a gateway to each walk-in fridge and freezer. The gateway
samples temperature, door and compressor sensors and reports to the cloud.
Store managers get excursion alerts; the ops team manages the fleet and ships
firmware. Modelled on the Azure IoT cloud-connected pattern and the AWS IoT
Lens (device → managed broker → rules → stream → stores → console).

## §5 C4 containers

- **Fridge Gateway Agent** — C on embedded Linux (Yocto), one per fridge; used by nobody directly, installed by field technicians.
- **Device Cloud** — AWS IoT Core (broker, registry, shadow, jobs, fleet provisioning) plus our Lambda hooks; used by gateways and by the Fleet Console API.
- **Telemetry Platform** — Kinesis, Lambda, Timestream, S3/Firehose, SNS; background, no direct users.
- **Fleet Console** — React web app + Node BFF; used by ops engineers and store managers.
- **Installer App** — React Native (iOS/Android); used by field technicians on site.

## §6 Components

| Component | Responsibility | Tech | Deploy unit | src |
|---|---|---|---|---|
| Sensor Sampler | Reads temperature, door and compressor sensors at the configured interval and applies local threshold rules. | C | Fridge Gateway Agent | agent/sampler/ |
| Offline Buffer | Persists unsent readings to a size-capped disk FIFO and replays them in order on reconnect. | C, SQLite | Fridge Gateway Agent | agent/buffer/ |
| Device Identity Module | Holds the per-gateway private key in the secure element, runs claim-to-permanent-cert exchange, rotates certs before expiry. | C, PKCS#11 | Fridge Gateway Agent | agent/identity/ |
| Shadow Sync Client | Subscribes to shadow deltas, fetches the full desired document on reconnect, reports applied state and version. | C, MQTT | Fridge Gateway Agent | agent/shadow/ |
| OTA Update Agent | Downloads a signed image, verifies signature, writes the inactive A/B slot, reboots, confirms or rolls back, reports job status. | C | Fridge Gateway Agent | agent/ota/ |
| Provisioning Template & Hook | Checks a new gateway's serial against the manufacturer allow-list, assigns thing name, store group and policy during fleet provisioning. | Lambda (TS), IoT provisioning template | Device Cloud | cloud/provisioning/ |
| Device Registry & Groups | Stores thing attributes (model, firmware, store, fridge id), static store groups and dynamic groups (firmware version, battery). | IoT Core registry, fleet indexing | Device Cloud | cloud/registry/ |
| Fridge Shadow Schema | Defines named shadows `config` (interval, thresholds) and `status` (reported firmware, last boot) and their JSON contracts. | IoT Device Shadow | Device Cloud | cloud/shadow/ |
| Rollout Orchestrator | Creates jobs targeting a thing group with rollout rate, abort threshold on failures and timeout; records per-device execution status. | IoT Jobs, Lambda (TS) | Device Cloud | cloud/rollout/ |
| Routing Rules | Routes telemetry to the ingestion stream and a raw S3 archive, lifecycle events to the health monitor; error action to a dead-letter queue. | IoT Rules Engine | Device Cloud | cloud/rules/ |
| Telemetry Normalizer | Consumes the ingestion stream, validates payload schema versions v1–v3, dedupes by device sequence number, orders late readings. | Lambda (TS), Kinesis | Telemetry Platform | platform/normalizer/ |
| Time-series Store | Holds 90 days of per-fridge readings with retention and per-store partitioning for console queries. | Timestream | Telemetry Platform | platform/tsdb/ |
| Alert Evaluator | Evaluates excursion rules (threshold held for N minutes) per fridge and opens, escalates and closes alerts. | Lambda (TS), DynamoDB | Telemetry Platform | platform/alerts/ |
| Device Health Monitor | Tracks connect/disconnect lifecycle events and keep-alives, waits a grace period, then marks a gateway offline and audits cert expiry. | Lambda (TS), EventBridge | Telemetry Platform | platform/health/ |
| Notification Sender | Delivers alerts to store managers by SMS and email with per-store routing and quiet hours. | Lambda (TS), SNS | Telemetry Platform | platform/notify/ |
| Console Web App | Fleet search, fridge detail with history chart, alert inbox, deployments and compliance views. | React, TypeScript | Fleet Console | console/web/ |
| Console API | Authenticated BFF over registry, shadow, jobs and the time-series store; enforces store-level RBAC. | Node, Fastify, Cognito | Fleet Console | console/api/ |
| Installer Mobile App | Technician signs in, scans the gateway QR, pushes Wi-Fi credentials and a temporary provisioning claim, binds gateway to a fridge. | React Native | Installer App | installer/ |

## §9 External systems

| System | Used for | Component that integrates |
|---|---|---|
| AWS Private CA | Signs permanent device certificates; publishes the revocation list consulted at connect | Device Identity Module, Provisioning Template & Hook |
| Twilio | SMS delivery of excursion and offline alerts to store managers | Notification Sender |
| Store ERP (SAP asset register) | Source of store ids, fridge asset tags and manager contacts | Provisioning Template & Hook, Console API |
