---
name: plugin-release
description: Release agents-rock plugins to npm via this repo's CI. Use whenever the user asks to release, publish, ship, bump versions, cut a release, or retrigger a failed publish in this repository — even if they say "release-bump" or "patch". This repo's CI auto-publishes when a plugin.json version bump lands on main; never tag manually and never bump the root package version.
---

# plugin-release

Releasing here means: bump plugin versions + docs, push to main. CI
(`.github/workflows/publish.yml`) owns the rest — the root package version,
the release commit, the git tag, and `npm publish`. If you find yourself
running `npm version` or `git tag`, stop: that duplicates what CI does and
the two will fight.

## How CI reacts to your push

- Trigger: a push to main whose diff changes any `plugins/**/plugin.json`
  **version** (`src/ci/changed-versions.mjs` compares the push's
  before..after — a version already bumped in an earlier push does not
  retrigger). `workflow_dispatch` also works but needs repo admin; a
  non-admin `gh workflow run` gets HTTP 403, so don't plan around it.
- CI then runs: `npm ci` → `npm test` → `npm version patch` on the root
  package → commit `chore: release vX.Y.Z (plugins: <names>)` → tag → push
  back to main → `npm publish`.

## Release steps

1. **Find unreleased work.** The last release is the newest CI release
   commit, not a tag — legacy tags (`agentic-estimation`, `v3.0.0` from an
   older scheme) make `git describe` lie:

   ```bash
   git log $(git log --grep='^chore: release v' -1 --format=%H)..HEAD --oneline --no-merges
   ```

2. **Pick bumps per plugin.** For each plugin with commits since then,
   choose the bump from Conventional Commits: breaking → major, `feat` →
   minor, `fix`/`docs`/`chore` → patch. Plugins without changes keep their
   version.

3. **Bump each version in three places, kept identical:**
   - `plugins/<plugin>/.claude-plugin/plugin.json`
   - that plugin's entry in `.claude-plugin/marketplace.json`
   - the plugins table in `README.md`

   Edit the JSON surgically (targeted string replacement). Parsing and
   re-serializing marketplace.json reflows its single-line keyword arrays
   into a noisy multi-line diff.

4. **CHANGELOG.md.** Add prose entries under `## Unreleased` (`### Added` /
   `### Changed` / `### Fixed`), matching the existing prose style — full
   sentences about what changed for the user, not commit-log dumps. End
   each entry with the plugin and version it ships in, e.g.
   `` (`solution-architect` 1.1.1) ``. Don't stamp a root version heading;
   CI decides that number at publish time.

5. **Test.** `npm test` — the full suite must be green. CI runs the same
   suite and a red push just burns a version number (see below).

6. **Commit and push.** One conventional commit (subject ≤ 50 chars,
   imperative), e.g. `chore: bump plugin versions for release`, body naming
   the plugin versions and why. Push to main.

7. **Watch CI.**

   ```bash
   gh run list --workflow=publish.yml --limit 1
   gh run watch <run-id> --exit-status
   ```

   Success is the log line `+ @v11g/agents-rock@<version>` in the
   "Bump, commit, publish" step. `npm view` can lag the registry by a few
   minutes — trust the log line, not an immediate `npm view`.

8. **Pull back.** CI pushed the release commit to main, so finish with
   `git pull --rebase origin main`.

## When the CI run fails

Diagnose with `gh run view <run-id> --log-failed`. Then:

- **Fix on main first** (a flaky test still gets a real fix — e.g. the
  Chrome-teardown `ENOTEMPTY` was fixed with `rmSync` retries, not a
  rerun). A fix commit alone does not retrigger publish unless it touches a
  plugin.json version.
- **Retrigger by bumping again.** Re-running the failed run reuses the old
  SHA, so the published package would miss your fix; `workflow_dispatch`
  needs admin. The reliable path: bump the affected plugin one more patch
  (the failed version never reached npm, so no gap exists for users) across
  the same three places, sync the CHANGELOG references, and push.
