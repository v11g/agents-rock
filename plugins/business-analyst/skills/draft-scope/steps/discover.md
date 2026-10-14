# Step 1 — Discover

One note per source, in source order. The note follows the
summarize-interview template (credits.md), plus three lines the draft
needs. Use clear, simple language. Short bullets, one line each: a long
call gives more bullets, never longer lines. Leave out any part the source
says nothing about.

```markdown
### C1 · call · 2026-09-10
**Participants**: Dana Lee (owner) · Sam (our PO)
**Background**: family bakery, one shop

**Current Solution**:
1. Order arrives on WhatsApp → paper ticket → bake → pack → courier

**What They Like About Current Solution**:
- Ordering by WhatsApp; customers like it

**Problems With Current Solution**:
- Lost tickets: no one knows where a cake is

**Key Insights**:
- "When a ticket gets lost the customer calls us and we have no idea where the cake is."

**Action Items**:
- Dana, send the courier contract

**Keeps / Others own**: WhatsApp stays · courier owns routes
**Numbers & rules**: about 30% of orders are custom cakes
**Open points**:
- Same-day or next-morning delivery? (C1 vs E2)
```

- **Current Solution**: the steps followed today, in order; the workflow
  boxes start from them.
- **Problems**: importance or satisfaction only when the client said it.
- **Key Insights**: exact quotes, word for word, and anything surprising.
- **Action Items**: who promised what, by when, as said.
- **Keeps / Others own**: what stays as it is; parts another party owns.
- **Numbers & rules**: shares, counts, limits, rules, exactly as said.
- **Open points**: what is unclear or contradicts another source; they
  become client questions.

Skip what is not about the work (small talk, music, weather). Never
mention what you skipped, not even to say it was left out. An email
that only says "can we talk" still gets a note, often just Participants
and one open point.

Save all notes, in order, as `discover-notes.md` next to `draft.json`:
plain Markdown, the shape above without the surrounding code fence, so
claude.ai and any Markdown viewer render it for the PO to review. Start
the file with `# Discover notes — <client>`.
