# Reasoning plugin — spec 5: read-only visual board

Depends on spec 4 (`2026-09-29-reasoning-linked-format-design.md`): ids,
`supports`/`blocks` links, and files saved under `~/.reasoning/problems/`.

## Slice boundary

| Spec | Contents | Status |
| ---- | -------- | ------ |
| 4 | ids, links, always-saved files | designed |
| 5 (this) | read-only board, `/reasoning:board` | designed |
| later | editing from the board, "Ask agent" button, suggestions ✓/✗ | not designed |

Out of scope: any write from the board, agent-triggered updates, remote
access, multi-user use.

## Purpose

A local web page that draws each saved reasoning run as a graph and
redraws it as the skill rewrites the file.

```
~/.reasoning/problems/**.md ──fs.watch──▶ server ──SSE──▶ browser (React Flow 12)
   written by the skills       parse, convert,       draws what it is given
                               lay out
```

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Read-only | Human's call. One writer (the skill) means no overwrite risk and no watcher inside the Claude Code session. Editing is its own later spec. |
| 2 | Micro-kernel: a fixed core plus one plug-in file per framework | Human's call. A new framework adds one file and one fixture; the core is untouched. |
| 3 | 4 layout skeletons, also plug-ins: chain, tree, columns, network | 13 blocks share 4 placements. A new shape adds a 5th skeleton file. |
| 4 | Signature looks ship in version 1 | Human's call. Decorations are background nodes and custom edges; they add no library. |
| 5 | `@xyflow/react` (React Flow 12), latest | Human's call. It is bundled separately from `new-lead`'s React Flow 11, so the two never load together. |
| 6 | Same delivery as `new-lead`: pre-built bundle committed, `node:http` server, no install for the human | Proven in this repo. |
| 7 | The server computes the full graph, positions included; the browser only renders | Every rule becomes a pure function testable with `node --test`. |
| 8 | Unknown block → core nodes plus a text card | A framework without a plug-in is still visible on day one. |
| 9 | Version 0.5.0 → 0.6.0 | New skill and code. |

## Architecture

```
            ┌───────────────────────── kernel ─────────────────────────┐
            │ watch → read → parse YAML → core nodes → registry lookup │
            │        → plug-in toGraph → skeleton layout → decorate    │
            └───────────▲──────────────────────────▲───────────────────┘
                        │                          │
            frameworks/*.mjs (13)          skeletons/*.mjs (4)
```

### Plug-in contract

```js
// board/frameworks/<block>.mjs
export default {
  block: 'rca',              // the YAML key it handles
  skeleton: 'tree',          // a file name in board/skeletons/
  toGraph(block) {},         // → { nodes, edges } for this block's claims
  decorate(layout) {},       // optional → background nodes / edge styles
};
```

```js
// board/skeletons/<name>.mjs
export default {
  name: 'tree',
  layout(graph) {},          // → the same graph with x/y on every node
};
```

The registry loads every file in both folders at start. A plug-in whose
`skeleton` names no loaded skeleton fails the start with a clear message.

### Graph shape

Node `type` is one of `evidence`, `assumption`, `question`, `claim`,
`card` (the fallback), or `decoration`. Node `id` is the spec-4 id; a
decoration id starts with `d`. Edges:

| Edge | From → to | Source |
| ---- | --------- | ------ |
| supports | evidence/assumption → claim | `supports` |
| blocks | question → claim | `blocks` |
| framework | claim → claim | the plug-in (chain order, links, loops) |

Styling rules the kernel applies to every framework: a claim with
`status: root_candidate` or backed only by `unverified` assumptions is
dashed; a question is dashed and shows its `Look in:` line.

### Frameworks

| Skeleton | Frameworks | Signature look |
| -------- | ---------- | -------------- |
| chain | five_whys, theory_of_change, iceberg, pdca | 5 Whys vertical with "why" edge labels; ToC horizontal with stage labels; Iceberg waterline band below the event; PDCA on a circle with Act → Plan |
| tree | rca, leverage_points, router | RCA fishbone spine behind the layers; leverage points ranked by depth; router: class → recommended, rejected greyed |
| columns | double_diamond, a3, three_horizons, systemic_design | two diamond outlines behind the columns; A3 eight panels; three horizons as three rising curves; systemic design four phase headers |
| network | causal_loop, system_map | loop variables on a circle, R/B label at each loop centre, ‖ on delayed links; system map boundary drawn as a rounded region |

