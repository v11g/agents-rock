# Steps 4–5 — Check and Build

## 4 Check

Run `python3 scripts/check.py --draft <dir>/draft.json`.
- Prints `draft clean` → go on.
- Prints findings → fix each in `draft.json`, run again. A quote finding
  shows the closest sentence in the source; copy that sentence exactly or
  pick another quote.

Then check what the script cannot:
- Every number the client gave survives as written ("~30%", "twice").
- Every problem sits in some system's purpose or feature.
- The systems read as the client's business areas.
- Nothing in the draft comes from small talk. Never mention what you
  skipped, here or in your reply.

## 5 Build

`python3 scripts/build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx`

The docx holds, in order: title and note, Sources, Problems we heard,
Scope (exclusions), one section per system (purpose, step lines, features),
Assumptions, Questions for the client.
