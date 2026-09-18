// Stand-in for the mermaid bundle the analyze-requirements viewer step builds
// (analyze-requirements references/viewer.md §1). Shipped with the fixture so a
// proposal render never has to shell out to `npx likec4` / the network.
// render.mjs only requires that the bundle carries no literal closing script tag.
globalThis.mermaid = { initialize() {}, run() {} };
