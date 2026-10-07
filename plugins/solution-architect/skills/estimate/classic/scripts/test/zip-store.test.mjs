import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../../../shared/lib/zip.mjs';
import { withZip } from '../../../shared/lib/inline.mjs';
import { readZip } from './zip.mjs';

const enc = new TextEncoder();

test('zipStore writes an archive the reader opens, entries in order', () => {
  const files = new Map([['a.txt', enc.encode('hello')], ['dir/b.xml', enc.encode('<x/>')]]);
  const back = readZip(Buffer.from(zipStore(files)));
  assert.deepEqual([...back.keys()], ['a.txt', 'dir/b.xml']);
  assert.equal(back.get('dir/b.xml').toString('utf8'), '<x/>');
});

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
});

test('withZip puts the writer, without export keywords, ahead of the page script', () => {
  const out = withZip('PAGE_SCRIPT();');
  assert.match(out, /^\/\/ Minimal zip writer/);
  assert.match(out, /\nfunction zipStore\(/);
  assert.doesNotMatch(out, /^export /m);
  assert.ok(out.endsWith('\nPAGE_SCRIPT();'));
});
