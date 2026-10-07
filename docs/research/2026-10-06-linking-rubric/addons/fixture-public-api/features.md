# Features — Parcelo Shipping API

- F1: Multi-carrier rate shopping — a developer POSTs a parcel and gets prices from every carrier enabled on their account in one response.
- F2: Buy a label safely on retry — a developer POSTs with an `Idempotency-Key` and gets exactly one purchased label (PDF link) even if the request is retried.
- F3: Delivery webhooks — a developer's endpoint receives a signed `shipment.delivered` event when a carrier reports delivery, with retries if the endpoint is down.
- F4: Monthly usage invoice — each developer org is invoiced by Stripe for labels bought and rate requests made that month, and can see running usage in the portal.
- F5: Read-only API keys — a developer creates a key that can fetch rates and tracking but cannot buy labels, and rotates it with a grace period.
- F6: Version pinning with deprecation notices — a developer pins an API version per key, and old versions announce their sunset date in headers and in the changelog.
