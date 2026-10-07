// Workflow-mode pages (Workflow-based, Component-based) and estimation.md are
// spec 3. Until then this refuses loudly instead of rendering a classic page
// over workflow data.
console.error('estimate workflow mode: pages come in spec 3 — nothing rendered. estimation.json is complete and validated.');
process.exit(2);
