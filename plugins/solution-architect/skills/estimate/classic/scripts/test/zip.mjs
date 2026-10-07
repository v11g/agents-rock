// Minimal zip reader for asserting on workbooks the page exports.
// Central-directory driven: find EOCD, walk entries, inflate each.
import { inflateRawSync } from 'node:zlib';

function eocdOffset(buf) {
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('no end-of-central-directory record');
}

function entryData(buf, cd) {
  const method = buf.readUInt16LE(cd + 10);
  const csize = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const nameLen = buf.readUInt16LE(local + 26);
  const extraLen = buf.readUInt16LE(local + 28);
  const start = local + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + csize);
  if (method === 0) return Buffer.from(raw);
  if (method === 8) return inflateRawSync(raw);
  throw new Error(`unsupported compression method ${method}`);
}

// Returns Map<path, Buffer> of every file in the archive.
export function readZip(buf) {
  const eocd = eocdOffset(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let cd = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad central directory');
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const name = buf.toString('utf8', cd + 46, cd + 46 + nameLen);
    files.set(name, entryData(buf, cd));
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
