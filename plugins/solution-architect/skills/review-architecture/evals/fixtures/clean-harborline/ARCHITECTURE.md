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

## 4 Solution Strategy

- Single deployable with a Postgres-backed job queue — see ADR-0001.

## 13 Quality Requirements and SLOs

| scenario | measure | target | priority | src |
|---|---|---|---|---|
| job created at depot peak, 40 concurrent dispatchers → driver sees it in the app | p95 assignment latency | 2 s | must | stated |
| worker killed mid-assignment → job is reassigned, no accepted job lost, no duplicate dispatch | recovery time | 60 s | must | stated |
| depot manager exports a shift report | report render | 5 s | should | proposed |

Cost and simplicity are held above elasticity here: three depots is a known
ceiling, and the team has no queue-operations experience. `stated`

## 15 Risks and Technical Debt

| risk | impact | owner | mitigation | src |
|---|---|---|---|---|
| Postgres queue may not hold if depot count grows past ~10 | rework to a broker | Platform lead | revisit trigger recorded in ADR-0001 | proposed |
