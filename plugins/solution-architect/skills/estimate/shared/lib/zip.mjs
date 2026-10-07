// Minimal zip writer: stored (uncompressed) entries, which every zip reader
// accepts. Written once as ESM and shipped twice: imported by Node tests, and
// inlined ahead of the page scripts that build a file (the estimate's xlsx
// export, the proposal's docx) through withZip() in inline.mjs.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entry: { name: Uint8Array, data: Uint8Array, crc, offset }
function zipHeader(entry, central) {
  const b = new Uint8Array(central ? 46 : 30);
  const v = new DataView(b.buffer);
  v.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  const at = central ? 6 : 4; // version-needed field; central adds version-made-by first
  v.setUint16(at, 20, true);
  v.setUint32(at + 10, entry.crc, true);
  v.setUint32(at + 14, entry.data.length, true);
  v.setUint32(at + 18, entry.data.length, true);
  v.setUint16(at + 22, entry.name.length, true);
  if (central) v.setUint32(42, entry.offset, true);
  return b;
}
function zipEnd(count, cdSize, cdStart) {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdStart, true);
  return b;
}
export function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const centrals = [];
  let offset = 0;
  for (const [path, data] of files) {
    const entry = { name: enc.encode(path), data, crc: crc32(data), offset };
    chunks.push(zipHeader(entry, false), entry.name, data);
    centrals.push(zipHeader(entry, true), entry.name);
    offset += 30 + entry.name.length + data.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const all = [...chunks, ...centrals, zipEnd(files.size, cdSize, offset)];
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  all.reduce((at, b) => (out.set(b, at), at + b.length), 0);
  return out;
}
