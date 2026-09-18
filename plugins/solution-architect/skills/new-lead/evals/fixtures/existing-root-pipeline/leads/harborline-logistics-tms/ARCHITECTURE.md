# Harborline TMS — Architecture

## 1. Introduction & Goals

Replace the in-house TMS with a modular system that keeps the existing EDI
gateway in place.

## 6. Core Components

| Component | Responsibility |
|---|---|
| `harbor.dispatch` | Load planning and carrier tendering |
| `harbor.settle` | Carrier settlement and invoicing |
| `harbor.track` | Customer-facing track-and-trace |

## 7. Runtime Behaviour

`harbor.dispatch` tenders a load, `harbor.settle` prices it once delivered,
and `harbor.track` reads status events from both.
