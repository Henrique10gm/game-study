#!/usr/bin/env node
// Composes the engine's contract spritesheets (public/assets/tiles/office-tiles.png,
// src/assets/characters.png) from vendored, unmodified Kenney "RPG Urban
// Pack" (CC0) source PNGs under assets/vendor/kenney-rpg-urban-pack/. See
// 01-SKELETON.md "Art" row and 01-01c-PLAN.md Task 1 for the tile index / character
// frame contract. Renamed from gen-assets.mjs (01-01) because this script composes
// vendored art instead of generating placeholder shapes.
//
// Fully offline, zero npm dependencies: only node:fs, node:path, node:zlib and
// node:crypto are imported. No network access of any kind happens in this file —
// all provenance (source page, download link, license) lives in
// assets/vendor/kenney-rpg-urban-pack/LICENSE.txt, never here.
//
// Every SOURCES file is SHA-256 checked before composition (tamper/drift
// detection) — if a vendored file was edited or replaced, this script refuses to
// run rather than silently composing from unexpected pixels.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, '..');

const VERIFY = process.argv.includes('--verify');

// ---------------------------------------------------------------------------
// Vendored source registry — SHA-256 pinned. tileSize/margin/spacing describe
// how to index 16x16 cells inside the sheet (this pack's "_packed" variant has
// 0 margin / 0 spacing; see assets/vendor/kenney-rpg-urban-pack/LICENSE.txt).
// ---------------------------------------------------------------------------
const SOURCES = {
  kenneyTilemap: {
    path: join(PROJECT_ROOT, 'assets/vendor/kenney-rpg-urban-pack/tilemap_packed.png'),
    sha256: '305e71fa778444a0858c33988d45a6b79ea923f500f96079f4378347cf6ad389',
    tileSize: 16,
    margin: 0,
    spacing: 0,
  },
};

// ---------------------------------------------------------------------------
// Tile index contract (01-SKELETON.md "Art" row): 0 floor, 1 carpet, 2 wall,
// 3 desk, 4 plant, 5 door, 6 window-wall, 7 rug. Each entry is an ordered list
// of layers (base first); layers are composited straight-alpha source-over.
// Coordinates are (col, row) of 16x16 cells inside kenneyTilemap.
// ---------------------------------------------------------------------------
const FLOOR = { source: 'kenneyTilemap', col: 9, row: 1 }; // plain gray floor, low contrast, opaque
const WALL = { source: 'kenneyTilemap', col: 9, row: 4 }; // plain gray wall block w/ border trim, opaque

// Player walk cycle: the pack has 4 views per character (columns 23-26: left,
// front, back, right) and 3 poses per view (rows 0-2: idle + two steps).
// Frame index = view * 3 + pose, views ordered left, right, front, back.
const HERO_VIEW_COLS = [23, 26, 24, 25];
const HERO = HERO_VIEW_COLS.flatMap((col) =>
  [0, 1, 2].map((row) => ({ source: 'kenneyTilemap', col, row })),
);

const TILES = [
  [FLOOR], // 0 floor
  [{ source: 'kenneyTilemap', col: 18, row: 1 }], // 1 carpet — red brick floor, opaque
  [WALL], // 2 wall
  [FLOOR, { source: 'kenneyTilemap', col: 3, row: 10 }], // 3 desk — brown chest/cabinet over floor
  [FLOOR, { source: 'kenneyTilemap', col: 17, row: 9 }], // 4 plant — potted bush over floor
  [{ source: 'kenneyTilemap', col: 13, row: 10 }], // 5 door — orange door w/ window, opaque
  [WALL, { source: 'kenneyTilemap', col: 11, row: 12 }], // 6 window-wall — small framed window over wall
  [{ source: 'kenneyTilemap', col: 12, row: 2 }], // 7 rug — patterned floor mat, opaque
];

// ---------------------------------------------------------------------------
// Character frame contract: frame 0 = player, frames 1-7 = NPCs. All sourced
// from the character "bust" column (col 23) of kenneyTilemap, one row per
// design. The pack has 6 clearly distinct front-facing designs; frames 6-7
// reuse the row9-11 (farmer) and row2-5 (red-top) group's alternate animation
// row respectively — see 01-01c-SUMMARY.md for the full mapping rationale.
// ---------------------------------------------------------------------------
const CHARACTERS = [
  { source: 'kenneyTilemap', col: 23, row: 0 }, // frame 0 — player: green-shirt, orange hair
  { source: 'kenneyTilemap', col: 23, row: 2 }, // frame 1 — NPC: red-top, brown hair
  { source: 'kenneyTilemap', col: 23, row: 6 }, // frame 2 — NPC: gray/lavender-hair elder
  { source: 'kenneyTilemap', col: 23, row: 9 }, // frame 3 — NPC: farmer with sun hat
  { source: 'kenneyTilemap', col: 23, row: 12 }, // frame 4 — NPC: bald elder
  { source: 'kenneyTilemap', col: 23, row: 15 }, // frame 5 — NPC: dark-hair colleague
  { source: 'kenneyTilemap', col: 23, row: 4 }, // frame 6 — NPC: reuse of frame 1's design group (alt frame)
  { source: 'kenneyTilemap', col: 23, row: 7 }, // frame 7 — NPC: reuse of frame 2's design group (alt frame)
];

