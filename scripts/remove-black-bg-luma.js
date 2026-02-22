#!/usr/bin/env node
import fs from 'fs';
import sharp from 'sharp';

const inPath = 'public/pl365-logo.png';
const tmpOut = inPath + '.tmp.png';

async function run() {
  if (!fs.existsSync(inPath)) {
    console.error('Input file not found:', inPath);
    process.exit(1);
  }
  const img = sharp(inPath);
  const { data: src, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 3) {
    console.error('Unexpected channels:', channels);
    process.exit(1);
  }
  const dst = Buffer.alloc(width * height * 4);
  // aggressive luminance-based alpha mask
  const lower = 30; // pixels with lum <= lower become fully transparent
  for (let i = 0, j = 0; i < src.length; i += channels, j += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    // standard luminance
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let alpha = Math.round(((lum - lower) / (255 - lower)) * 255);
    if (alpha < 0) alpha = 0;
    if (alpha > 255) alpha = 255;
    dst[j] = r;
    dst[j + 1] = g;
    dst[j + 2] = b;
    dst[j + 3] = alpha;
  }
  await sharp(dst, { raw: { width, height, channels: 4 } }).png().toFile(tmpOut);
  fs.renameSync(tmpOut, inPath);
  console.log('Applied luminance mask and replaced', inPath);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

