---
name: business-analyst
description: Interview-driven requirements discovery — turn raw client input (emails, notes, transcripts, briefs) into a validated, traceable requirements package before solution architecture. Use when the user asks to analyze client requirements, run discovery on a lead, clarify a vague request, build a BA requirements package, or prepare requirements for architecture and estimation.
---

# business-analyst

Turn incomplete client input into two artifacts in the lead directory:
`requirements.md` (five parts, human-readable) and `requirements.json`
(machine handoff for analyze-requirements, estimate, and proposal).

## Hard rules

1. Never invent requirements — every material fact carries a label
   (`confirmed` | `assumed` | `recommended`) and a source. A
   recommendation never renders as a confirmed requirement.
2. Problem before solution — no technology recommendations, no
   architecture. This skill stops at WHAT; HOW belongs to
   analyze-requirements and later skills.
3. Unknowns render as open questions, never silently filled. Distinguish
   unknown (client doesn't know) from undecided (client must choose).
4. Never block on unanswered questions — write the package with an honest
   status and readiness; a re-run refines it, never restarts the interview.
5. Every requirement carries a stable ID and traceability links;
   `node scripts/validate.mjs` must exit 0 before the package is final.
6. The human reviews requirements.md before status may become
   `READY_FOR_ARCHITECTURE`.

## Flow

1. **Detect evidence**: input documents? an existing `requirements.json`
   (re-run — see Re-run)? greenfield or existing system? State findings;
   the user can override.
2. **Depth and scope mode**: depth is STANDARD unless the user names
   QUICK or DEEP (`references/interview.md` §6); don't ask it. Scope mode:
   recommend one from the input, then confirm it with the user in one
   question through the host's question tool (§7).
3. **Extract**: pull every known goal, actor, process, rule, constraint,
   integration, and assumption from ALL inputs before asking anything.
4. **Gap analysis**: extracted knowledge vs the nine layers
   (`references/interview.md` §4) → prioritized P1/P2/P3 gap list.
5. **Select frameworks**: from `references/frameworks.md` — justify each
   pick in one line; never apply all.
6. **Interview**: per `references/interview.md` — one question at a
   time, adaptive, contradiction-challenging, example-hungry. Solution
   involves AI or agents → also work through `references/ai-extension.md`.
7. **Write**: requirements.md + requirements.json per
   `references/writing.md`. Workflow mode: then run
   `node scripts/scope.mjs --json <dir>/requirements.json --md <dir>/requirements.md`
   (no Node → `python3 scripts/scope.py`, same flags). It writes the To-be
   scope section; never edit that section by hand.
8. **Validate**: `node scripts/validate.mjs --json <dir>/requirements.json
   --md <dir>/requirements.md` — fix findings, re-run until clean. No Node
   in the environment (e.g. the claude.ai sandbox) → run
   `python3 scripts/validate.py` with the same flags; identical checks.
9. **Fresh-eyes review**: dispatch a subagent per `references/review.md`;
   apply findings, re-validate; one cycle max. No subagent available
   (e.g. claude.ai) → run the checklist yourself and say so in Part 5.
10. **Human review**: workflow mode → first confirm the ⚠ drafts with the
    user (`references/interview.md` §8), then re-run `scope` and validate.
    Show Part 5 (readiness report); the human confirms the status. Only
    they can promote it to `READY_FOR_ARCHITECTURE`.

## Re-run

`requirements.json` already exists → diff the new answers and material into
the registers (answer open questions, confirm assumptions, add findings),
keep every existing ID stable, recompute readiness, and advance the status.
Never restart the interview; ask only what is still open.

Switching scope mode is a re-run: `classic → workflow` keeps every ID and
adds systems, features and to-be workflow steps; `workflow → classic`
removes `systems`, `features` and `scopeMode`, then `scope` removes the
section. Run `scope` after every JSON change in workflow mode.

## Handoff

Downstream skills treat `requirements.json` as detected evidence — never a
prerequisite. FR/BR/ASM/Q ids are stable so architecture decisions and
estimates can cite them.

## Dependency

Node ≥ 20, or Python ≥ 3.10 where Node is unavailable (`scripts/validate.py`
is a parity-tested port of `scripts/validate.mjs`). Scripts are
dependency-free either way.
