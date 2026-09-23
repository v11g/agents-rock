# ADR-0001: Postgres-backed job queue

## Status

Accepted — Priya Raghunathan (Platform lead), 2026-09-17

## Context

Addresses: §13 p95 assignment latency · §13 recovery time · §2 "must run
inside the customer's AWS account, no external SaaS".

Three depots, roughly 40 concurrent dispatchers at peak, a known ceiling of
around 400 jobs an hour. The team is four engineers with no prior
queue-operations experience.

## Considered Options

- **Postgres-backed queue in the existing deployable.** The database is
  already inside the deployment boundary, so the queue adds no new
  operational surface. Durability is the database's existing commit path;
  a killed worker's row returns to the ready state on lease expiry; the
  dispatch id is unique, so a retried assignment cannot double-dispatch.
  Throughput ceiling is well above 400/hour at this row size.
- **Self-hosted broker (RabbitMQ) alongside the service.** Higher throughput
  ceiling and real topic routing. Costs a second thing to run, monitor and be
  paged for, against a team with no experience operating one, and moves
  durability into a component whose failure modes nobody here has seen.
- **Managed queue service.** Eliminated by §2 before comparison — it places
  job data outside the customer's account.

## Decision

We will use a Postgres-backed job queue inside the existing deployable.

Elasticity worsens: this cannot scale beyond the single database's write
throughput. Simplicity and operability improve, and those are the
characteristics §13 and the team constraint actually name. Fault tolerance is
unchanged — the same database failure takes out both designs.

## Costs

| Cost | Estimate |
|---|---|
| Build | lease-and-claim logic plus its tests; no new infrastructure |
| Operate | none beyond the database the service already runs |
| Infrastructure | none beyond existing Postgres |
| Switching | moving to a broker later means reimplementing claim semantics; the job table would seed the migration |

## Revisit trigger

Depot count passes 10, or sustained queue depth exceeds 5,000 rows during a
peak window. Either overturns the throughput argument above.
