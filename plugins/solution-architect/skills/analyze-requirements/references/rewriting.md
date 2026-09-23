# Rewriting — what is already on disk

Read before step 5 writes anything, on every run after the first.

## 1. The rule

**Ask before the first write, or not at all.** A package half-written while a
question waits is worse than either answer: the reader cannot tell which
sections are theirs and which are ours.

## 2. What the state file knows, and what it does not

`architecture-state.json` sits beside `ARCHITECTURE.md` and records a hash per
generated file, plus a hash per spine section for `ARCHITECTURE.md`. It is
**written last**, after every document is on disk, through a temp file and a
rename — so a crash leaves it pointing at the previous consistent revision.

A hash says a file **changed since the last run**. It cannot say who changed
it: a formatter, a merge, a `git checkout`, another agent and a person all look
identical, and a hash cannot tell them apart — so the document must never
claim it knows an author. Write "this changed since the last run", not a
claim about who did it.

## 3. The gate

Before writing, run:

    node scripts/drift.mjs --state <package>/architecture-state.json \
      --files ARCHITECTURE.md docs/architecture/validation-plan.md …

List every file this run intends to write. Paths are relative to the state
file. Exit codes: `0` nothing drifted, `2` something drifted, `1` usage error.

| verdict | meaning | what to do |
|---|---|---|
| `unchanged` | matches what we wrote | write it |
| `new` | we have never written it and it is not on disk | write it — nobody has one |
| `untracked` | we have never written it, but a file is there | **never write it** — it is not ours |
| `missing` | we wrote it, it is gone now | report it; never silently recreate it |
| `locked` | an ADR whose `## Status` on disk reads accepted | never rewrite; a new decision is a new ADR with `supersedes` |
| `drifted` | changed since we wrote it | ask, before writing anything |

## 4. Asking

One question, covering every drifted file at once, before the first write.
Show what the gate printed — the diff where git supplied one, the changed
section numbers where it did not. For each file offer exactly three answers:

- **keep the file on disk** — skip it; the rest of the run proceeds
- **overwrite it with the new revision** — the edit is lost, and they have been
  shown what they are discarding
- **stop the run** — nothing is written, the state file is untouched

No merge. No three-way resolution. Detect, show, ask which wins, obey.

## 5. First runs and broken states

No state file means a first run: every file is still judged — untracked where
one is already on disk, `new` where none is — nothing is blocked, and the state
is written at the end.

A state file that will not parse is treated as absent, said out loud, and
**never deleted** — it is the only record of what the last run wrote. It is not
a first run, though: the file's existence says tracked documents are on disk,
and its corruption is what stops us telling which of them moved. Nothing on
disk can be verified against it, so nothing in that run is cleared for writing.
