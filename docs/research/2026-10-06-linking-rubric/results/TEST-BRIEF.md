# Linking test brief (per fixture)

Inputs: a fixture folder with ARCHITECTURE.md (§5 containers, §6 component
table, §9 externals) and features.md (6 features). Rubric file(s) named in
the task.

Task: for each feature in features.md, apply the rubric(s) and list every
component from §6 that must be built or changed for the feature to work.
Use §6 component names exactly. Each link carries a one-sentence `why`
(rubric rule 6). Read nothing else in the rubric-test folder.

Output JSON (path given in the task):
{ "features": [ { "id": "<id>", "links": [ { "component": "<§6 name>", "why": "..." } ] } ] }
Reply with only "done" + the path.
