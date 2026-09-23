const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create uncompressed / deflated PNG buffer with pure Node.js
function createPng(width, height, drawFn) {
  // RGBA buffer: 4 bytes per pixel + 1 filter byte per scanline
  const rowStride = width * 4 + 1;
  const rawData = Buffer.alloc(rowStride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter byte: 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);

    // CRC32 calculation
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', deflated);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
}

// Icon Drawer: Vibrant Indigo/Emerald theme with financial growth bars and shield
function drawIcon(x, y, w, h) {
  const nx = x / w; // 0..1
  const ny = y / h; // 0..1

  // Rounded corner mask for iOS touch icon / launcher
  const cornerRadius = 0.22;
  const cx = nx < cornerRadius ? cornerRadius - nx : (nx > 1 - cornerRadius ? nx - (1 - cornerRadius) : 0);
  const cy = ny < cornerRadius ? cornerRadius - ny : (ny > 1 - cornerRadius ? ny - (1 - cornerRadius) : 0);
  if (cx * cx + cy * cy > cornerRadius * cornerRadius) {
    return [0, 0, 0, 0]; // transparent outside squircle
  }

  // Background Gradient: Rich Deep Slate to Indigo-Navy
  const grad = ny;
  let r = Math.round(15 * (1 - grad) + 30 * grad);
  let g = Math.round(23 * (1 - grad) + 41 * grad);
  let b = Math.round(42 * (1 - grad) + 89 * grad);

  // Subtle circular ambient glow in top center
  const glowDist = Math.hypot(nx - 0.5, ny - 0.35);
  if (glowDist < 0.45) {
    const factor = (1 - glowDist / 0.45) * 0.4;
    r = Math.min(255, Math.round(r + 56 * factor));
    g = Math.min(255, Math.round(g + 189 * factor));
    b = Math.min(255, Math.round(b + 248 * factor));
  }

  // Draw 4 upward financial growth bars
  const bars = [
    { x0: 0.22, x1: 0.33, h: 0.30, col: [16, 185, 129] },  // emerald
    { x0: 0.38, x1: 0.49, h: 0.45, col: [59, 130, 246] },  // blue
    { x0: 0.54, x1: 0.65, h: 0.60, col: [99, 102, 241] },  // indigo
    { x0: 0.70, x1: 0.81, h: 0.75, col: [245, 158, 11] },  // amber gold
  ];

  const baseY = 0.78;
  for (const bar of bars) {
    if (nx >= bar.x0 && nx <= bar.x1 && ny <= baseY && ny >= baseY - bar.h) {
      // Rounded top of bar
      const barTop = baseY - bar.h;
      const barWidth = bar.x1 - bar.x0;
      const barRadius = barWidth / 2;
      const relY = ny - (barTop + barRadius);
      if (ny < barTop + barRadius) {
        const relX = nx - (bar.x0 + barRadius);
        if (relX * relX + relY * relY > barRadius * barRadius) {
          continue; // outside rounded top
        }
      }
      return [bar.col[0], bar.col[1], bar.col[2], 255];
    }
  }

  // Trendline arc above bars
  const lineY = baseY - 0.15 - Math.pow(nx - 0.15, 1.3) * 0.85;
  if (Math.abs(ny - lineY) < 0.022 && nx >= 0.18 && nx <= 0.84) {
    return [255, 255, 255, 255];
  }

  return [r, g, b, 255];
}

// Generate the icons
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PNG icons...');
const icon192 = createPng(192, 192, drawIcon);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), icon192);

const icon512 = createPng(512, 512, drawIcon);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), icon512);

const appleTouch = createPng(180, 180, drawIcon);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);

// Maskable icon with safe zone padding
function drawMaskableIcon(x, y, w, h) {
  // Add 15% padding
  const scale = 0.76;
  const offset = (1 - scale) / 2;
  const sx = (x / w - offset) / scale;
  const sy = (y / h - offset) / scale;

  if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) {
    return drawIcon(sx * w, sy * h, w, h);
  }
  // Safe background padding
  return [15, 23, 42, 255];
}

const maskable512 = createPng(512, 512, drawMaskableIcon);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable512);

// Create SVG icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="g3" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="g4" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="110" y="250" width="56" height="150" rx="20" fill="url(#g1)"/>
  <rect x="194" y="180" width="56" height="220" rx="20" fill="url(#g2)"/>
  <rect x="278" y="120" width="56" height="280" rx="20" fill="url(#g3)"/>
  <rect x="362" y="60" width="56" height="340" rx="20" fill="url(#g4)"/>
  <path d="M 90 270 Q 230 190 410 70" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg);

console.log('Icons generated successfully.');
