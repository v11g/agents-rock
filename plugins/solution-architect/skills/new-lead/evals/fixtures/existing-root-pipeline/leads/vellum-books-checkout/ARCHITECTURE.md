# Vellum Books — Architecture

## 1. Introduction & Goals

Rebuild checkout as a separate service so payment failures are observable
without touching the catalogue.

## 6. Core Components

| Component | Responsibility |
|---|---|
| `vellum.checkout` | Cart, payment intent and order creation |
| `vellum.catalogue` | Existing catalogue service, unchanged |

## 7. Runtime Behaviour

`vellum.checkout` reads prices from `vellum.catalogue` and emits payment
events to the existing analytics pipeline.
