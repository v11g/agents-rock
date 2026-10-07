# Linking rubric — design test, 2026-10-06

Evidence behind spec 2 (`docs/superpowers/specs/2026-10-06-estimate-workflow-mode-design.md`, §4).
Question tested: given a client feature and an ARCHITECTURE.md §6 component table, how
reliably does an agent link the feature to the components that must change?

| File | What |
| --- | --- |
| `linking-core-v4.md` | the rubric that ships (8 questions) |
| `addons/addon-*.md` | 6 project-type add-ons (web/mobile, data pipeline, LLM/RAG, public API, ML, IoT), 78 sources; human reference only |
| `addons/fixture-*/` | 5 small reference architectures + 6 features each, used as test data |
| `results/linking-v1..v3*.md` | earlier rubric versions |
| `results/*-BRIEF.md` | the prompts given to linkers, blind judges, reviewers, graders, verifiers |
| `results/linker/` | blind-judge scores per project; `key.txt` maps X/Y labels to rubric variants |
| `results/reviewer/` | reviewer findings, grades against the judges' keys, and the 7 verifier verdicts |

## Numbers

Linker (6 features per project, mistakes = missing + wrong):

| Projects | No rubric | v1 | v2 | v4 core | v4 core + add-on |
| --- | --- | --- | --- | --- | --- |
| 3 real leads (Sin Kowa, Regenesys, Residental) | 12 | 5 | 6 | — | — |
| 5 fixtures (data, LLM/RAG, API, ML, IoT) | — | — | — | 13 | 33 |

Reviewer (core v4, on the core-only link sets, 36 features): drops 5 good / 0 bad; adds 1 good / 6 bad.
Verifier on the 7 adds: rejected 6/6 bad adds quoting §6; also rejected the 1 "good" add
(orphan component — handled by the `notEstimated` rule instead).

Conclusion: core rubric for linking; Review → Verify as the review workflow; add-ons not fed to agents.
