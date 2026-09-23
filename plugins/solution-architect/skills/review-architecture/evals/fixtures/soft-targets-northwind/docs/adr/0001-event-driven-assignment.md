# ADR-0001: Event-driven job assignment

## Status

Accepted

## Context

Dispatch needs to assign jobs to drivers as they come in. Assignment is the
core of the product and has to keep up during depot peak hours.

## Considered Options

- **Event-driven with a managed queue.** Async makes it reliable, and it
  scales.
- **Cron-based batch assignment every 15 minutes.** Too slow for a dispatch
  product; drivers would sit idle.

## Decision

We will use an event-driven assignment pipeline on a managed queue service.

## Consequences

Total cost is roughly $400/month. The team gets a scalable, reliable pipeline
and better throughput.
