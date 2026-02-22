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
  const thresh = 30; // tweak if needed
  for (let i = 0, j = 0; i < src.length; i += channels, j += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    dst[j] = r;
    dst[j + 1] = g;
    dst[j + 2] = b;
    const isBlack = r <= thresh && g <= thresh && b <= thresh;
    dst[j + 3] = isBlack ? 0 : 255;
  }

  await sharp(dst, { raw: { width, height, channels: 4 } }).png().toFile(tmpOut);
  fs.renameSync(tmpOut, inPath);
  console.log('Replaced', inPath, 'with transparent background where black was present.');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

