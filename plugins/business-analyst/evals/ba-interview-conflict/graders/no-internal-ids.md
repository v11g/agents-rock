---
type: regex
pattern: '\b(CONFLICT|Q|FR|BR|ASM|SYS|FEAT|WF|ACT|NFR|INT|DAT|CON|SC|G)-\d+\b'
match: not_contains
target: last_message
---

No package file exists yet, so the user has never seen a register id.
Questions point at the PRD instead.
