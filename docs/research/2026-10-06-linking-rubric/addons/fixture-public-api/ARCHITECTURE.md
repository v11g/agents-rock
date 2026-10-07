# ARCHITECTURE — Parcelo Shipping API

Parcelo sells a REST API to e-commerce developers: compare carrier rates, buy
labels, track parcels. Developers hold API keys, pay per label and per 1,000
rate requests, and receive webhooks. Modelled on the API Gateway + developer
portal + metered billing pattern (AWS usage plans, Apigee, Stripe Billing).

## 5. C4 containers

| Container | Tech | Who uses it |
|---|---|---|
| Edge Gateway | Kong Gateway (OSS) on Kubernetes | Third-party developer apps (every API call enters here) |
| Core API | Node 20 / Fastify / TypeScript, OpenAPI 3.1 spec | Edge Gateway forwards to it; Platform Workers call it internally |
| Platform Workers | Node 20 workers on BullMQ (Redis) queues | Nobody directly; triggered by queues, cron and outbox polling |
| Developer Portal | Next.js 14 web app | Third-party developers; Parcelo support staff (admin role) |
| Platform Store | PostgreSQL 16, Redis 7, S3 | Core API, Platform Workers, Portal |
| Release Pipeline | GitHub Actions | Parcelo engineers on every merge to main |

## 6. Components

| Component | Responsibility | Tech | Deploy unit | src |
|---|---|---|---|---|
| Key Authenticator | Validates the `Authorization` key, resolves it to org, mode (test/live) and plan, rejects expired or revoked keys. | Kong key-auth plugin + custom Lua lookup | Edge Gateway | gateway/plugins/key-auth |
| Rate Limiter & Access Logger | Enforces per-key requests-per-second and per-month quota from the plan, returns 429 with `x-ratelimit-*` headers, and emits one structured log line per request (key, route, status, cost points) to the usage queue. | Kong rate-limiting-advanced + http-log plugins (Redis) | Edge Gateway | gateway/plugins/traffic |
| API Contract Layer | Reads `Parcelo-Version` (date-named, defaulting to the key's pinned version), applies response transforms for older versions, adds `Deprecation`/`Sunset` headers, validates requests against the OpenAPI spec and returns the single error envelope. | Fastify hooks + ajv + transform registry | Core API | api/src/contract |
| Idempotency Middleware | On POST with `Idempotency-Key`, replays the stored response for 24h and rejects reuse with different parameters. | Fastify hook over Redis | Core API | api/src/idempotency |
| Rates Module | Quotes shipping prices for a parcel across enabled carriers in parallel, normalises carrier responses, caches quotes 10 min. | TypeScript service | Core API | api/src/rates |
| Labels Module | Purchases a label from the chosen carrier, stores label PDF to S3, records the billable `label.created` usage fact. | TypeScript service | Core API | api/src/labels |
| Tracking Module | Owns `Shipment` tracking state; applies carrier status updates and exposes `GET /shipments/{id}`. | TypeScript service | Core API | api/src/tracking |
| Event Outbox | Writes domain events (`shipment.*`, `label.*`) in the same DB transaction as the business change, for the dispatcher to pick up. | Postgres outbox table + poller | Core API | api/src/events |
| Webhook Dispatcher | Signs each event (HMAC-SHA256 + timestamp), POSTs to the org's endpoints for the subscribed types, retries with exponential backoff for 3 days, records delivery attempts. | BullMQ worker | Platform Workers | workers/src/webhooks |
| Carrier Tracking Poller | Every 15 min asks carriers for status of in-flight shipments and hands changes to the Tracking Module. | Cron worker | Platform Workers | workers/src/carrier-poll |
| Usage Aggregator | Rolls access-log and label usage facts into per-key hourly rows, pushes meter events to Stripe with a stable identifier. | BullMQ worker | Platform Workers | workers/src/usage |
| Key Lifecycle Worker | Expires rotated keys after the grace window, emails owners of keys unused for 90 days, revokes leaked keys on report. | Cron worker | Platform Workers | workers/src/keys |
| Account & Key Console | Signup, email verification, org members and roles (owner, developer, billing); create, scope (read-only / labels / all), rotate with grace period and revoke API keys, showing a key once. | Next.js + Auth.js | Developer Portal | portal/src/account |
| Webhook Endpoint Console | Register endpoint URLs, pick event types, reveal/roll signing secret, view delivery attempts and resend. | Next.js pages | Developer Portal | portal/src/webhooks |
| API Reference & Changelog | Renders reference docs per version from the OpenAPI spec, publishes the changelog and deprecation dates. | Next.js + Scalar | Developer Portal | portal/src/docs |
| Usage Ledger | Monthly-partitioned usage tables with 13-month retention and unique (key, hour, metric) constraint. | PostgreSQL schema | Platform Store | db/migrations/usage |
| Idempotency Cache | Redis keyspace for stored responses, 24h TTL, keyed by (org, idempotency key). | Redis | Platform Store | db/redis/idempotency |
| Spec Gate & SDK Generator | Fails the build when the OpenAPI diff against the released spec is breaking without a new version date; on release regenerates and publishes the TypeScript and Python SDKs pinned to that version. | GitHub Actions + oasdiff + openapi-generator | Release Pipeline | .github/workflows/api-release |

## 9. External systems

| System | Used for | Component that integrates |
|---|---|---|
| Carrier APIs (UPS, FedEx, DHL) | Rate quotes, label purchase, tracking status | Rates Module, Labels Module, Carrier Tracking Poller |
| Stripe Billing | Meter events, invoices, customer payment methods | Usage Aggregator, Account & Key Console |
| Amazon SES | Verification, key-expiry and invoice emails | Account & Key Console, Key Lifecycle Worker |
