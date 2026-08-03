// Generates PWA icons (192x192 and 512x512) as solid-color PNGs with a WhatsApp-style
// message bubble glyph, using only Node's built-in zlib (no external deps).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/images");
mkdirSync(outDir, { recursive: true });

// WhatsApp green
const THEME = [37, 211, 102];
const BG = [17, 27, 33]; // dark background

// A simple 4x4 "message bubble" stencil rendered at scale.
// 1 => bubble fill, 0 => transparent
const BUBBLE = [
  [0, 1, 1, 0],
  [1, 0, 0, 1],
  [1, 0, 0, 1],
  [0, 1, 1, 0],
];

function makePng(size) {
  const scale = Math.floor(size / 4);
  const cell = Math.floor(size / 4);
  const rows = [];
  const colorType = 6; // RGBA

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte + RGBA
    row[0] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const bx = Math.floor(x / cell);
      const by = Math.floor(y / cell);
      const isBubble = bx < 4 && by < 4 && BUBBLE[by]?.[bx] === 1;
      const isEdge = bx < 4 && by < 4;
      let r, g, b, a;
      if (isBubble) {
        r = THEME[0];
        g = THEME[1];
        b = THEME[2];
        a = 255;
      } else {
        // dim the bubble edge cells slightly for a subtle border
        r = BG[0];
        g = BG[1];
        b = BG[2];
        a = isEdge ? 255 : 0;
      }
      const idx = 1 + x * 4;
      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const idat = deflateSync(raw);

  // PNG chunks
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CRC32 for PNG chunks
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

for (const size of [192, 512]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), makePng(size));
  console.log(`Generated icon-${size}.png`);
}

// Also generate a maskable-friendly 512 with full-bleed background (no transparency)
function makeMaskable() {
  const size = 512;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    const inner = 0.6; // keep bubble within safe zone (~10% inset)
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const inSafe = nx > 0.15 && nx < 0.85 && ny > 0.15 && ny < 0.85;
      const bx = (x - size * 0.2) / (size * 0.6);
      const by = (y - size * 0.2) / (size * 0.6);
      const isBubble =
        bx >= 0 && bx < 1 && by >= 0 && by < 1 && BUBBLE[Math.floor(by * 4)]?.[Math.floor(bx * 4)] === 1;
      const idx = 1 + x * 4;
      row[idx] = isBubble ? THEME[0] : BG[0];
      row[idx + 1] = isBubble ? THEME[1] : BG[1];
      row[idx + 2] = isBubble ? THEME[2] : BG[2];
      row[idx + 3] = 255;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const idat = deflateSync(raw);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync(resolve(outDir, "icon-maskable-512.png"), makeMaskable());
console.log("Generated icon-maskable-512.png");