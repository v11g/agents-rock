# Linking features to components — rubric v1

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
5. **Keeps files?** If the feature stores documents, images or evidence,
   link the store component that holds them.
6. **Why?** Every link carries a `why`: one short sentence naming the part
   of the component's Responsibility that this feature needs. If you cannot
   write one, drop the link.

A container with no component breakdown (e.g. one "Office Web App" block) is
linked as-is. Do not link shared infrastructure (database, CI, hosting)
unless the feature needs something specific from it.
