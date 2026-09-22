import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inline, stripInline } from '../lib/md-inline.mjs';

// Every fact in an analyze-requirements set carries where it came from, and the five words
// are a closed vocabulary (validate-provenance.mjs). Written as `observed`, they
// rendered as <code> in accent teal — the same chip as `org_id` and
// `docker-compose.yml`, so the accent meant two unrelated things and the most
// repeated element in the document read as a snippet of code.
test('a provenance marker is its own element, not a code span', () => {
  for (const word of ['observed', 'stated', 'researched', 'proposed', 'assumed']) {
    const html = inline(`The value is bound. \`${word}\``);
    assert.match(html, new RegExp(`<span class="prov" data-prov="${word}">${word}</span>`));
    assert.doesNotMatch(html, /<code>/);
  }
});

test('a code span that is not a marker stays code', () => {
  assert.match(inline('reads `org_id`'), /<code>org_id<\/code>/);
  assert.match(inline('see `docker-compose.yml`'), /<code>docker-compose\.yml<\/code>/);
  // Not a marker just because it contains one.
  assert.match(inline('`observed_at`'), /<code>observed_at<\/code>/);
  assert.match(inline('`the observed value`'), /<code>the observed value<\/code>/);
});

// The vocabulary is exact, so casing is not a licence to invent members.
test('the match is exact, not case-folded', () => {
  assert.match(inline('`Observed`'), /<code>Observed<\/code>/);
});

test('markers survive alongside other inline markup', () => {
  const html = inline('**Bound**, never interpolated `observed` — see [ADR](x.md)');
  assert.match(html, /<strong>Bound<\/strong>/);
  assert.match(html, /data-prov="observed"/);
  assert.match(html, /<a href="x\.md">ADR<\/a>/);
});

// The rail and the breadcrumb show heading text as plain text, and a marker is
// syntax there exactly like a code span is.
test('stripInline still drops the backticks', () => {
  assert.equal(stripInline('a `observed` b'), 'a observed b');
});
