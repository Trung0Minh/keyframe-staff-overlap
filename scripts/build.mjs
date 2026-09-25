import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

await mkdir('dist/ui', { recursive: true });
await copyFile('manifest.json', 'dist/manifest.json');
await copyFile('src/ui/styles.css', 'dist/ui/styles.css');
await writeFile('dist/loader.js', 'void import(chrome.runtime.getURL("content/index.js"));\n');

// Generate the extension's small frame/intersection icon without image dependencies.
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, payload, checksum]);
}
for (const size of [16, 48, 128]) {
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const left = u > .14 && u < .60 && v > .22 && v < .78;
    const right = u > .40 && u < .86 && v > .22 && v < .78;
    const color = left && right ? [231, 250, 250] : left || right ? [107, 195, 204] : [23, 43, 66];
    rows.set(color, y * (size * 3 + 1) + 1 + x * 3);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  await writeFile(`dist/icon${size}.png`, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}
console.log('Unpacked extension built in dist/');
