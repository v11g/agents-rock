---
electedDocs: [{"name":"threat-model","elected":false,"reason":"CLI-only fixture, no external attack surface"},{"name":"interface-contract","elected":false,"reason":"no public API exposed by this fixture"},{"name":"estimation","elected":false,"reason":"user declined effort estimates"},{"name":"domain-overview","elected":false,"reason":"thin domain: fixture repo"},{"name":"validation-plan","elected":false,"reason":"no must-level quality rows in this fixture"}]
---

# Shop Architecture

## Goals & Scope

Minimal fixture repo for validator tests. See the [components](#core-components) section for the container list.

## Core Components

| Component | Responsibility | src |
|---|---|---|
| API | Serves REST endpoints for checkout | observed |
| Web App | Renders the storefront UI for shoppers | observed |

### Core Components

A per-service breakdown lives in the linked runbook. This subheading exists
only to prove a heading that repeats its own parent's title picks up no
explainer of its own — subheadings are out of scope regardless of what they
are named.

## External Integrations

| System | Method | src |
|---|---|---|
| Stripe | REST API for payment charges | researched [https://docs.stripe.com/api] |

## Data Stores

```mermaid
erDiagram
  ORDERS {
    string id
    string customerId
  }
```

| Store | Purpose | src |
|---|---|---|
| Orders | Stores customer orders and line items | observed |

## Decisions

- [sample decision](docs/adr/0001-sample.md) — records why Stripe was chosen for payments.
