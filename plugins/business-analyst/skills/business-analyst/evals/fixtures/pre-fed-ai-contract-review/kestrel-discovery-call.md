# Discovery call — Kestrel Legal LLP
**Date:** 2026-09-10 · 74 min · Attendees: Rowan Ellis (Managing Partner,
Kestrel), Sofia Marchetti (Head of Commercial, Kestrel), Tom Ibori (IT
Manager, Kestrel), and our BA. Transcript lightly cleaned.

---

**BA:** Start with the business result. What has to improve?

**Rowan:** First-pass review of inbound supplier contracts. A junior
associate reads a 40-page MSA looking for the clauses we care about. It
takes 3.5 hours on average and we bill none of it — it's overhead on
fixed-fee retainers. We want the median down to 45 minutes of associate
time per contract, measured from our matter timer, within two quarters of
go-live. Second thing: we want to stop missing uncapped liability. We
missed one in March. That is the one that keeps me up.

**BA:** How will you measure the second one?

**Rowan:** Zero missed critical-risk clauses in the quarterly sample audit
our risk committee already runs — they pull 30 contracts a quarter.

**BA:** Who touches this process today?

**Sofia:** Three roles. Junior associate — does the read, writes the risk
memo. Supervising partner — signs off the memo and is the only person who
may send anything to the client. Practice assistant — files the executed
contract and chases signatures. That's it. No client-facing users at all.

**BA:** Walk me through the last one you did.

**Sofia:** Thursday. Supplier emails the MSA as a PDF to our shared
commercial@ mailbox. Practice assistant saves it into iManage under the
matter folder. Associate opens it, reads it against our clause playbook —
that's a Word document, 22 clause positions, each with "acceptable",
"negotiable", "reject". They write findings into a risk memo template,
send it to the supervising partner, partner reviews, partner emails the
client. If the associate is unsure about a clause they Slack the partner
and wait — sometimes a day.

**BA:** The playbook — who owns it and how often does it change?

**Sofia:** I own it. It changed four times last year. It is the source of
truth for what counts as risky.

**BA:** Which clause positions matter most?

**Sofia:** Uncapped liability, indemnity scope, IP assignment,
termination for convenience, governing law, and auto-renewal. Those six
are the critical set. The other 16 are nice-to-have.

**BA:** Rules with numbers — give me the hard ones.

**Sofia:** Liability cap below 12 months of fees is a reject. Auto-renewal
longer than 12 months is a reject. Governing law outside England and
Wales is escalate-to-partner, not an automatic reject. Termination notice
under 30 days is negotiable, not reject.

**BA:** Example either side of the liability rule?

**Sofia:** A cap at 6 months of fees — reject. A cap at 18 months of fees
— acceptable, no flag.

**BA:** Now the AI piece. What exactly should the assistant do?

**Rowan:** Read the PDF, find the six critical clauses, and flag each one
against the playbook position. It drafts the risk memo. It does not
approve anything, it does not email anyone, it does not negotiate. It
recommends — a human decides.

**BA:** So the authority verb for clause flagging is recommend, and for
memo drafting?

**Rowan:** Also recommend. It produces a draft, the associate edits it.
Nothing leaves our system without a human.

**BA:** Human-in-the-loop gates?

**Rowan:** Two. Every drafted risk memo is reviewed by the junior
associate before it goes anywhere. Every memo that goes to the client is
approved by the supervising partner. That second one is absolute — the
assistant must never send a contract or memo to a client without
supervising-partner sign-off. Put that in writing.

**BA:** What may it read, what may it write?

**Tom:** Read-only on iManage — contract PDFs and the matter metadata.
Read-only on the clause playbook, which sits in SharePoint Online. Write
access to exactly one place: the draft memo back into the matter folder in
iManage. No mailbox access at all. We're on Microsoft 365, UK tenant, and
nothing may leave the UK region — that's a hard constraint from our PI
insurer.

**BA:** Failure handling. What should it do when it isn't sure?

**Rowan:** If confidence is low on a critical clause, don't guess — mark
the clause "needs human read" and route it to the associate queue. If the
PDF is a scan it can't parse, stop and tell the associate, don't
half-process it. If iManage is down, queue the job and alert Tom, don't
fail silently.

**BA:** Evaluation. How do we prove it works before you trust it?

**Sofia:** I can give you 200 historical contracts where we already know
the answers — the risk memos are on file. The metric I care about is
recall on the six critical clauses; I will not go live under 98%. False
positives I can live with, we'd rather over-flag.

**BA:** Volumes, data, retention?

**Tom:** About 60 inbound contracts a month across the firm, average 38
pages. Contracts are client-confidential, retained 7 years after matter
close — that's already our iManage policy, it doesn't change. Roughly
14,000 historical contracts in iManage today.

**BA:** Non-functional — anything beyond the UK region rule?

**Tom:** Full audit log of every clause flag with the playbook version it
was judged against, retained 7 years. Turnaround on a single contract
under 10 minutes from upload to draft memo. Availability — office hours,
08:00–18:00 UK, weekdays. Nothing exotic.

**BA:** What is explicitly out of scope?

**Rowan:** Contract negotiation, e-signature, anything touching billing,
and any client-facing portal. Out. Not this year, not next.

**BA:** Anything you'd want later but not now?

**Sofia:** Extending it past the six critical clauses to all 22 playbook
positions. And Italian-language contracts — we get a few from the Milan
office. Later, not now.

**BA:** Budget and approvals?

**Rowan:** Partnership approved £180,000 for the first phase. Tom is the
technical approver, I'm the commercial one.
