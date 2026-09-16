# agents-rock

A Claude Code plugin marketplace.

## Install

```
/plugin marketplace add git@github.com:v11g/agents-rock.git
```

(HTTPS equivalent: `https://github.com/v11g/agents-rock.git`)

```
/plugin install <plugin>@agents-rock
```

Replace `<plugin>` with any plugin from the table below, e.g.
`/plugin install lmk@agents-rock`.

### Install via npx (Claude Code + Codex)

```
npx @v11g/agents-rock                                   # interactive: pick plugins, agents, scope
npx @v11g/agents-rock -p <plugin> -a claude --project   # this project, Claude Code
npx @v11g/agents-rock -p <plugin> -a codex --global     # your home dir, Codex
npx @v11g/agents-rock -p <plugin> -a claude -a codex -g # both agents, home dir
npx @v11g/agents-rock uninstall -p <plugin> --project   # remove from this project, all agents
```

`-p <plugin>` installs every skill that plugin ships.

Run with no options and you get prompts for plugins, agents, and scope, then a
summary to confirm before anything is written. Nothing is written until you
confirm.

#### Scope

| Flag | Where skills land | Good for |
| --- | --- | --- |
| `--project` | the detected project root | skills committed alongside one repo |
| `--global` / `-g` | your home directory | skills you want in every project |

`--project` walks up from the current directory looking for `.git`, then for
`package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml`. When the root it
finds is not the directory you are standing in, it shows you both and asks which
to use — so running the installer from `packages/web/src` does not quietly
create a skills directory there. Use `--dir <path>` to name the directory
yourself and skip detection.

`--global` honors `CLAUDE_CONFIG_DIR` and `CODEX_HOME` if you have relocated
either agent's config.

#### Layout

Both scopes use the same shape — one canonical copy, symlinked per agent:

```
project scope                        user scope
<root>/.agents/skills/<skill>        ~/.agents/skills/<skill>      canonical copy
<root>/.claude/skills/<skill>   ->   ~/.claude/skills/<skill>      symlink
<root>/.codex/skills/<skill>    ->   ~/.codex/skills/<skill>       symlink
```

Editing the canonical copy updates every agent. On systems that refuse symlinks
the installer falls back to a junction, then to a plain copy, and warns that
updates will no longer propagate.

#### Other flags

| Flag | Effect |
| --- | --- |
| `-y`, `--yes` | Skip confirmations; assumes `--project` |
| `-f`, `--force` | Overwrite or remove collisions |
| `-h`, `--help` | Full flag list |

Flags let the installer run unattended. Without a terminal it never guesses:
missing `--plugin`, `--agent`, or a scope flag is an error naming the flag,
rather than a hang.

## Plugins

| Plugin               | Description                                                                                                                                                                                   | Version |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `business-analyst`   | Business-analysis toolkit: interview-driven requirements discovery that turns raw client input into a validated, traceable requirements package ready for solution architecture.               | 0.2.0   |
| `solution-architect` | Solution-architecture toolkit: interview-driven architecture documentation with interactive diagrams and provenance-tagged facts, AI-aware project estimation, and client-ready proposals.    | 2.0.0   |
| `lmk`                | Terminal-native visual explainer: explains the current topic with cheap diagrams (flowcharts, sequences, timelines, tables) rendered directly in the terminal via a bundled Mermaid renderer. | 0.1.0   |

## Skills

Skills split on one axis — who invokes them. **User-invoked** skills are
reachable when you type them (e.g. `/new-lead`); their job is to run a flow
you asked for. **Model-invoked** skills can be invoked by you _or_ reached
for automatically by the agent when the task fits.

**User-invoked**

- **[new-lead](./plugins/solution-architect/skills/new-lead/SKILL.md)** (`solution-architect`) — Orchestrator: sets up a lead workspace and launches business-analyst (when installed) → analyze-requirements → estimate → proposal in order, stopping between each, plus a leads dashboard.
- **[lmk](./plugins/lmk/skills/lmk/SKILL.md)** (`lmk`) — `/lmk` explains the current topic visually in the terminal; bare `/lmk` recaps the last substantial thing. Also auto-triggers on keywords like "explain this", "show me", or "I'm lost".

**Model-invoked**

- **[business-analyst](./plugins/business-analyst/skills/business-analyst/SKILL.md)** (`business-analyst`) — Interview-driven requirements discovery: turns raw client input (emails, notes, transcripts) into a validated requirements package (requirements.md + requirements.json) with labeled facts, open questions, and a readiness gate; triggers on asks to analyze client requirements, run discovery, or clarify a vague request. `new-lead` offers it as optional step 0 when installed.
- **[analyze-requirements](./plugins/solution-architect/skills/analyze-requirements/SKILL.md)** (`solution-architect`) — Interview-driven architecture documentation with interactive diagrams and provenance-tagged facts; triggers on asks for architecture docs, C4 diagrams, ADRs, or a threat model.
- **[estimate](./plugins/solution-architect/skills/estimate/SKILL.md)** (`solution-architect`) — Interview-driven, AI-aware project estimation with an interactive what-if page; triggers on asks for an estimate, quote, timeline, or "how long would this take".
- **[proposal](./plugins/solution-architect/skills/proposal/SKILL.md)** (`solution-architect`) — Pre-sales client proposal rendered as a print-ready page; triggers on asks for a proposal, client pitch, or "something I can send the client".

## Repo conventions

Each plugin follows the same layout:

```
plugins/<plugin>/
├── .claude-plugin/plugin.json
└── skills/<skill>/
    ├── SKILL.md         orchestration: entry point loaded by Claude Code
    ├── README.md        user-facing docs
    ├── assets/          static files the skill ships (templates, themes)
    ├── references/      supporting docs the skill points agents to
    ├── scripts/         zero-dep scripts the skill invokes
    └── workflows/       Workflow scripts the skill invokes
```

## Bundling a plugin

```
./bundle.sh <plugin>
```

Zips `plugins/<plugin>/` into `build/<plugin>.zip` (excluding `node_modules/`, `.git/`, and other zips).
