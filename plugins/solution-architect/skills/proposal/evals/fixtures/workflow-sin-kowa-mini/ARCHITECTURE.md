# sin-kowa-mini — architecture (fixture)

Trimmed from the Sin Kowa v2 document for tests. Component ids match
`inputs-pass.json`.

## 5 Architecture Model

| Container | Tech | Used by |
| --- | --- | --- |
| Core API (`api`) | NestJS | Office Web App, Background Worker |
| Office Web App (`office`) | React SPA | office staff |
| Background Worker (`worker`) | job runner | — |
| Operations Database (`ops`) | PostgreSQL | Core API |

## 6 Core Components

| Component | Responsibility | Tech | Deploy unit | src |
| --- | --- | --- | --- | --- |
| Stage Engine (`api.stage`) | moves Orders through the stages; raises Short-Pack alerts | NestJS module | Core API | proposed |
| Orders and Quoting (`api.orders`) | Order, Quotation, pricing, Order Draft confirmation | NestJS module | Core API | proposed |
| Billing (`api.billing`) | Invoice from accepted packed quantities; issued invoices never edited | NestJS module | Core API | proposed |
| Office Web App (`office`) | orders, quotes, invoicing screens | React SPA | Office Web App | proposed |
| Notifier (`worker.notify`) | sends alerts to staff | job | Background Worker | proposed |
| Order Drafter (`worker.drafter`) | turns message text into an Order Draft | LLM job | Background Worker | proposed |
| Operations Database (`ops`) | system of record; one schema per module | PostgreSQL | RDS | proposed |

## 9 External Integrations

| System | Used for | Component that integrates |
| --- | --- | --- |
| Mailbox | inbound order emails | Order Drafter |
