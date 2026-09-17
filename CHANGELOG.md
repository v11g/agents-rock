# Changelog

## Unreleased

### Added

The leads dashboard serves documents at the lead root — `requirements.md`,
`rfp.md`, a client PDF (`.md`, `.txt`, `.csv`, `.json`, `.pdf`; one level deep,
same traversal and symlink guards) — and evidence nodes on the lineage map now
link to them, so a click opens the file in the browser.
(`solution-architect` 1.1.1)

The business-analyst validator ships a Python port, `scripts/validate.py`,
parity-tested against the Node validator, so the skill also runs where Node is
unavailable — e.g. the claude.ai sandbox. (`business-analyst` 0.2.0)

Features now carry real interview scores at STANDARD depth. Five factors —
technology, size, dependencies, uncertainty and risk — are scored 1 to 5, each
with the guide sentence that justified it and the evidence it came from. Their
sum and the tier it lands in show on the estimate page and in the workbook, and
the Summary's tier is cross-checked against them. The rubric lives in
`references/scoring-guide.md`, so the interviewer and the page use the same
sentences. (`solution-architect` 2.0.0)

Scores can be reviewed outside the interview. `scores-review.html` and its CLI
render every feature's scores for a second opinion, with a CSV round-trip and a
diff for spreadsheet reviewers; changing a score asks why, and the answer is
kept with it. (`solution-architect` 2.0.0)

The feature breakdown is two tabs. Estimate holds the effort arithmetic,
Scoring holds the interview's judgment, and each expands to the reasoning behind
a row — tasks on one side, the rubric sentence and its evidence on the other.
Both share the filters, the grouping and the expanded set. (`solution-architect`
2.0.0)

The estimate page is shareable. Every breakdown choice — tab, milestone,
container and source filters, roadmap grouping, each tab's sort, which rows are
expanded, the scoring guide — is written into the URL, and so is the client-view
preview, so a link reopens exactly the table you were reading. Values the
receiving copy does not recognise are dropped rather than applied.
(`solution-architect` 2.0.0)

### Changed

The score review page is designed for the job it does. Each feature is a band —
its name, total and tier on the left, the five factor scores across the right —
so the evidence behind every score reads as a sentence instead of a column of
stacked words. A plot at the top places every feature on the total scale, so the
shape of the estimate and its outliers are visible before any scrolling, and a
dot moves the moment you change a score. Scores you change are marked in one
colour throughout, with the evidence they outdate struck through and the score
they replaced named. The page follows the system theme and toggles from the
header. (`solution-architect` 2.0.1)

The agent no longer redesigns the score review page for each lead. The page ships
designed, so every reviewer sees the same one and the read-back contract has a
single version. (`solution-architect` 2.0.1)

The estimate interview assumes AI coding agents write the code. It now asks only
whether humans are writing it instead, the same shape as the AI-assistance
question, and records the answer either way. Estimates written before this keep
reading as traditional when the field is absent. (`solution-architect` 2.0.1)

The leads dashboard and the architecture viewer open in dark mode by default.
Pages with a theme toggle still switch to light and the viewer remembers the
choice; the print-ready proposal page stays light. (`solution-architect` 1.1.1)

The `npx` installer now asks before it writes. Running it bare shows prompts for
plugins, agents, and install scope, then a summary you confirm — built on
`@clack/prompts` in place of the hand-rolled picker.

Install scope is now a choice. `--global`/`-g` installs under your home
directory (honoring `CLAUDE_CONFIG_DIR` and `CODEX_HOME`); `--project` installs
under the detected project root, found by walking up for `.git` and then for
`package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml`. When that root is
not your current directory the installer shows both and asks. `--dir <path>`
names the directory outright, `-y`/`--yes` skips confirmations and assumes
`--project`.

Scenarios describe AI help and what it costs instead of naming an Anthropic
plan. `aiAssisted` gates the per-category hour reduction and
`toolingCostPerSeat` prices it for any vendor; an AI-assisted scenario with no
seat cost must record that as an assumption or the validator refuses. The
estimate page's scenario cards, cost bars and what-if rail were replaced by a
single Summary section. (`solution-architect` 2.0.0)

### Fixed

The workbook's Score Rationale tab named the wrong source. Its Provenance column
carried who set the score while the estimate page's Source column carried where
the feature came from, and the two share the words stated and proposed, so the
same feature read differently in the two places. The tab now carries both, spelled
out: FEATURE SOURCE matches the page row for row, and SCORE ORIGIN says whether
the agent proposed the score or a reviewer changed it. (`solution-architect`
2.0.1)

