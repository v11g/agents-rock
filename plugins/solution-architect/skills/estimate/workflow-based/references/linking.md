# Linking features to components — rubric v4 (core)

A feature is a business piece the client asked for. A component is a piece
engineers build, listed in ARCHITECTURE.md §6 (inside a C4 container). One
component can build many features; one feature is built by one or more
components. Link a feature to every component that has to change or be built
for that feature to work.

Answer these per feature, from ARCHITECTURE.md (§5 C4 views, §6 components,
§9 external integrations) and the requirements package:

1. **Who acts? Who is told?** For each person or role who performs a step
   of this feature, link the component they use to do it (the app or screen
   component that person uses, per the C4 person → container relations).
   If a person must be told something (an alert, a status update reaching
   them), link the component that delivers it.
2. **What rule? What does it read?** Link the component whose
   Responsibility owns the business rule or the data this feature creates
   or changes. If the feature needs data another module owns and that
   module does not expose it yet, link that module too — the new read is
   work inside it.
3. **No person?** If any step starts without a person — an inbound message,
   a schedule, a timer, a sync — link the background/worker component that
   runs it.
4. **Outside?** If the feature talks to an external system (§9), link the
   component that integrates with it.
5. **Store-specific work?** Link a database or object store only when the
   feature needs work inside the store itself: a constraint that enforces a
   business rule ("one editor per row", "no double booking"), a new store
   or bucket, partitioning, retention or locking rules. Ordinary tables and
   ordinary file writes belong to the module that owns them — do not link
   the store for them.
6. **Why?** Every link carries a `why`: one short sentence naming the part
   of the component's Responsibility that this feature needs. If you cannot
   write one, drop the link.
7. **Most specific.** Link the component, never the container that holds
   it. Link a container only when ARCHITECTURE.md gives it no components
   (e.g. one "Office Web App" block), and then link it as-is.
8. **Used is not changed.** Login, permissions middleware, the app shell,
   shared notification plumbing, monitoring, routing, normalizers and
   shared infrastructure (CI, hosting): link only when this feature changes
   them — a new role, a new permission, a new kind of notification, a new
   rule. A component the feature's data merely flows through, unchanged, is
   not a link, even if the feature would not work without it.

## Task rubric (the reviewer reads this; tasks live on components)

1. **Covers its links.** Every feature a component builds has at least one
   task that serves it.
2. **No double work.** The same work does not appear in two components.
3. **Right shape.** Each task's `shape` (`estimate/classic/references/task-shapes.md`)
   matches the work described.

## Evidence

Tested on 8 projects / 48 features (3 real leads, 5 reference fixtures):
the core rubric found 42 of 48 links and missed no whole feature; the
review workflow's Verify phase rejected 6 of 6 wrong additions. Full
artifacts: `docs/research/2026-10-06-linking-rubric/`.
