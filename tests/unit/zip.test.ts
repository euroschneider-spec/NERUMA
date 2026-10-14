// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, safeEntryName, zip } from '@/lib/zip';

const bytes = (text: string) => new TextEncoder().encode(text);

// Read an archive back from its central directory, as an unzip tool does.
function read(archive: Uint8Array) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files: { name: string; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(archive.slice(at + 46, at + 46 + nameLength));
    const localName = view.getUint16(local + 26, true);
    files.push({ name, crc, data: archive.slice(local + 30 + localName, local + 30 + localName + size) });
    at += 46 + nameLength;
  }
  return files;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('zip', () => {
  it('stores every file with its name, content and checksum', () => {
    const files = read(zip([{ name: 'data.json', data: bytes('{"a":1}') }, { name: 'documents/mandat ș.pdf', data: bytes('%PDF') }]));
    expect(files.map((file) => file.name)).toEqual(['data.json', 'documents/mandat ș.pdf']);
    expect(new TextDecoder().decode(files[0].data)).toBe('{"a":1}');
    for (const file of files) expect(file.crc).toBe(crc32(file.data));
  });

  it('keeps two files with the same name', () => {
    expect(read(zip([{ name: 'a.pdf', data: bytes('1') }, { name: 'a.pdf', data: bytes('2') }])).map((file) => file.name)).toEqual(['a.pdf', 'a (2).pdf']);
  });

  it('never writes outside its folder when unpacked', () => {
    for (const [name, safe] of [['../../etc/passwd', 'etc/passwd'], ['/abs/x.txt', 'abs/x.txt'], ['a\\..\\b.txt', 'a/b.txt'], ['..', 'file'], ['a/\u0000b', 'a/b']]) {
      expect(safeEntryName(name)).toBe(safe);
    }
  });

  it('opens in a real unzip tool, when one is installed', () => {
    let unzip = true;
    try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { unzip = false; }
    if (!unzip) return;
    const folder = mkdtempSync(join(tmpdir(), 'neruma-zip-'));
    try {
      writeFileSync(join(folder, 'export.zip'), zip([{ name: 'data.json', data: bytes('{"ok":true}') }, { name: 'photos/one.webp', data: new Uint8Array([1, 2, 3]) }]));
      execFileSync('unzip', ['-q', '-t', join(folder, 'export.zip')]);
      execFileSync('unzip', ['-q', join(folder, 'export.zip'), '-d', join(folder, 'out')]);
      expect(readFileSync(join(folder, 'out', 'data.json'), 'utf8')).toBe('{"ok":true}');
      expect(existsSync(join(folder, 'out', 'photos', 'one.webp'))).toBe(true);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