const TILES_OUT = join(PROJECT_ROOT, 'public/assets/tiles/office-tiles.png');
const SPRITES_OUT = join(PROJECT_ROOT, 'src/assets/characters.png');
const HERO_OUT = join(PROJECT_ROOT, 'src/assets/hero.png');

function fail(message) {
  console.error(`compose-assets: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Integrity check — refuse to run if a vendored file drifted from its pin.
// ---------------------------------------------------------------------------
function verifySourceIntegrity() {
  for (const [name, src] of Object.entries(SOURCES)) {
    if (!existsSync(src.path)) fail(`vendored source missing: ${src.path} (${name})`);
    const bytes = readFileSync(src.path);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== src.sha256) {
      fail(
        `SHA-256 mismatch for ${src.path} (${name}): expected ${src.sha256}, got ${actual} — vendored file was modified or replaced`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal PNG decoder: chunk parser + zlib inflate + scanline unfilter.
// Supports bit depth 8, color types 0 (gray), 2 (RGB), 3 (palette + optional
// tRNS), 4 (gray+alpha) and 6 (RGBA). Rejects interlaced images and any other
// bit depth explicitly. Output is always RGBA8.
// ---------------------------------------------------------------------------
function decodePng(buf, label) {
  if (
    buf.length < 8 ||
    buf.readUInt32BE(0) !== 0x89504e47 ||
    buf.readUInt32BE(4) !== 0x0d0a1a0a
  ) {
    fail(`${label}: not a PNG file (bad signature)`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];
  let palette = null;
  let trns = null;

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }

  if (interlace !== 0) fail(`${label}: interlaced PNGs are not supported`);
  if (bitDepth !== 8) fail(`${label}: unsupported bit depth ${bitDepth} (only 8 is supported)`);
  if (![0, 2, 3, 4, 6].includes(colorType)) {
    fail(`${label}: unsupported color type ${colorType}`);
  }

  const raw = inflateSync(Buffer.concat(idatChunks));

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const stride = width * channels;
  const unfiltered = Buffer.alloc(height * stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[rawOffset + x];
      const a = x >= channels ? unfiltered[rowStart + x - channels] : 0;
      const b = y > 0 ? unfiltered[prevRowStart + x] : 0;
      const c = y > 0 && x >= channels ? unfiltered[prevRowStart + x - channels] : 0;
      let value;
      if (filterType === 0) value = rawByte;
      else if (filterType === 1) value = (rawByte + a) & 0xff;
      else if (filterType === 2) value = (rawByte + b) & 0xff;
      else if (filterType === 3) value = (rawByte + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        value = (rawByte + predictor) & 0xff;
      } else {
        fail(`${label}: unsupported filter type ${filterType} at row ${y}`);
      }
      unfiltered[rowStart + x] = value;
    }
    rawOffset += stride;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let px = 0, i = 0; px < width * height; px += 1, i += channels) {
    let r;
    let g;
    let b;
    let a;
    if (colorType === 6) {
      r = unfiltered[i];
      g = unfiltered[i + 1];
      b = unfiltered[i + 2];
      a = unfiltered[i + 3];
    } else if (colorType === 2) {
      r = unfiltered[i];
      g = unfiltered[i + 1];
      b = unfiltered[i + 2];
      a = 255;
    } else if (colorType === 4) {
      r = unfiltered[i];
      g = unfiltered[i];
      b = unfiltered[i];
      a = unfiltered[i + 1];
    } else if (colorType === 0) {
      r = unfiltered[i];
      g = unfiltered[i];
      b = unfiltered[i];
      a = 255;
    } else {
      // colorType === 3: palette index
      const idx = unfiltered[i];
      if (!palette) fail(`${label}: palette color type but no PLTE chunk`);
      r = palette[idx * 3];
      g = palette[idx * 3 + 1];
      b = palette[idx * 3 + 2];
      a = trns && idx < trns.length ? trns[idx] : 255;
    }
    rgba[px * 4] = r;
    rgba[px * 4 + 1] = g;
    rgba[px * 4 + 2] = b;
    rgba[px * 4 + 3] = a;
  }

  return { width, height, rgba };
}

// ---------------------------------------------------------------------------
// CRC32 table + PNG encoder (RGBA8, single IDAT, filter byte 0 per row).
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None) per row
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Compositing: source-over a single 16x16 cell from a decoded source image,
// then 2x nearest-neighbor upscale to 32x32 (no interpolation/smoothing).
// ---------------------------------------------------------------------------
function getCellPixel(decoded, src, col, row, x, y) {
  const cellX = src.margin + col * (src.tileSize + src.spacing) + x;
  const cellY = src.margin + row * (src.tileSize + src.spacing) + y;
  const idx = (cellY * decoded.width + cellX) * 4;
  return [decoded.rgba[idx], decoded.rgba[idx + 1], decoded.rgba[idx + 2], decoded.rgba[idx + 3]];
}

function composeCell(layers, decodedSources) {
  const size = 16;
  const canvas = new Uint8ClampedArray(size * size * 4); // starts fully transparent
  for (const layer of layers) {
    const src = SOURCES[layer.source];
    const decoded = decodedSources[layer.source];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const [r, g, b, a] = getCellPixel(decoded, src, layer.col, layer.row, x, y);
        const idx = (y * size + x) * 4;
        if (a === 0) continue; // fully transparent source pixel — nothing to composite
        if (a === 255) {
          canvas[idx] = r;
          canvas[idx + 1] = g;
          canvas[idx + 2] = b;
          canvas[idx + 3] = 255;
          continue;
        }
        // straight-alpha source-over compositing for partially transparent pixels
        const srcA = a / 255;
        const dstA = canvas[idx + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA === 0) continue;
        canvas[idx] = Math.round((r * srcA + canvas[idx] * dstA * (1 - srcA)) / outA);
        canvas[idx + 1] = Math.round((g * srcA + canvas[idx + 1] * dstA * (1 - srcA)) / outA);
        canvas[idx + 2] = Math.round((b * srcA + canvas[idx + 2] * dstA * (1 - srcA)) / outA);
        canvas[idx + 3] = Math.round(outA * 255);
      }
    }
  }
  return canvas;
}

function upscale2x(cell16) {
  const outSize = 32;
  const out = Buffer.alloc(outSize * outSize * 4);
  for (let y = 0; y < outSize; y += 1) {
    const srcY = Math.floor(y / 2);
    for (let x = 0; x < outSize; x += 1) {
      const srcX = Math.floor(x / 2);
      const srcIdx = (srcY * 16 + srcX) * 4;
      const dstIdx = (y * outSize + x) * 4;
      out[dstIdx] = cell16[srcIdx];
      out[dstIdx + 1] = cell16[srcIdx + 1];
      out[dstIdx + 2] = cell16[srcIdx + 2];
      out[dstIdx + 3] = cell16[srcIdx + 3];
    }
  }
  return out;
}

function buildStrip(entries, decodedSources) {
  const frameSize = 32;
  const stripWidth = frameSize * entries.length;
  const stripHeight = frameSize;
  const strip = Buffer.alloc(stripWidth * stripHeight * 4);
  entries.forEach((entry, i) => {
    const layers = Array.isArray(entry) ? entry : [entry];
    const cell16 = composeCell(layers, decodedSources);
    const cell32 = upscale2x(cell16);
    const xOffset = i * frameSize;
    for (let y = 0; y < frameSize; y += 1) {
      for (let x = 0; x < frameSize; x += 1) {
        const srcIdx = (y * frameSize + x) * 4;
        const dstIdx = (y * stripWidth + (xOffset + x)) * 4;
        strip[dstIdx] = cell32[srcIdx];
        strip[dstIdx + 1] = cell32[srcIdx + 1];
        strip[dstIdx + 2] = cell32[srcIdx + 2];
        strip[dstIdx + 3] = cell32[srcIdx + 3];
      }
    }
  });
  return { width: stripWidth, height: stripHeight, rgba: strip };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function compose() {
  verifySourceIntegrity();

  const decodedSources = {};
  for (const [name, src] of Object.entries(SOURCES)) {
    decodedSources[name] = decodePng(readFileSync(src.path), src.path);
  }

  const tilesStrip = buildStrip(TILES, decodedSources);
  const charactersStrip = buildStrip(CHARACTERS, decodedSources);
  const heroStrip = buildStrip(HERO, decodedSources);

  ensureDir(TILES_OUT);
  ensureDir(SPRITES_OUT);
  writeFileSync(TILES_OUT, encodePng(tilesStrip.width, tilesStrip.height, tilesStrip.rgba));
  writeFileSync(
    SPRITES_OUT,
    encodePng(charactersStrip.width, charactersStrip.height, charactersStrip.rgba),
  );
  console.log(`compose-assets: wrote ${TILES_OUT}`);
  writeFileSync(HERO_OUT, encodePng(heroStrip.width, heroStrip.height, heroStrip.rgba));
  console.log(`compose-assets: wrote ${SPRITES_OUT}`);
  console.log(`compose-assets: wrote ${HERO_OUT}`);
}

// ---------------------------------------------------------------------------
// --verify: decode the composed outputs and assert the contract holds
// (2x nearest-neighbor blocks, opacity/distinctness rules) without writing.
// ---------------------------------------------------------------------------
function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`verify failed: ${message} (expected ${expected}, got ${actual})`);
}

function cellBytes(decoded, frameIndex, frameSize) {
  const bytes = [];
  const xOffset = frameIndex * frameSize;
  for (let y = 0; y < frameSize; y += 1) {
    for (let x = 0; x < frameSize; x += 1) {
      const idx = (y * decoded.width + (xOffset + x)) * 4;
      bytes.push(
        decoded.rgba[idx],
        decoded.rgba[idx + 1],
        decoded.rgba[idx + 2],
        decoded.rgba[idx + 3],
      );
    }
  }
  return bytes;
}

function framesIdentical(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function assertNearestNeighbor2x(decoded, label) {
  for (let by = 0; by < decoded.height; by += 2) {
    for (let bx = 0; bx < decoded.width; bx += 2) {
      const idx00 = (by * decoded.width + bx) * 4;
      const idx01 = (by * decoded.width + bx + 1) * 4;
      const idx10 = ((by + 1) * decoded.width + bx) * 4;
      const idx11 = ((by + 1) * decoded.width + bx + 1) * 4;
      for (let c = 0; c < 4; c += 1) {
        if (
          decoded.rgba[idx00 + c] !== decoded.rgba[idx01 + c] ||
          decoded.rgba[idx00 + c] !== decoded.rgba[idx10 + c] ||
          decoded.rgba[idx00 + c] !== decoded.rgba[idx11 + c]
        ) {
          fail(`verify failed: ${label} block at (${bx},${by}) is not a uniform 2x2 (not 2x nearest-neighbor)`);
        }
      }
    }
  }
}

function verify() {
  if (!existsSync(TILES_OUT)) fail(`verify: missing ${TILES_OUT} — run npm run compose:assets first`);
  if (!existsSync(SPRITES_OUT)) fail(`verify: missing ${SPRITES_OUT} — run npm run compose:assets first`);

  const tiles = decodePng(readFileSync(TILES_OUT), TILES_OUT);
  const characters = decodePng(readFileSync(SPRITES_OUT), SPRITES_OUT);

  assertEqual(tiles.width, 256, 'office-tiles.png width');
  assertEqual(tiles.height, 32, 'office-tiles.png height');
  assertEqual(characters.width, 256, 'characters.png width');
  assertEqual(characters.height, 32, 'characters.png height');

  assertNearestNeighbor2x(tiles, 'office-tiles.png');
  assertNearestNeighbor2x(characters, 'characters.png');

  const tileFrames = [];
  for (let i = 0; i < 8; i += 1) {
    const bytes = cellBytes(tiles, i, 32);
    tileFrames.push(bytes);
    for (let p = 3; p < bytes.length; p += 4) {
      if (bytes[p] !== 255) fail(`verify failed: office-tiles.png tile ${i} has a non-opaque pixel (alpha ${bytes[p]})`);
    }
  }
  for (let i = 0; i < tileFrames.length; i += 1) {
    for (let j = i + 1; j < tileFrames.length; j += 1) {
      if (framesIdentical(tileFrames[i], tileFrames[j])) {
        fail(`verify failed: office-tiles.png tiles ${i} and ${j} are pixel-identical (must be pairwise distinct)`);
      }
    }
  }

  const charFrames = [];
  for (let i = 0; i < 8; i += 1) {
    const bytes = cellBytes(characters, i, 32);
    charFrames.push(bytes);
    let hasOpaque = false;
    let hasTransparent = false;
    for (let p = 3; p < bytes.length; p += 4) {
      if (bytes[p] === 255) hasOpaque = true;
      if (bytes[p] === 0) hasTransparent = true;
    }
    if (!hasOpaque) fail(`verify failed: characters.png frame ${i} has no fully opaque pixel`);
    if (!hasTransparent) fail(`verify failed: characters.png frame ${i} has no fully transparent pixel`);
  }
  for (let i = 1; i < charFrames.length; i += 1) {
    if (framesIdentical(charFrames[0], charFrames[i])) {
      fail(`verify failed: characters.png frame 0 (player) is pixel-identical to frame ${i}`);
    }
  }

  console.log('compose-assets verify OK');
}

if (VERIFY) {
  verify();
} else {
  compose();
}
