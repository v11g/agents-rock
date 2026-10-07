# Task shapes — the agentic taxonomy

Read while decomposing an agentic feature into tasks (`references/interview.md`
§2b) and while writing each task's `shape` into `estimation-inputs.json`.
Shapes classify **operations, not features** — a feature almost always
decomposes into several shapes (a "password reset" feature is
`api_integration` + `database_change` + `ui_implementation` + `test_creation`
+ `planning`, not one shape). Classify by what the agent *does* — files
touched, kind of change — never by business domain. "Add password reset" is
not a shape; "add a database column and migration" is `database_change`.

## `scaffold`

Create a new module, service, or package from nothing — the first commit in
a new area, not a change to an existing one.

- New microservice skeleton with health-check endpoint.
- New CLI package with entrypoint and empty command router.
- New frontend app shell (routing, layout, no real screens yet).

Scope: `complexity` (how much boilerplate the shape spans — low for a single
file, higher for a multi-package skeleton).

## `small_implementation`

Add isolated business logic inside existing structure — one function or one
module, no cross-cutting change.

- Add a discount-calculation function to an existing pricing module.
- Add a new validation rule to an existing form handler.
- Add a single new field with its read path.

Scope: `complexity`.

## `cross_file_refactor`

Replace a pattern, call, or dependency across multiple existing files without
changing external behavior.

- Replace an old API client with a new SDK across every call site.
- Rename a widely-used function and update every caller.
- Extract a repeated block into a shared helper across several modules.

Scope: `affectedFiles` (how many files the pattern touches) and `complexity`.

## `test_creation`

Add unit or integration tests for existing, already-implemented behavior.

- Add unit tests for a function that currently has none.
- Add an integration test covering a new endpoint's happy path and one error
  case.
- Backfill test coverage on a module before refactoring it.

Scope: `complexity`.

## `bug_fix`

Diagnose and correct a known, reported issue — the defect is already
described; this is not open-ended exploration.

- Fix a null-pointer crash reported in a specific handler.
- Correct an off-by-one error in a pagination calculation.
- Fix a race condition in a documented flaky test.

Scope: `complexity`.

## `configuration`

Modify environment variables, config files, feature flags, or deployment
settings — no application logic changes.

- Add a new environment variable and wire it through config loading.
- Update a CI pipeline's build matrix.
- Toggle a feature flag's default and adjust its config schema.

Scope: `complexity`.

## `api_integration`

Add or modify a call to an external API — first-party or third-party service
boundary.

- Add a new outbound call to a payment provider's API.
- Wire a webhook receiver for an external service's events.
- Change an existing integration's request/response shape after a provider
  API version bump.

Scope: `complexity`.

## `database_change`

Modify schema, migrations, or queries.

- Add a column and its migration.
- Add an index to fix a slow query.
- Rewrite a query to eliminate an N+1.

Scope: `affectedFiles` when the change spans multiple migration/query files,
`complexity` always.

## `documentation`

Generate or update technical documentation — no code change.

- Write a README section for a new module.
- Update API docs after a signature change.
- Write an ADR recording a design decision.

Scope: `complexity`.

## `ui_implementation`

Create or modify a frontend component.

- Build a new form component with validation states.
- Update an existing list view to add sorting.
- Restyle a component to match a new design spec.

Scope: `complexity`.

## `migration`

Replace a technology or implementation pattern project-wide — larger and
more structural than `cross_file_refactor`: a framework swap, a language
runtime bump, a persistence-layer replacement.

- Migrate from one ORM to another across the codebase.
- Move a service from REST to gRPC.
- Upgrade a major framework version with breaking-change fixups.

Scope: `affectedFiles` and `complexity`.

## `investigation`

Explore unknown system behavior — no code change is guaranteed; the
deliverable is understanding, not a diff.

- Investigate why a production job intermittently times out.
- Explore an unfamiliar third-party library's undocumented behavior.
- Trace a data-inconsistency bug to its root cause before fixing it.

Scope: none beyond the task description — investigation has no meaningful
`affectedFiles` or `complexity` axis to score in advance; scope stays `{}`.

## `planning`

Produce a plan, design, or decomposition before code — the human-side
operation that turns a feature into tasks. First-class, not overhead: every
agentic decomposition needs at least one `planning`-shaped task, or the
validator refuses the deliverable (`references/agentic-estimation.md` §5).

- Write the task breakdown for a feature before implementation starts.
- Produce a design doc or ADR for an approach with more than one viable
  option.
- Review and finalize a decomposition after a scope change.

Scope: none beyond the task description — like `investigation`, `planning`
has no `affectedFiles`/`complexity` axis; scope stays `{}`.

## Extensibility

The taxonomy is not closed. An unknown `task_shape` in a measurement record
is a warning, kept — never a fatal error (`lib/measurements.mjs`
`checkMeasurement`), so a future shape written before this doc catches up
still calibrates. `estimation-inputs.json`, on the other hand, must use the
taxonomy above: `schema.mjs` rejects an unknown `shape` on a task, because
inputs are the agent's own judgment and an unrecognized shape there is a
typo, not evidence.

Extending the taxonomy means adding the new shape to `TASK_SHAPES` in
`../shared/lib/measurements.mjs` **and** a section to this doc, in the same
commit — the two must never drift apart.
