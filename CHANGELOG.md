# Changelog

## Unreleased

### Added

The leads dashboard serves documents at the lead root — `requirements.md`,
`rfp.md`, a client PDF (`.md`, `.txt`, `.csv`, `.json`, `.pdf`; one level deep,
same traversal and symlink guards) — and evidence nodes on the lineage map now
link to them, so a click opens the file in the browser.
(`solution-architect` 1.1.0)

The business-analyst validator ships a Python port, `scripts/validate.py`,
parity-tested against the Node validator, so the skill also runs where Node is
unavailable — e.g. the claude.ai sandbox. (`business-analyst` 0.2.0)

### Changed

The leads dashboard and the architecture viewer open in dark mode by default.
Pages with a theme toggle still switch to light and the viewer remembers the
choice; the print-ready proposal page stays light. (`solution-architect` 1.1.0)

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

### Fixed

Running `npx @v11g/agents-rock` with no `--plugin` left the picker unusable. It
redrew by counting logical lines rather than wrapped terminal rows, so the long
plugin descriptions wrapped and every keypress left stale duplicate rows behind;
Enter also went unhandled whenever the terminal reported it as `enter` rather
than `return`, leaving the prompt stuck.

Installing from a subdirectory no longer creates a stray skills directory there
— project scope resolves to the repository root.

### BREAKING CHANGES

An install or uninstall run without a terminal now requires an explicit scope.
`npx @v11g/agents-rock -p lmk -a claude` errors naming `--global` and
`--project`; add `--project` to keep the previous behavior. Interactive runs are
unaffected — they ask.

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
