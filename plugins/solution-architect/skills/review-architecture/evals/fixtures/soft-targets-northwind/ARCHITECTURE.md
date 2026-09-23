---
name: Northwind Dispatch
repo: northwind/dispatch
team: Platform
updated: 2026-09-14
mode: greenfield
projectType: web-service
docVersion: 0.3.0
electedDocs: [{"name":"threat-model","elected":false,"reason":"deferred to security review"},{"name":"interface-contract","elected":false,"reason":"internal service, no third-party consumers"},{"name":"estimation","elected":false,"reason":"not run yet"},{"name":"domain-overview","elected":false,"reason":"thin domain"},{"name":"validation-plan","elected":false,"reason":"not written"}]
---

# Northwind Dispatch Architecture

## 1 Goals and Scope

Dispatch assigns delivery jobs to drivers and tracks them to completion. `stated`

## 2 Constraints

| constraint | detail | src |
|---|---|---|
| hosting | must run inside the customer's AWS account | stated |
| deadline | first depot live before the Q1 contract renewal | stated |

## 4 Solution Strategy

- Event-driven job assignment — see ADR-0001.

## 13 Quality Requirements and SLOs

| scenario | measure | target | priority | src |
|---|---|---|---|---|
| the system is fast under load | response time | 300 ms | must | assumed |
| driver app stays responsive | p95 assignment latency | 2 s | must | stated |
| reports render quickly | report render | 5 s | should | proposed |

## 15 Risks and Technical Debt

| risk | impact | mitigation | src |
|---|---|---|---|
| queue substrate unproven for the team | delivery slip | none recorded | stated |
