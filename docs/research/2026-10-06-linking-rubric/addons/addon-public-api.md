# Add-on: public API / developer platform (read linking-v3-core.md first)

## Components this type usually has

| Component kind | What it does | Rubric q. | Source |
|---|---|---|---|
| Gateway / key authenticator | Terminates TLS, validates API key or OAuth token, resolves key -> tenant/plan; keys identify, they do not authorize | 1, 8 | [1][3] |
| Rate limiter + quota enforcer | Per-key throttling (rate/burst) and per-period quotas; returns 429 + `x-ratelimit-*` headers | 2, 8 | [1][10] |
| Scoped-key / permission model | Restricted keys with per-resource permissions, test vs live mode, IP/ASN access policies | 2, 8 | [8][4] |
| Version negotiator | Reads version header, routes to handler, applies compat transforms; date-named versions with 24-month support | 2 | [7][11][12] |
| Idempotency layer | Stores first response per `Idempotency-Key` (~24h), replays it, rejects same key with different params | 2, 5 | [6] |
| Standard error + validation envelope | One error schema, request validation against OpenAPI, pagination/filter conventions | 2 | [14] |
| Long-running operation handler | For >10s work returns an Operation resource the client polls | 2, 3 | [13] |
| Event outbox + webhook dispatcher | Signs (HMAC + timestamp), delivers, retries with backoff for days, no ordering guarantee | 3, 4 | [5] |
| Usage meter / aggregator | Rolls access logs into per-key usage, emits meter events to billing, exposes usage to the developer | 3, 4 | [9][2] |
| Key lifecycle worker | Rotation with grace window, expiry, unused-key limiting, compromise revocation | 3 | [8] |
| Developer portal | Signup, org/app management, key console, webhook endpoint console, usage view | 1 | [2] |
| API reference + changelog | Docs rendered from the spec, per-version changelog, deprecation/sunset notices | 1 | [11][7] |
| SDK + spec pipeline | Lints spec, diffs for breaking changes, regenerates typed SDKs pinned to a version | 8 | [7][12] |
| Analytics / access log export | Per-key request logs to observability (Datadog, Prometheus); feeds support + abuse detection | 2 | [3][2] |
| Inventory / environment registry | Which versions and endpoints are live where; retires debug and old versions | 8 | [4] |

## Work estimates for this type usually miss

- **Every new endpoint is also a version diff and an SDK release.** A
  required field or type change is breaking under a date-pinned scheme, and
  typed SDKs pin a version; missed because "it's one more field". Lands in:
  version negotiator, SDK + spec pipeline, changelog. [7][11][12]
- **Every new event type is webhook work, not a log line.** A new
  `shipment.delivered` needs an outbox write, a payload schema per API
  version, signing, retries, a portal toggle and docs. Lands in: event
  outbox + dispatcher, webhook endpoint console, API reference. [5]
- **Every billable action needs a meter.** Charging per label means a
  meter event with a stable idempotency identifier, aggregation rule, and a
  surface where the developer sees it; missed because billing is "Stripe's
  job". Lands in: usage aggregator, usage view, billing integration. [9]
- **Every new resource needs object-level authorization.** Ownership check
  on every ID (BOLA) and property-level filtering of response fields; missed
  because the gateway "already authenticates". Lands in: the resource module
  and the scoped-key permission model. [4][1]
- **Non-idempotent POST.** A create endpoint without idempotency double-charges
  on client retry; missed as "the client's problem". Lands in: idempotency layer. [6]
- **Rate limits are a product decision per endpoint.** Expensive endpoints
  need their own cost or point budget (secondary limits); missed because one
  global limit was assumed. Lands in: rate limiter config, docs. [10][4]
- **Test mode is a second environment.** Sandbox keys must hit fake carriers
  and never touch live data; missed when only the live path is priced. Lands
  in: key authenticator, resource modules, external adapters. [8]

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature add or change a response field? If so, are the resource
  module, the version negotiator and the SDK + spec pipeline linked — and does
  the feature actually change each one (a new compat transform, a regenerated
  SDK), or only use them?
- Does any feature fire a new event? If so, are the event outbox, the webhook
  dispatcher config (new type), the webhook console and the docs linked — and
  does the feature actually change each one, or only use an existing event type?
- Does any feature make a call billable? If so, are the usage aggregator and
  the billing integration linked — and does the feature actually change the
  usage ledger store (a new partition or retention rule), or only write through it?
- Does any feature create a resource? If so, is the idempotency layer linked —
  and does the feature actually change the idempotency cache store (TTL or key
  scope), or only use it?
- Does any feature change key permissions, modes or limits? If so, are the
  scoped-key model and the key console linked — and does the feature actually
  change them (a new permission, mode or limit), or only check a key?
- Does any feature add a long-running action? If so, are the operation handler
  and the worker linked — and does the feature actually change them (a new
  operation type, a new job), or only use an existing one?

## Sources

1. AWS — Usage plans and API keys for REST APIs. https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html
2. Google Cloud — What is Apigee? https://docs.cloud.google.com/apigee/docs/api-platform/get-started/what-apigee
3. Kong — Gateway plugin hub. https://developer.konghq.com/plugins/
4. OWASP — API Security Top 10 (2023). https://api-security.owasp.org/editions/2023/en/0x11-t10/
5. Stripe — Receive events in your webhook endpoint. https://docs.stripe.com/webhooks
6. Stripe — Idempotent requests. https://docs.stripe.com/api/idempotent_requests
7. Stripe — API versioning. https://docs.stripe.com/api/versioning
8. Stripe — API keys. https://docs.stripe.com/keys
9. Stripe — Record usage for billing. https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage
10. GitHub — Rate limits for the REST API. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
11. GitHub — REST API versions. https://docs.github.com/en/rest/about-the-rest-api/api-versions
12. Google AIP-180 — Backwards compatibility. https://google.aip.dev/180
13. Google AIP-151 — Long-running operations. https://google.aip.dev/151
14. Google AIP — General guidance index (pagination, errors, request identification). https://google.aip.dev/general