Running `npx @v11g/agents-rock` with no `--plugin` left the picker unusable. It
redrew by counting logical lines rather than wrapped terminal rows, so the long
plugin descriptions wrapped and every keypress left stale duplicate rows behind;
Enter also went unhandled whenever the terminal reported it as `enter` rather
than `return`, leaving the prompt stuck.

Installing from a subdirectory no longer creates a stray skills directory there
— project scope resolves to the repository root.

Evidence cites stayed visible in a client render of the estimate page. They are
internal shorthand — ticket and document references — and both the
`--client-only` render and the in-page client preview now hide them.
(`solution-architect` 2.0.0)

The score review page lost edited scores on re-render and did not escape
feature ids; it also had no way to show that an anchor no longer matched the
score beside it. Edits survive, ids are escaped, and stale anchors are marked.
(`solution-architect` 2.0.0)

Switching the estimate page into the client view hid the button that leaves it,
so returning meant reloading. The toggle now stays put and names the view it
switches to. (`solution-architect` 2.0.0)

### BREAKING CHANGES

An install or uninstall run without a terminal now requires an explicit scope.
`npx @v11g/agents-rock -p lmk -a claude` errors naming `--global` and
`--project`; add `--project` to keep the previous behavior. Interactive runs are
unaffected — they ask.

Scenarios in `estimation-inputs.json` must replace `plan` with `aiAssisted` and
`toolingCostPerSeat`: `none` becomes `false`/`null`, `max5x` becomes
`true`/`100`, `max20x` becomes `true`/`200`. Computed scenarios rename
`planCost` to `toolingCost`. The numbers are unchanged under that mapping.
(`solution-architect` 2.0.0)

## v3.0.0 (2026-08-10)

A rewrite. The repository shipped a single skill at v2.0.1; it now ships a
Claude Code plugin, `solution-architect`, carrying three skills, installed with
`npx agents-rock`.

### BREAKING CHANGES

Nothing a v2.0.1 user referenced still exists at the same path or under the same
name. The break accumulated across two layout changes, the first of which was
never released, so no single commit carries a `!` marker.

| | v2.0.1 | v3.0.0 |
|---|---|---|
| Unit of install | one skill, files at the repository root | plugin with three skills |
| Skill invoked | `architecture-design` | `arch-docs`, `estimate`, `proposal` |
| Install | copy the root `SKILL.md`, `assets/`, `references/`, `scripts/` | `npx agents-rock` |
| Layout | `./SKILL.md` | `plugins/solution-architect/skills/<name>/` |

Migration: uninstall the old skill by deleting its directory, then run
`npx agents-rock`. There is no automated upgrade path — the old skill's prompts
and assets have no counterpart in the new set.

The last release of the previous layout stays reachable at `v2.0.1`, and the
final plugin-marketplace layout before this rewrite at `v2.1.0-legacy`.

### Added

- **`arch-docs`** — interviews for an architecture, writes `ARCHITECTURE.md` and
  ADRs, then renders a self-contained offline viewer: routed pages, a reading
  rail with a scroll spy, per-section explainers, and pan/zoom diagrams backed by
  LikeC4 and Mermaid. Validation gates rendering.
- **`estimate`** — three-point PERT estimation with project-level spread and risk
  buffers, per-task AI-assist categories, scenario comparison, a component and
  container roster, and a milestone roadmap. Renders a print-ready page with a
  live what-if rail and a client-safe mode that redacts rates.
- **`proposal`** — derives client-facing figures from `estimation.json` and
  renders a print-ready proposal, with checks that refuse any money or duration
  not traceable to the estimate, plus leak and jargon gates.
- **`agents-rock`** — npx installer. Discovers bundled plugins, offers a
  multi-select picker, installs each skill as one canonical copy under
  `.agents/skills/` with per-agent symlinks for Claude Code and Codex, and
  uninstalls by reference count.

### Changed

- Skills are distributed as a plugin under `plugins/`, described by
  `.claude-plugin/marketplace.json`, rather than as loose files at the root.
- Pages embed their own fonts and carry no external URL, so they open from
  `file://` with no network.

### Fixed

- 35 fixes, 22 of them scoped to a skill (15 `arch-docs`, 4 `estimate`,
  3 `proposal`) — mostly the renderer and validators: provenance and link
  checking, companion-document routing, nav construction, and figure
  traceability in `proposal`.

### Known gaps

- `LICENSE` is absent while `package.json` declares MIT.
- No CI: nothing publishes on a tag.

## v2.0.1 (2025-10-22)

Final release of the single-skill layout. See `git log v2.0.1` for detail.
