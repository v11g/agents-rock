---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the systems-thinking skill on this. Where should we intervene?

Code review is our bottleneck. Policy says two approvals before merge. In
practice the same four senior engineers give almost every approval, because
the policy also says one approver must be a code owner and they own most of
the repo. Review turnaround is measured per-PR and reported weekly.
