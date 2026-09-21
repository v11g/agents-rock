---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-router skill on this. Here is the thread — tell me how to approach it:

# #eng-delivery — thread

**Priya (Eng Manager):** Delivery has been sliding for weeks and I don't think it's one thing. Commitments keep slipping and nobody can point to a single blocker.

**Marcus (Staff Eng):** Same pattern here. Whenever a newer engineer gets stuck on the billing service, they ping me or Dana directly instead of asking in the team channel.

**Marcus:** We're the only ones who know that codebase well enough to unblock people fast, so we end up context-switching constantly.

**Dana (Staff Eng):** My calendar is just interrupts now. I used to get long stretches to actually build things.

**Dana:** Now it's Slack DM, pairing call, Slack DM, pairing call, and the deep work never happens.

**Jae (PM):** Is this a ramp-up thing? New folks will get faster once they know the codebase.

**Marcus:** That's what we told ourselves last time. We ran a tribal-knowledge doc sprint after the last slowdown.

**Marcus:** Wrote up runbooks, recorded walkthroughs, hoped it would cut the interrupt load.

**Marcus:** It helped for a while. Then it crept right back to where it started.

**Priya:** Right, that's the part that worries me. We already tried the docs fix.

**Priya:** It held for a while and then the same pattern came back — new engineers still route around the docs and go straight to whoever answered fastest last time.

**Sam (Eng):** From the ground floor: even when I do read the runbook, a lot of the actual decisions live in someone's head, not the doc. So I still end up asking.

**Dana:** And every handoff between review and deploy adds a wait. A PR sits for review, review sits behind whoever's unblocking someone else, deploy sits behind whoever's on call being unavailable because they're also fielding interrupts.

**Marcus:** It's not any single step being slow. It's that the same handful of people are load-bearing for almost every path through the system.

**Jae:** So more onboarding docs won't fix it.

**Priya:** I don't think so, not this time. We already ran that play and watched it fade.

**Priya:** Something about how work routes through the team is the actual problem, not any one step in the pipeline.

**Dana:** Agreed. I don't want another quick fix that looks good for a while and then quietly reverts to the same shape.

**Sam:** Would it help if requests got triaged before hitting Marcus or Dana directly?

**Marcus:** Maybe, but that's still routing around the underlying issue instead of changing it.

**Marcus:** I'd rather understand why the interrupts keep flowing back to the same people before we bolt on another workaround.

**Dana:** Every time we've patched a symptom here, the underlying routing stayed the same and the slowdown just resurfaced somewhere else.

**Priya:** Let's get this in front of someone who can look at the whole loop, not just patch the symptom again.

**Jae:** Agreed. Who should own that?

**Priya:** Not sure yet. But whoever it is needs to look at the system, not just the latest complaint.

**Marcus:** Which is exactly why the docs sprint didn't hold. We treated it like a knowledge gap when it's actually a routing gap.

**Priya:** Agreed. Let's not scope this as "write better docs" again. Whatever we bring in needs to look at how requests move through the team, not just where the knowledge lives.

**Jae:** Makes sense. I'll hold off proposing anything until we've got the right lens on it.
