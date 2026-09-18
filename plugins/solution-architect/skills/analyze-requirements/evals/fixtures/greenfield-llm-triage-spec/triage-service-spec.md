# Triage Service — build spec v0.4

Status: approved for build. Nothing here is implemented yet — there is no repo.
Owner: Platform squad. Reviewed by Legal (2026-08-11) and SRE (2026-08-19).

## 1. What it does

Inbound customer support email lands in a shared mailbox. Today two humans read
every message and drag it into a queue in Zendesk. The Triage Service replaces
the reading step: it classifies each message into a queue, assigns a priority,
extracts the customer's order reference if one is present, and writes the result
back to Zendesk as a ticket with tags. A human still owns every reply.

Out of scope for v1: drafting replies, closing tickets, any outbound email,
non-English messages (they route to `queue-manual` untouched).

## 2. Actors

| Actor | What they do |
|---|---|
| Customer | Sends the inbound email. Never interacts with this service directly. |
| Support agent | Works the queues in Zendesk. Sees our tags and priority. |
| Triage reviewer | A support agent on rotation who audits the daily sample of low-confidence classifications. |
| Platform on-call | Gets paged when the service drops messages. |

## 3. Vocabulary

- **Message** — one inbound email, as delivered by the mail provider webhook.
- **Classification** — one model output: queue, priority, confidence, extracted
  order reference. Immutable once written.
- **Queue** — one of six fixed destinations: billing, shipping, returns,
  technical, abuse, manual. Not configurable at runtime.
- **Confidence floor** — 0.72. Below it the classification is still stored but
  the ticket is created in `queue-manual` and flagged for the daily audit.
- **Replay** — re-running classification for a message we already stored, after
  a prompt or model change. Produces a new Classification; never mutates the old.

## 4. Interfaces we consume and expose

| Interface | Direction | Notes |
|---|---|---|
| Mail provider webhook (Postmark inbound) | inbound | HTTPS POST, JSON, signed with a shared secret in the `X-Postmark-Signature` header. At-least-once: duplicates are expected and must be idempotent on `MessageID`. |
| Zendesk Tickets API | outbound | REST, OAuth2 client credentials. Rate limit 700 requests/minute on our plan. |
| Anthropic Messages API | outbound | Classification. Model pinned per deploy, never "latest". |
| Internal admin HTTP API | exposed | Used only by the reviewer UI: list low-confidence classifications, trigger a replay. Behind the corporate SSO proxy, no public route. |

## 5. Data and sensitivity

Inbound email bodies contain customer PII: names, postal addresses, order
references, and occasionally card last-four digits pasted by the customer.
Legal's ruling (2026-08-11):

- Message bodies are **personal data under GDPR**. Store in eu-central-1 only.
- Retention: raw message body 30 days, then hard delete. Classification rows
  (no body, no address) retained 24 months for model-quality analysis.
- The card last-four is redacted before the body is sent to the model or stored.
  Redaction failures fail the message closed — the message routes to
  `queue-manual` and the body is not persisted.
- Right-to-erasure requests must delete every row for a customer email within
  72 hours.
- No customer data may leave the EU. The model vendor must be called through an
  EU endpoint or the design must state the residency gap explicitly.

## 6. Deployment target

Decided, not open for discussion:

- AWS, `eu-central-1`, single region. No multi-region for v1.
- ECS Fargate, two services behind one ALB: the webhook receiver and the
  classification worker. Worker scales on queue depth.
- Amazon SQS between them, with a dead-letter queue after 5 receives.
- Amazon RDS for PostgreSQL 16, Multi-AZ, encrypted at rest with a customer-
  managed KMS key.
- Secrets in AWS Secrets Manager. No secret in an environment variable or image.
- CI/CD is GitHub Actions → ECR → ECS rolling deploy. Two environments, staging
  and production. No manual deploys.

## 7. Quality requirements

| Attribute | Target | Why this number |
|---|---|---|
| Durability of inbound messages | Zero dropped messages. Every accepted webhook is either classified or in the DLQ. | This is the one thing we cannot be wrong about — a dropped message is a customer who never got an answer. |
| Latency | p99 under 45 seconds from webhook accept to Zendesk ticket created. | Agents start their shift at 08:00 and want the overnight queue already sorted. |
| Availability | 99.5% monthly for the webhook receiver. | The mail provider retries for 12 hours, so a short receiver outage is recoverable. |
| RPO | 5 minutes (RDS automated backups + SQS retention cover this). | |
| RTO | 4 hours. | Manual triage is the fallback and it works; it is just slow. |
| Classification accuracy | ≥ 88% agreement with the reviewer on the daily sample. | Below that, agents stop trusting the tags and the service is worse than nothing. |

## 8. Constraints

- Budget ceiling: $1,400/month all-in for production at 40k messages/month.
- Team: three engineers, no dedicated SRE. Anything that needs a human at 03:00
  will not get one.
- Must ship a first production message by 2026-11-30.
- Company standard is TypeScript on Node 22. Python is not approved for
  production services here.
- Mandated: every LLM call and its output is logged to the existing audit log
  service (`audit-log`, already running, gRPC, owned by the Security team).

## 9. Known risks flagged by the reviewers

- Prompt injection from the email body. An attacker controls the entire input.
- Model vendor residency: unresolved at spec time, see §5.
- Zendesk rate limit during a morning burst after an overnight outage.
- Cost drift if message volume grows past 40k/month.
