# analyze-requirements — re-run safety

Skill: `plugins/solution-architect/skills/analyze-requirements`.
Companion handoff: `/tmp/handoff-system-design-merge-2026-09-23.md` §5.

This is the plumbing under three capabilities, only the first of which is in
scope here.

| capability | what it is | status |
| --- | --- | --- |
| re-run safety | a second run never silently overwrites a hand edit | **this spec** |
| `refine` | "how should we handle X?" → one ADR, not a regenerated document | later |
| `impact` | a requirement changes → affected items, stale evidence | later |

All three need the same thing: *know what is on disk, change only what this
work touches.* One piece of plumbing, three capabilities.

## The bug

A second `analyze-requirements` run regenerates the package and overwrites
hand edits. No diff, no warning, no record. The skill keeps no state, so it
cannot tell a file it wrote last week from a file a person rewrote this
morning.

`docVersion` exists in frontmatter but nothing compares it to disk.

## Decisions

Settled in brainstorming, with the reasoning that produced them.

### The diff comes from git, and per-section hashes are the fallback

A hash is one-way: it says **that** something changed, never **what**. The
handoff's shape — "compare its hash to `state.json`, on a mismatch show the
diff" — cannot be implemented as written, because a hash cannot produce a
diff. The old bytes have to come from somewhere.

| source of old bytes | verdict |
| --- | --- |
| git | **chosen when available.** Real diff, plus author and date, for free |
| a cache copy of every generated file | rejected — duplicates the package on disk and goes stale the moment anyone edits outside the skill |
| nowhere: per-section hashes only | **chosen as the fallback.** No diff, but "§7 and §13 changed" is enough to scope a write and to tell a person where to look |

### A hash mismatch is not evidence of a human

It means the bytes differ from what the skill wrote. A formatter, a merge, a
`git checkout`, another agent, or the same skill run from a second worktree
all look identical. Nothing in this design claims to identify an author, and
no message it prints should say "you edited this" — only "this changed since
the last run".

### Scope: the mode sets a ceiling, the run restates the files

Two layers, both required.

```
mode (the ceiling)            full    → 16 sections + companions
                              refine  → §14 + one new ADR
                              impact  → nothing; read-only

run (inside the ceiling)      before the first write, print the file list
                              this run intends to change
```

Computing the scope from drift instead — regenerate whatever changed — was
rejected: that is what `impact` *produces*, so using it as the input too is
circular.

### On drift inside the write set: gather, ask once, before writing

Three candidate policies were weighed against the fact that **manual edits are
rare**.

| policy | common case (nothing edited) | rare case (something edited) |
| --- | --- | --- |
| import the edit as a proposed change | free | the skill merges prose it did not write, silently. A rare *and* silent failure is the kind nobody learns to watch for |
| **ask once, before writing** | free — the file list prints either way | one question, once, carrying the diff |
| write beside it (`ARCHITECTURE.next.md`) | free | two divergent files on disk and nothing forcing a reconciliation |

Rarity is the argument *for* asking, not against it: the guard costs nothing
on the runs that dominate, and the run it does interrupt is the one where
something irreplaceable is at stake.

Rarity also caps the machinery. No merge engine, no three-way resolution.
Detect, show, ask which wins, obey.

### ADRs are exempt, because `decisions.md` already rules on them

An `accepted` ADR that needs changing becomes a **new** ADR with `supersedes`
— never an in-place rewrite, hash or no hash. This is not a second code path;
it is the existing rule, and the state file carries each ADR's `status` so the
run can tell an untouched `proposed` draft (safe to rewrite) from an accepted
record (never rewritten).

### It belongs to `analyze-requirements`

It is the only skill in the plugin that writes the package. There is no shared
library in this plugin — every skill carries its own `scripts/lib/`, and
`review-architecture` keeps its own `tables.mjs` rather than importing one —
so the code follows that convention.

`review-architecture` may one day *read* the state file to tell a reader that
a review describes revision 3 while the document on disk is revision 4. That
is a later nicety, explicitly out of scope: the review is stamped with
`docVersion` today and that is enough.

## The state file

`architecture-state.json`, beside `ARCHITECTURE.md`. That file is the one
anchor the skill already requires callers to name (`--arch`); companion paths
are unspecified today — a known defect — so anchoring anywhere else inherits
that problem.

```json
{
  "_generated": "written by analyze-requirements — do not edit",
  "revision": 3,
  "updated": "2026-09-23T10:11:00Z",
  "docVersion": "1.2.0",
  "gitCommit": "3dcac90",
  "files": {
    "ARCHITECTURE.md": {
      "hash": "sha256:9f2a…",
      "sections": { "1": "sha256:aa…", "7": "sha256:bb…", "13": "sha256:cc…" }
    },
    "docs/architecture/validation-plan.md": { "hash": "sha256:7c1d…" },
    "docs/adr/0001-postgres-job-queue.md": { "hash": "sha256:e4…", "status": "accepted" }
  }
}
```

- Paths are relative to the state file.
- `gitCommit` is `HEAD` at write time, or `null` outside a repo. It is what
  tells the next run whether the git path is available at all.
- `sections` exists only for `ARCHITECTURE.md` — it is the only file with a
  spine to cut on. Companions are whole-file.
