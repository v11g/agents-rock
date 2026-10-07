# Slicing — vertical milestones before sizing

Read before proposing milestones (Flow step 3, or companion mode right after
seeding the WBS). Milestones are judgment, not computation: nothing in
`compute.mjs` can tell a good slice from a bad one, so the judgment happens
here, explicitly, before any number is attached.

## The rules

1. **Walking skeleton first.** M1 is the thinnest end-to-end path through the
   architecture — deploy pipeline included. A demo that pushes one record
   through real infrastructure beats a finished layer nobody can click.
2. **Every milestone demos user-visible value.** A milestone whose features
   touch no user-visible component is a horizontal slice — rework it. "All
   schema, then all API, then all UI" is the failure mode, not a plan.
3. **Sequence from dependency direction.** The architecture doc's §5/§6 edges
   decide order: if pricing reads what the ledger records, ledger work
   precedes pricing work. Never invent an order the diagrams contradict.
4. **Balance the slices.** A milestone above ~30% of total effort is a split
   signal; roughly equal slices keep the roadmap's band widths meaningful.
5. **Client priority breaks ties.** When dependencies allow either order, the
   product the client named first ships first.

The component roster makes rule 2 checkable by eye: tag features against the
roster (two levels max, container → component) and scan each milestone's
features for at least one user-visible component.

## Splitting a too-fat milestone

Patterns, in the order to try them (digest of the Humanizing Work guide —
see Sources):

- **Workflow steps** — ship the simple end-to-end case; add middle steps later.
- **Operations** — split "manage X" into create / read / update / delete.
- **Business-rule variations** — one rule per slice.
- **Data variations** — one data shape per slice; defer exotic formats.
- **Data-entry methods** — simplest interface first, rich UI later.
- **Major effort** — pull shared infrastructure into the slice that needs it
  first; later slices lean on it.
- **Simple/complex** — extract the minimal version; defer edge cases.
- **Defer performance** — make it work in one slice, fast in another.
- **Spike** — when uncertainty blocks slicing, time-box an investigation
  feature and size only the spike.

Meta-pattern: find the core complexity, name its variations, cut one complete
slice through the complex part.

## Sources

Attribution + link, never quoted text:

- Story-splitting patterns — Humanizing Work,
  humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories.
- Dependency-graph-then-vertical-slice process — Addy Osmani,
  planning-and-task-breakdown skill, github.com/addyosmani/agent-skills.
