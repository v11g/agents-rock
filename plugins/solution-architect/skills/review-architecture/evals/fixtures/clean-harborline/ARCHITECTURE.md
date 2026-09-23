---
name: Harborline Dispatch
repo: harborline/dispatch
team: Platform
updated: 2026-09-18
mode: greenfield
projectType: web-service
docVersion: 1.0.0
electedDocs: [{"name":"threat-model","elected":false,"reason":"internal service behind the customer VPN; security review scheduled before go-live"},{"name":"interface-contract","elected":false,"reason":"no third-party consumers in v1"},{"name":"estimation","elected":false,"reason":"not run yet"},{"name":"domain-overview","elected":false,"reason":"thin domain: three entities, no contested terms"},{"name":"validation-plan","elected":true}]
---

# Harborline Dispatch Architecture

## 1 Goals and Scope

Assign delivery jobs to drivers and track them to completion across three
depots. `stated`

Out of scope for v1: route optimisation, customer-facing tracking. `stated`

## 2 Constraints

| constraint | detail | src |
|---|---|---|
| hosting | must run inside the customer's AWS account, no external SaaS | stated |
| team | four engineers, none with prior queue-operations experience | stated |

## 3 Project Structure

Single repository, single deployable: `api/` (HTTP and the dispatcher loop),
`db/` (migrations), `ops/` (Terraform for the customer account). `stated`

## 4 Solution Strategy

- Single deployable with a Postgres-backed job queue — see ADR-0001.

## 5 Architecture Model

One container, three components inside it: Dispatch API, Assignment Worker,
Job Store. The driver app and the depot console are external actors; nothing
else calls the service. `stated`

## 6 Core Components

| component | responsibility | src |
|---|---|---|
| Dispatch API | accepts job creation from the depot console, serves job state to the driver app | stated |
| Assignment Worker | claims ready jobs under a lease, assigns a driver, releases on expiry | stated |
| Job Store | the Postgres schema holding jobs, leases and dispatch ids | stated |

## 7 Runtime Behaviour

Job created → row written `ready` → worker claims it under a 60 s lease →
driver assigned and notified → job moves to `assigned`. `stated`

Worker killed mid-claim: the lease expires, the row returns to `ready`, and
another worker claims it. The dispatch id is unique, so the reassignment
cannot double-dispatch — the Assignment Worker owns this path. `stated`

## 8 Data Stores

| store | holds | retention | src |
|---|---|---|---|
| Postgres (primary) | jobs, leases, dispatch ids, driver shift state | 18 months, then archived to the customer's S3 bucket | stated |

## 9 External Integrations

| integration | direction | purpose | src |
|---|---|---|---|
| Driver mobile app | inbound | job acceptance and completion, over the customer VPN | stated |
| Depot console | inbound | job creation and shift reports | stated |

No outbound third-party calls in v1: no payment, mapping or messaging
provider is contacted. `stated`

## 10 Deployment and Infrastructure

Single ECS service plus RDS Postgres in the customer's AWS account,
eu-west-1, one environment per stage (staging, production). Terraform in
`ops/` is the only path to a change. `stated`

## 11 Crosscutting Concepts

Structured JSON logs to CloudWatch with a job id on every line; the lease
loop emits queue depth and claim age as metrics. Errors surface as job state,
never as a silent drop. `stated`

## 12 Security

Authentication is the customer's existing OIDC provider; the service holds no
credentials of its own. The service is reachable only from inside the customer
VPN, and the threat model is deferred by election — the security review is
scheduled before go-live. `stated`

No payment data, and no personal data beyond driver name and shift
assignment. `stated`

## 13 Quality Requirements and SLOs

| scenario | measure | target | priority | src |
|---|---|---|---|---|
| job created at depot peak, 40 concurrent dispatchers → driver sees it in the app | p95 assignment latency | 2 s | must | stated |
| worker killed mid-assignment → job is reassigned, no accepted job lost, no duplicate dispatch | recovery time | 60 s | must | stated |
| depot manager exports a shift report | report render | 5 s | should | proposed |

Cost and simplicity are held above elasticity here: three depots is a known
ceiling, and the team has no queue-operations experience. `stated`

## 14 Decisions

| id | decision | status | src |
|---|---|---|---|
| ADR-0001 | Postgres-backed job queue inside the existing deployable | accepted 2026-09-17, Priya Raghunathan (Platform lead) | stated |

## 15 Risks and Technical Debt

| risk | impact | owner | mitigation | src |
|---|---|---|---|---|
| Postgres queue may not hold if depot count grows past ~10 | rework to a broker | Platform lead | revisit trigger recorded in ADR-0001 | proposed |

## 16 Glossary

| term | meaning | src |
|---|---|---|
| job | one delivery a depot needs assigned to a driver | stated |
| lease | the 60 s hold a worker takes on a job while assigning it | stated |
| dispatch id | the unique id that makes a retried assignment idempotent | stated |
| depot | one of the three physical sites jobs originate from | stated |
