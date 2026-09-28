# Harborline Dispatch Portal — Architecture

## 1. Goals & Scope

Harborline Logistics runs 18 vans out of one depot. Dispatchers assign jobs on a
whiteboard and phone the drivers; customers phone the office to ask where their
delivery is. The portal replaces the whiteboard with a live board, gives drivers
a phone screen for check-in and proof of delivery, and gives customers a
self-serve tracking page.

| Goal | Measure | src |
|---|---|---|
| Dispatchers stop re-keying job data | zero whiteboard-to-system double entry | stated |
| Every delivery carries proof | a photo attached to 100% of completed jobs | stated |
| Customers stop phoning for status | 50% fewer status calls in the first quarter | stated |

## 2. Constraints

| Constraint | src |
|---|---|
| One depot, one timezone — no multi-region work in v1 | stated |
| Drivers use company-issued Android phones only | stated |
| Existing invoicing stays as-is; no billing integration in v1 | stated |

## 4. Solution Strategy

One web application with a dispatcher board, a driver-facing mobile web screen,
and a public tracking page. Photos go to object storage. Reminders and tracking
links go out by email through the provider Harborline already pays for.

## 6. Core Components

| Component | Responsibility | src |
|---|---|---|
| `dispatch` | Holds jobs, assignments and their state transitions | proposed |
| `driver` | Driver check-in, check-out and proof-of-delivery upload | proposed |
| `tracking` | Public delivery status page and its email links | proposed |
| `billing` | Not estimated — phase 2, client keeps current invoicing | stated |

## 7. Runtime Behaviour

A dispatcher assigns a job on the board; the assignment is pushed to the
driver's phone screen. The driver checks in at pickup and uploads a photo at
drop-off, which moves the job to complete. Completion sends the customer a
tracking link, and the public page reads the same job state.

## 8. Data Stores

| Store | Holds | src |
|---|---|---|
| Primary relational database | jobs, assignments, drivers, customers | proposed |
| Object storage | proof-of-delivery photos, retained 12 months | stated |

## 12. Security

Dispatcher and driver sessions are separate roles. The public tracking page is
reachable only through a single-use link in the delivery email; it exposes the
delivery status and nothing else about the customer.

## 15. Risks & Technical Debt

| Risk | Impact | src |
|---|---|---|
| Depot wifi blackspots delay driver rollout | check-ins queue until signal returns | observed |
| Overnight shift handover rules are undecided | board state at shift change is unspecified | stated |
