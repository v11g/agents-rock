import { basename, extname } from 'node:path';
import { bucketPages, landingOf, slugOf } from './doc-sections.mjs';
import { nextSlug } from './slug-registry.mjs';

// A document is what a reader opens, so a document is what gets a route. The
// slug comes from the source filename rather than the H1: a title gets
// reworded, a filename is the thing every other document already links to.
// A section's index page takes the section slug instead, so #/decision-records
// lands on the list rather than on a file called index.
export function fileSlug(path) {
  return slugOf(basename(path ?? '', extname(path ?? '')));
}

// Keyed by document id, and built once by the caller, so the nav and the body
// cannot disagree about which slug opens which page.
export function routeMap(pages) {
  const routes = new Map();
  const seen = new Map();
  for (const bucket of bucketPages(pages)) {
    const landing = landingOf(bucket);
    for (const page of bucket.pages) {
      const base = page === landing ? slugOf(bucket.label) : fileSlug(page.path);
      routes.set(page.docId, nextSlug(base, seen));
    }
  }
  return routes;
}
