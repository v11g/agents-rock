---
name: new-lead
description: Set up a pre-sales lead workspace and walk the human through the solution-architect skills in order — business-analyst first when installed, then analyze-requirements, estimate, proposal — plus a local leads dashboard. Use when the user says "new lead", points at a folder under leads/, or asks to see their leads pipeline.
---

# new-lead

Prepare a lead's workspace, then run `/business-analyst` (when installed),
`/analyze-requirements`, `/estimate` and `/proposal` in that order, stopping
between each so the human sees what was produced. Also maintains the leads dashboard: a `leads.json` registry and a
self-contained local server.

## Hard rules

1. This skill never interviews. Every question about scope, stack, delivery or
   the client belongs to the skill that needs it.
2. This skill never renders and never writes a document. Each sub-skill owns its
   own validation and its own output.
3. The lead id is the folder name under `leads/`, verbatim. The filesystem is
   the source of truth; `leads.json` holds business metadata only, and is
   written exclusively through `scripts/lead-upsert.mjs`.
4. Stop after each sub-skill returns. The human decides whether the chain
   continues.

## Workspace

```
<root>/
├── leads.json          the registry
├── start.sh            starts the dashboard
├── leads/<lead-id>/    one directory per lead
└── scripts/            serve.mjs, the dashboard pages, lib/, vendor/
```

## Flow

1. **Dependency check**: Node ≥ 20 and `npx likec4` (needed downstream by
   `analyze-requirements`). Either missing → stop before doing any work.
2. **Find the root**: walk up from the working directory for `leads.json`
   (`findLeadsRoot` in `scripts/lib/registry.mjs`). Not found → confirm with the
   user, then `node scripts/init-root.mjs --root <dir>` at cwd, and offer
   `git init`.
3. **Resolve the target**:
   - `/new-lead @leads/<folder>/` → that folder.
   - `/new-lead` with no argument → diff `readdir(<root>/leads)` against
     `leads.json` and print the state table below; the human picks one.
4. **Adopt** (only when the folder has no registry entry) — see Adoption.
5. **Chain**: when the `business-analyst` skill is available, the chain is
   `/business-analyst`, `/analyze-requirements`, `/estimate`, `/proposal`;
   otherwise recommend installing the business-analyst plugin in one line
   (requirements discovery before architecture) and run the three-step
   chain. For each step — `cd` to the lead directory, invoke the skill,
   and when it returns, report what it wrote and wait. Skip any step whose
   artifact already exists unless the human asks for a re-run.
   `requirements.json` is soft evidence for the later skills, never a
   prerequisite.
6. **Sync the registry** after `/proposal` — see Registry sync.
7. **Wrap**: start the dashboard (`sh <root>/start.sh`) if it is not already
   running, and report the URL.

## Lead states

| State | Condition | Offer |
| --- | --- | --- |
| new | folder present, no registry entry | adopt, then run the chain |
| WIP | entry present, one of `requirements.json` (checked only when the business-analyst skill is installed) / `ARCHITECTURE.md` / `estimation.json` / `proposal.md` missing | resume at the first gap |
| done | entry present, no artifact from the WIP row missing | nothing; re-run a named step on request |
| orphan | entry present, folder gone | report only — never delete |

## Adoption

1. The folder name must match `^[a-z0-9]+(-[a-z0-9]+)*$`. It does not → refuse,
   print the exact `mv` command, and write nothing.
2. Ask two questions, both skippable:
   - client company name — skipped writes `null`
   - project name — skipped writes Title Case of the folder name
3. Both answered, and the folder is not already named
   `<kebab(client)>-<kebab(project)>` → offer that rename once. Accepted →
   `git mv` (plain `mv` outside a repo). Declined, or a folder of that name
   already exists → keep the current name and do not ask again.
4. Write the entry — *after* any rename, so the id can never name a folder that
   no longer exists:

   ```
   node scripts/lead-upsert.mjs --root <root> --id <folder-name> \
     --patch '{"client":<string|null>,"title":"<project>","created":"YYYY-MM-DD"}'
   ```

   `created` has no default and the registry rejects an entry without one.
5. Commit.

Ids need no collision handling: the id is the folder name, and a directory
cannot hold two entries with the same name.

## Registry sync

Runs after `/proposal`, never after `/estimate` — the lead's value is the
range the proposal quotes to the client, which exists only once
`proposal-figures.json` does. The estimate produces one price and no
scenarios, so `scenario` stays `null`.

| Field | Source |
| --- | --- |
| `value` | `.cost.low` / `.cost.high`, currency from `proposal.md` frontmatter |
| `client` | `proposal.md` frontmatter, only when the entry's `client` is `null` |

Apply with one `lead-upsert.mjs` call, then commit.

## Failure

A sub-skill that stops short is reported as it stopped — its own error, its own
partial output, left in place. Options: fix the input and re-run that skill,
skip it, or stop the chain. Never re-run a later skill over a missing earlier
artifact; `/proposal` in particular hard-requires both `ARCHITECTURE.md` and
`estimation.json`.

## Dependency

Node ≥ 20 and `npx likec4`. Check both at step 1 and stop if either is missing.
