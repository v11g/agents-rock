---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the business-analyst skill on this PRD from Harbour Supply, a ship
chandler: STANDARD depth, workflow scope mode. Start with any
contradiction you find in it. Write the package to leads/harbour-supply/
when you get there.

# Harbour Supply — PRD

Ships order provisions by email or phone. Today staff key orders into a
spreadsheet, pack from a paper list, and invoice when the signed paper
delivery order comes back, often weeks later.

## Warehouse operations

- Order pipeline: each order moves Order In → Pack → Pack Review → Shipped,
  tracked on a phone in the warehouse.
- Offline scan queue: scans are kept and synced later, for WiFi and
  cellular dead spots inside the warehouse.

## Invoicing

- Invoice from packed quantities, raised the moment an order is shipped.

## Assumptions

- The client confirms warehouse WiFi or cellular coverage is adequate for
  phone-based scanning.
