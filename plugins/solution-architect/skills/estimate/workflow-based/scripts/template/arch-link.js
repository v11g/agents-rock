// the architecture document holds the C4 views; this page links there instead of redrawing them.
// PAGE.c3 maps a container's name to its id when it has components (a C3 view); the rest live in C2.
const ARCH = PAGE.arch;
const archLink = (containers) => {
  const c3 = containers.filter((c) => Object.hasOwn(PAGE.c3, c));
  const c2 = containers.some((c) => !Object.hasOwn(PAGE.c3, c));
  return [...c3.map((c) => `<a class="archlink" href="${ARCH}#panel-components-${PAGE.c3[c]}" target="_blank" rel="noopener">C3 ${esc(c)} ↗</a>`),
    c2 && `<a class="archlink" href="${ARCH}#panel-containers" target="_blank" rel="noopener">C2 containers ↗</a>`].filter(Boolean).join(' · ');
};
