---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-router skill on this.

Our CI queue saturates every afternoon and builds sit for forty minutes.
We raised the runner pool from 20 to 30 in June — the wait dropped for two
weeks, then came back. We raised it again to 40 in August, same shape:
better briefly, then back to forty minutes.

Nobody has changed how they work because of it. People still push the same
way, at the same times; they just wait longer. The afternoon peak is when
the nightly data jobs and the PR builds land on the same pool.
