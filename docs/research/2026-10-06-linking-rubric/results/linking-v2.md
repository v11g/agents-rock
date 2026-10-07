# Linking features to components — rubric v2

A feature is a business piece the client asked for. A component is a piece
engineers build, listed in ARCHITECTURE.md §6 (inside a C4 container). One
component can build many features; one feature is built by one or more
components. Link a feature to every component that has to change or be built
for that feature to work.

Answer these per feature, from ARCHITECTURE.md (§5 C4 views, §6 components,
§9 external integrations) and the requirements package:

1. **Who acts?** For each person or role who performs a step of this feature,
   link the component they use to do it (the app or screen component in the
   container that person uses, per the C4 person → container relations).
2. **What rule?** Link the component whose Responsibility owns the business
   rule or the data this feature creates or changes.
3. **No person?** If any step starts without a person — an inbound message,
   a schedule, a timer, a sync — link the background/worker component that
   runs it.
4. **Outside?** If the feature talks to an external system (§9), link the
   component that integrates with it.
5. **Data?** Link a data store only for store-specific work: a constraint
   that enforces a business rule (e.g. "one editor per row", "no double
   booking"), a new store or bucket, partitioning, or retention/locking
   rules. Ordinary tables are part of the module that owns them — do not
   link the database for them. Files, images or evidence kept in an object
   store: link that store.
6. **Why?** Every link carries a `why`: one short sentence naming the part
   of the component's Responsibility that this feature needs. If you cannot
   write one, drop the link.
7. **Most specific.** Link the component, never the container that holds
   it. Link a container only when ARCHITECTURE.md gives it no components
   (e.g. one "Office Web App" block), and then link it as-is.
8. **Shared pieces.** Login, permissions middleware, the app shell, shared
   notification plumbing and shared infrastructure (CI, hosting): link only
   when this feature changes them — a new role, a new permission, a new
   kind of notification. Merely using them is not a link.