`chain` and `tree` place nodes with dagre. `columns` and `network` use
the skeleton's own arithmetic (fixed column x, nodes stacked; loop
variables on a circle).

## Server

```
/reasoning:board → start.sh → node board/kernel/serve.mjs → 127.0.0.1:<free port ≥ 4700>
```

| Route | Returns |
| ----- | ------- |
| `GET /` | the page |
| `GET /api/problems` | problem folders, newest first, each with its runs |
| `GET /api/graph/:problem/:run` | the kernel's graph for one file |
| `GET /events` | server-sent events: `changed {problem, run}` |

`fs.watch` on `~/.reasoning/problems`, recursive, with a 200 ms pause
after the last change before a file is read, so a half-written file is
not parsed.

## The page

Left panel: problems, each expanding to its run chain (`01 router`, `02
rca`, …). The open run follows new files in its problem unless the human
picked another. Canvas: pan, zoom, minimap, fit-to-view; nodes are not
draggable or connectable. A dot in the header shows the live connection.

## Errors

| Case | Board does |
| ---- | ---------- |
| file unreadable or not valid front-matter | keeps the last good graph, shows the banner "file unreadable" |
| `supports`/`blocks` id matches no node | node drawn without that edge; warning listed in a corner panel |
| block has no plug-in | core nodes plus one `card` node holding the block as text |
| request path resolves outside `~/.reasoning/problems` | 404; the server never writes there and never follows symlinks out. Its only write is `~/.reasoning/board.port`, removed on exit |
| folder does not exist yet | empty state: "no runs yet — start a reasoning skill" |
| SSE connection drops | the page reconnects and refetches the open run |

## The `/reasoning:board` skill

1. If a board is already running (`~/.reasoning/board.port` names a port that answers),
   print its URL and stop.
2. Otherwise start `start.sh` in the background and print the URL.
3. First run only: if `Read(~/.reasoning/**)` and `Edit(~/.reasoning/**)`
   are not in the human's settings, offer to add them via
   `AskUserQuestion`. Headless: print the two rules and do not edit settings.

## Files

```
plugins/reasoning/
├── skills/board/SKILL.md
└── board/
    ├── start.sh
    ├── kernel/        serve.mjs, watch.mjs, read.mjs, core-nodes.mjs, registry.mjs, graph.mjs
    ├── frameworks/    13 plug-ins
    ├── skeletons/     chain.mjs, tree.mjs, columns.mjs, network.mjs
    ├── page/          index.html, app.jsx (bundled)
    ├── vendor/        board-bundle.js (@xyflow/react + dagre + page), yaml bundle
    ├── vendor-build/  package.json, build script (dev only; node_modules ignored)
    └── test/          *.test.mjs, fixtures/<block>.md
```

Every file stays within the repo's quality gates (200 lines, 20-line
functions); one file per plug-in keeps this natural.

## Testing

`node --test`, picked up by the root `npm test` glob extended to
`plugins/*/board/test/*.test.mjs`.

| Test | Proves |
| ---- | ------ |
| one fixture per framework → expected nodes and edges | each plug-in's `toGraph` |
| each skeleton → every node has x/y, no two nodes overlap | layouts |
| unknown block fixture | the fallback card |
| broken front-matter, dangling id | the error rows above |
| path with `..` and a symlink out | the path guard |
| registry with a plug-in naming a missing skeleton | start fails with the message |

Visual correctness of signature looks is checked by eye in a manual pass:
one fixture per framework opened in the browser.

## Verification

1. Kernel, registry, core nodes, path guard — RED then GREEN.
2. Skeletons — RED then GREEN.
3. 13 plug-ins, one fixture each — RED then GREEN.
4. Server routes and SSE against a temp folder.
5. Bundle build; page renders every fixture; manual look pass.
6. `/reasoning:board` skill: an eval case that it prints a URL and does not
   run a framework.
