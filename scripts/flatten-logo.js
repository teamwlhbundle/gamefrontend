#!/usr/bin/env node
import fs from "fs";
import sharp from "sharp";

const inPath = "public/pl365-logo.png";
const outPath = inPath; // overwrite
const bgColor = "#0f172a"; // slate-900-ish background to match container

async function run() {
  if (!fs.existsSync(inPath)) {
    console.error("Input not found:", inPath);
    process.exit(1);
  }
  const meta = await sharp(inPath).metadata();
  const { width, height } = meta;
  if (!width || !height) {
    console.error("Unable to read image dimensions");
    process.exit(1);
  }

  // create background
  const bg = {
    create: {
      width,
      height,
      channels: 3,
      background: bgColor,
    },
  };

  const bgBuffer = await sharp(bg).png().toBuffer();

  // composite logo over background so output has no transparency and matches container color
  await sharp(bgBuffer)
    .composite([{ input: inPath, blend: "over" }])
    .png()
    .toFile(outPath + ".flat.png");

  // replace original
  fs.renameSync(outPath + ".flat.png", outPath);
  console.log("Flattened logo written to", outPath);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

