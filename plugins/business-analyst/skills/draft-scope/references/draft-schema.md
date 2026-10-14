# draft.json

All fields required unless marked optional. `check.py` enforces this file.

```json
{
  "client": "Riverside Bakery",
  "date": "2026-10-08",
  "sources": [
    { "id": "E1", "kind": "email", "date": "2026-09-02", "who": "Dana Lee — Running out of flour", "file": "sources/E1.txt" }
  ],
  "problems": [
    { "id": "P1", "text": "We run out of flour before we notice",
      "quotes": [{ "source": "E1", "text": "exact words from E1" }] }
  ],
  "scope": {
    "covered": "…",
    "pillars": [{ "system": "Stock", "pillar": "…" }],
    "exclusions": [{ "text": "Delivery routes", "reason": "owned-elsewhere", "source": "C1" }]
  },
  "systems": [
    { "name": "Stock", "purpose": "…; closes P1", "problem": "P1",
      "workflows": [
        { "kind": "main", "steps": ["Order In", "Bake"], "source": "C1" },
        { "kind": "side", "steps": ["Pack", "Short-pack alert"], "returnsTo": "Order In", "source": "C1" },
        { "kind": "sub", "name": "Custom cake", "steps": ["Quote", "Confirm Design"],
          "startsAt": "Order In", "rejoinsAt": "Bake", "share": "~30% of orders", "source": "C1" }
      ],
      "features": [{ "name": "Low-flour alert", "does": "Warns …", "problem": "P1", "source": "E1" }] }
  ],
  "assumptions": [{ "text": "…", "feature": "Low-flour alert", "source": "E1" }],
  "questions": [{ "text": "…", "why": "…", "assume": "…", "refs": ["P1", "E1"] }]
}
```

- `sources[].id`: `E`, `C` or `N` and a number. `kind`: `email`, `call`
  or `note`. `file`: path relative to `draft.json`.
- `problems[].id`: `P` and a number.
- `scope.pillars`: optional. `exclusions[].reason`: `owned-elsewhere`,
  `later-phase` or `no-detail`.
- `workflows[].kind`: `main`, `side` or `sub`. `returnsTo`, `name`,
  `startsAt`, `rejoinsAt`, `share`: optional.
- `assumptions[].feature`: a feature `name` in the draft.
- `questions[].refs`: problem and source ids.
