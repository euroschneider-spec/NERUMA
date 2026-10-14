// A minimal ZIP writer for the account export: files are stored, not compressed (photos and PDFs are compressed already), and
// every name is UTF-8. Enough for any unzip tool; no dependency (CLAUDE.md, "Prefer reuse over new code").

export type ZipEntry = { name: string; data: Uint8Array };

const table = (() => {
  const values = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    values[n] = c >>> 0;
  }
  return values;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// A name inside the archive: no leading slash, no "..", no backslashes, so unpacking can't write outside its folder.
export function safeEntryName(name: string): string {
  const parts = name.replace(/\\/g, '/').split('/').map((part) => part.replace(/[\u0000-\u001f]/g, '').trim()).filter((part) => part && part !== '.' && part !== '..');
  return parts.join('/') || 'file';
}

export function zip(entries: ZipEntry[], date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  const used = new Set<string>();
  let offset = 0;
  for (const entry of entries) {
    let name = safeEntryName(entry.name);
    // Two documents with the same file name both survive.
    for (let copy = 2; used.has(name); copy++) name = name.replace(/(\.[^./]*)?$/, (ext) => ` (${copy})${ext}`);
    used.add(name);
    const nameBytes = encoder.encode(name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true); // UTF-8 names
    view.setUint16(8, 0, true); // stored
    view.setUint16(10, time, true);
    view.setUint16(12, day, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const central = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(central.buffer);
    cview.setUint32(0, 0x02014b50, true);
    cview.setUint16(4, 20, true);
    cview.setUint16(6, 20, true);
    cview.setUint16(8, 0x0800, true);
    cview.setUint16(10, 0, true);
    cview.setUint16(12, time, true);
    cview.setUint16(14, day, true);
    cview.setUint32(16, crc, true);
    cview.setUint32(20, size, true);
    cview.setUint32(24, size, true);
    cview.setUint16(28, nameBytes.length, true);
    cview.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + size;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, centrals.length, true);
  eview.setUint16(10, centrals.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}