- Section keys are the spine numbers as strings.

### Normalisation before hashing — deliberately minimal

CRLF → LF, strip trailing whitespace per line, exactly one trailing newline.
Nothing else.

Table column padding and frontmatter key order are **not** normalised. The
renderer is deterministic, so that padding is already stable, and every extra
normalisation rule is a way for a real edit to hash as *unchanged* — which is
the failure that loses data silently. If false drift appears in practice,
tighten this with a case in hand rather than in advance.

### Two properties that matter more than the shape

- **Written last, atomically** — temp file, then rename. A crash mid-run
  leaves state pointing at the previous consistent revision, so the next run
  sees the half-written files as drifted and asks about them, rather than
  trusting them.
- **No entry means not ours.** A file the skill has never written is never
  overwritten and never questioned. This is what makes the first run against
  an existing hand-written package safe.

## The write flow

```
run starts
  │
  ├─ read architecture-state.json      absent → first run, all untracked
  │
  ├─ MODE sets the ceiling             full | refine | impact
  │
  ├─ write set = what this run intends to change  ∩  ceiling
  │
  ├─ classify each file in the write set
  │       hash matches state   → unchanged
  │       hash differs         → drifted
  │       no entry in state    → untracked   (not ours, never written)
  │
  ├─ PRINT the write set — one line per file, with status
  │       drifted → git diff -- <file>        (repo + commit available)
  │                 "§7 and §13 changed"      (fallback: section hashes)
  │
  ├─ any drifted?
  │       no  → write
  │       yes → ASK ONCE, before the first write:
  │             per file: keep the file on disk (skip it) /
  │                       overwrite it with the new revision /
  │                       stop the run
  │
  ├─ write the files in the write set
  │
  └─ write architecture-state.json LAST, temp + rename
```

The question is asked before anything is written, or not at all. There is
never a half-written package waiting on an answer.

`impact` needs no new safety machinery: its write set is empty by
construction, so it cannot lose anything. That is why it comes nearly free
once this lands.

## Failure modes

| situation | behaviour |
| --- | --- |
| no state file | first run — everything untracked, nothing blocked, state written at the end |
| state file corrupt or unparseable | treat as absent, say so out loud, never delete it |
| not a git repo, or the output was never committed | section-hash fallback: name the sections, no diff |
| file in state but missing from disk | report it, never silently recreate — it may have been deleted deliberately |
| crash mid-write | state still points at revision N; the next run sees the N+1 files as drifted and asks |
| user answers "stop the run" | nothing written, state untouched, exit non-zero |
| `accepted` ADR drifted | never overwritten under any answer; the run says a new ADR is the only legal change |

## Components

| file | responsibility | ~size |
| --- | --- | --- |
| `scripts/lib/state.mjs` | read/write the state file, hash a file, hash each section, normalise | 70 |
| `scripts/lib/drift.mjs` | classify a write set into unchanged / drifted / untracked | 40 |
| `scripts/drift.mjs` | CLI printing the pre-write table; the agent reads its output | 40 |
| git diff path | `git diff -- <file>` when a repo and a commit exist, else the section fallback | 30 |
| `references/rewriting.md` | the discipline: when to hash, what to print, what to ask, the ADR exemption | ~100 |
| `SKILL.md` | the mode table; step 5 gains a pre-write gate | ~15 changed |

Roughly 450–550 lines including tests. Every file stays inside the 200-line
quality gate; `state.mjs` and `drift.mjs` are split at the seam between
"describe what is on disk" and "decide what that means" so neither grows into
the other.

## Testing

TDD, per `~/.claude/rules/tdd-workflow.md`: the failing test first, every time.

**The test for the actual bug, written first:** write a package, hand-edit one
section, re-run, assert the file was not overwritten. It has to fail against
today's code — that is what proves it tests the requirement rather than the
implementation.

Unit level:

- state round-trip, including a state file written and read back unchanged
- the three classifications: unchanged, drifted, untracked
- normalisation equivalence — CRLF vs LF, trailing whitespace, trailing
  newline count all hash the same
- normalisation non-equivalence — a real one-word edit hashes differently
- an `accepted` ADR is exempt regardless of hash
- a corrupt state file is treated as absent and is not deleted
- state is written last: a simulated crash before it leaves revision N intact

## Risks

**False drift is the one that decides whether this is worth having.** If a
regeneration changes a file in a way the normalisation does not cover, every
run asks a question with no real answer, and people learn to answer
"overwrite" without reading — which is worse than no guard at all, because it
manufactures consent for the exact thing this prevents. The mitigation is the
minimal normalisation above plus the first integration test; if it bites, the
evidence will be a concrete diff, and the fix is a normalisation rule with a
case attached.

**The mode ceiling is prose, not code, until `refine` exists.** In this slice
`full` is the only mode, so the ceiling is enforced by the skill's
instructions rather than by a guard. That is acceptable while there is one
mode and nothing to confuse it with; it becomes a real enforcement point when
`refine` lands, and that spec owns it.

## Out of scope

- `refine` and `impact` — separate features that consume this one
- `review-architecture` reading the state file for staleness
- any merge engine, three-way resolution, or conflict-marker output
- normalising table padding or frontmatter key order
- identifying *who* changed a file
